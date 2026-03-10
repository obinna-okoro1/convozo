import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { sendEmail, messageConfirmationEmail, callBookingConfirmationEmail, newMessageNotificationEmail, newCallBookingNotificationEmail } from '../_shared/email.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' });
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only process successful checkout completions
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const meta = session.metadata || {};

  try {
    // Idempotency: skip if already processed
    const [{ data: existingPayment }, { data: existingBooking }, { data: existingMessage }] = await Promise.all([
      supabase.from('payments').select('id').eq('stripe_session_id', sessionId).maybeSingle(),
      supabase.from('call_bookings').select('id').eq('stripe_session_id', sessionId).maybeSingle(),
      supabase.from('messages').select('id').eq('stripe_session_id', sessionId).maybeSingle(),
    ]);

    if (existingPayment || existingBooking || existingMessage) {
      console.log('Session already processed, skipping:', sessionId);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const amountInCents = session.amount_total || 0;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : '';

    if (meta.type === 'call_booking') {
      const { creator_id, booker_name, booker_email, booker_instagram, message_content, duration } = meta;

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
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId,
        })
        .select()
        .single();

      if (bookingError) {
        if (bookingError.code === '23505') {
          console.log('Duplicate webhook (call booking):', sessionId);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        console.error('Error creating call booking:', bookingError);
        throw bookingError;
      }

      console.log('Call booking created:', booking.id);

      // Send emails (fire-and-forget)
      const { data: callCreator } = await supabase
        .from('creators')
        .select('display_name, email')
        .eq('id', creator_id)
        .single();

      if (callCreator) {
        const bookerEmailPayload = callBookingConfirmationEmail({
          bookerName: booker_name,
          creatorName: callCreator.display_name,
          durationMinutes: parseInt(duration),
          amountCents: amountInCents,
        });
        await sendEmail({ to: booker_email, ...bookerEmailPayload, idempotencyKey: `${sessionId}_call_booker` });

        const creatorEmailPayload = newCallBookingNotificationEmail({
          creatorName: callCreator.display_name,
          bookerName: booker_name,
          bookerEmail: booker_email,
          bookerInstagram: booker_instagram || null,
          durationMinutes: parseInt(duration),
          amountCents: amountInCents,
          callNotes: message_content || null,
        });
        await sendEmail({ to: callCreator.email, ...creatorEmailPayload, idempotencyKey: `${sessionId}_call_creator` });
      }
    } else {
      // Regular message payment
      const { creator_id, message_content, sender_name, sender_email, sender_instagram, message_type } = meta;
      const validMessageType = ['message', 'call', 'follow_back', 'support'].includes(message_type) ? message_type : 'message';

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
          stripe_session_id: sessionId,
        })
        .select('id')
        .single();

      if (messageError) {
        if (messageError.code === '23505') {
          console.log('Duplicate webhook (message):', sessionId);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        console.error('Error creating message:', messageError);
        throw messageError;
      }

      const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
      const platformFee = Math.floor(amountInCents * (platformFeePercentage / 100));
      const creatorAmount = amountInCents - platformFee;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          message_id: message.id,
          creator_id,
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId,
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

      console.log('Message and payment created:', message.id);

      // Send emails (fire-and-forget)
      const { data: msgCreator } = await supabase
        .from('creators')
        .select('display_name, email')
        .eq('id', creator_id)
        .single();

      if (msgCreator) {
        const senderEmailPayload = messageConfirmationEmail({
          senderName: sender_name,
          creatorName: msgCreator.display_name,
          messageContent: message_content,
          amountCents: amountInCents,
        });
        await sendEmail({ to: sender_email, ...senderEmailPayload, idempotencyKey: `${sessionId}_msg_sender` });

        const creatorEmailPayload = newMessageNotificationEmail({
          creatorName: msgCreator.display_name,
          senderName: sender_name,
          senderEmail: sender_email,
          senderInstagram: sender_instagram || null,
          messageContent: message_content,
          amountCents: amountInCents,
        });
        await sendEmail({ to: msgCreator.email, ...creatorEmailPayload, idempotencyKey: `${sessionId}_msg_creator` });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
