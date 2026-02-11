import Stripe from 'stripe';
import { createClient } from 'supabase';

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
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Extract metadata
      const { creator_id, message_content, sender_name, sender_email, message_type, amount } = 
        session.metadata as {
          creator_id: string;
          message_content: string;
          sender_name: string;
          sender_email: string;
          message_type: string;
          amount: string;
        };

      const amountInCents = parseInt(amount);
      const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '10');
      const platformFee = Math.floor(amountInCents * (platformFeePercentage / 100));
      const creatorAmount = amountInCents - platformFee;

      // Create message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          creator_id,
          sender_name,
          sender_email,
          message_content,
          amount_paid: amountInCents,
          message_type,
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error creating message:', messageError);
        throw messageError;
      }

      // Create payment record
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

      // TODO: Send confirmation email to sender
      console.log('Payment processed successfully for message:', message.id);
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
