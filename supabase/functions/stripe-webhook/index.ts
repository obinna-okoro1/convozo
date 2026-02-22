import Stripe from 'stripe';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Idempotency: skip if this checkout session has already been processed
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_checkout_session_id', session.id)
        .maybeSingle();

      const { data: existingBooking } = await supabase
        .from('call_bookings')
        .select('id')
        .eq('stripe_checkout_session_id', session.id)
        .maybeSingle();

      if (existingPayment || existingBooking) {
        console.log('Checkout session already processed, skipping:', session.id);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if this is a call booking
      if (session.metadata?.type === 'call_booking') {
        const { creator_id, booker_name, booker_email, booker_instagram, message_content, duration } = 
          session.metadata as {
            creator_id: string;
            booker_name: string;
            booker_email: string;
            booker_instagram: string;
            message_content: string;
            duration: string;
          };

        const amountInCents = session.amount_total || 0;

        // Create call booking record
        const { data: booking, error: bookingError } = await supabase
          .from('call_bookings')
          .insert({
            creator_id,
            booker_name,
            booker_email,
            booker_instagram,
            duration: parseInt(duration),
            amount_paid: amountInCents,
            status: 'confirmed',
            call_notes: message_content || null,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .select()
          .single();

        if (bookingError) {
          console.error('Error creating call booking:', bookingError);
          throw bookingError;
        }

        console.log('Call booking created successfully:', booking.id);
        
      } else {
        // Handle regular message payment
        const { creator_id, message_content, sender_name, sender_email, sender_instagram, message_type, amount } = 
          session.metadata as {
            creator_id: string;
            message_content: string;
            sender_name: string;
            sender_email: string;
            sender_instagram: string;
            message_type: string;
            amount: string;
          };

        const amountInCents = parseInt(amount);
        const validMessageType = message_type === 'call' ? 'call' : 'message';

        // Create the message only after payment succeeds
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .insert({
            creator_id,
            sender_name,
            sender_email,
            sender_instagram: sender_instagram || null,
            message_content,
            amount_paid: amountInCents,
            message_type: validMessageType,
          })
          .select('id')
          .single();

        if (messageError) {
          console.error('Error creating message:', messageError);
          throw messageError;
        }

        // Create payment record linked to the message
        const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '35');
        const platformFee = Math.floor(amountInCents * (platformFeePercentage / 100));
        const creatorAmount = amountInCents - platformFee;

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            message_id: message.id,
            creator_id,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            amount: amountInCents,
            platform_fee: platformFee,
            creator_amount: creatorAmount,
            status: 'completed',
            sender_email,
          });

        if (paymentError) {
          console.error('Error creating payment:', paymentError);
          throw paymentError;
        }

        console.log('Message and payment created for:', message.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
