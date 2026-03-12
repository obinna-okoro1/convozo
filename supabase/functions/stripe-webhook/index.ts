import { sendEmail, messageConfirmationEmail, callBookingConfirmationEmail, newMessageNotificationEmail, newCallBookingNotificationEmail } from '../_shared/email.ts';
import { stripe, Stripe, stripeCryptoProvider } from '../_shared/stripe.ts';
import { supabase, supabaseUrl, supabaseServiceKey } from '../_shared/supabase.ts';

// v3 - new webhook endpoint + secret rotation

/**
 * Fire-and-forget push notification for a creator.
 * Calls the send-push-notification Edge Function internally.
 * Errors are logged but never allowed to fail the webhook response.
 */
async function sendPushNotification(creatorId: string, title: string, body: string): Promise<void> {
  try {
    const fnUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const internalSecret = Deno.env.get('INTERNAL_SECRET') || '';
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use service role key so the function can read from push_subscriptions
        'Authorization': `Bearer ${supabaseServiceKey}`,
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
      },
      body: JSON.stringify({ creator_id: creatorId, title, body, url: '/creator/dashboard' }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[stripe-webhook] Push notification failed:', res.status, text);
    }
  } catch (err) {
    // Never let push failures break the webhook — payments are processed regardless
    console.error('[stripe-webhook] Push notification error (non-fatal):', (err as Error).message);
  }
}

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
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      stripeCryptoProvider,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Rule: never process a session that has not been fully paid.
      // checkout.session.completed fires even for sessions with payment_status='unpaid'
      // (e.g. free checkout, subscriptions awaiting invoice). Reject them immediately.
      if (session.payment_status !== 'paid') {
        console.log('Skipping session with payment_status:', session.payment_status, session.id);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Idempotency: skip if this checkout session has already been processed
      // Check all three tables that store session IDs to cover every code path
      const [{ data: existingPayment }, { data: existingBooking }, { data: existingMessage }] = await Promise.all([
        supabase.from('payments').select('id').eq('stripe_session_id', session.id).maybeSingle(),
        supabase.from('call_bookings').select('id').eq('stripe_session_id', session.id).maybeSingle(),
        supabase.from('messages').select('id').eq('stripe_session_id', session.id).maybeSingle(),
      ]);

      if (existingPayment || existingBooking || existingMessage) {
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
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .select()
          .single();

        if (bookingError) {
          // UNIQUE constraint violation means a concurrent webhook already created this booking
          if (bookingError.code === '23505') {
            console.log('Duplicate webhook detected (booking already exists):', session.id);
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          console.error('Error creating call booking:', bookingError);
          throw bookingError;
        }

        console.log('Call booking created successfully:', booking.id);

        // Send emails (fire-and-forget; failures are logged)
        const { data: callCreator } = await supabase
          .from('creators')
          .select('display_name, email')
          .eq('id', creator_id)
          .single();

        if (callCreator) {
          // 1. Confirmation to the booker
          const bookerEmail = callBookingConfirmationEmail({
            bookerName: booker_name,
            creatorName: callCreator.display_name,
            durationMinutes: parseInt(duration),
            amountCents: amountInCents,
          });
          await sendEmail({ to: booker_email, ...bookerEmail, idempotencyKey: `${session.id}_call_booker` });

          // 2. Notification to the creator
          const creatorEmail = newCallBookingNotificationEmail({
            creatorName: callCreator.display_name,
            bookerName: booker_name,
            bookerEmail: booker_email,
            bookerInstagram: booker_instagram || null,
            durationMinutes: parseInt(duration),
            amountCents: amountInCents,
            callNotes: message_content || null,
          });
          await sendEmail({ to: callCreator.email, ...creatorEmail, idempotencyKey: `${session.id}_call_creator` });
        }

        // 3. Push notification to the creator (fire-and-forget)
        void sendPushNotification(
          creator_id,
          '📅 New call booking!',
          `${booker_name} booked a ${duration}-minute call with you`,
        );

      } else {
        // Handle regular message payment
        const { creator_id, message_content, sender_name, sender_email, sender_instagram, message_type } =
          session.metadata as {
            creator_id: string;
            message_content: string;
            sender_name: string;
            sender_email: string;
            sender_instagram: string;
            message_type: string;
          };

        // Use Stripe-authoritative amount, not metadata (prevents manipulation)
        const amountInCents = session.amount_total || 0;
        const validMessageType = ['message', 'call', 'follow_back', 'support'].includes(message_type) ? message_type : 'message';

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
            stripe_session_id: session.id,
          })
          .select('id')
          .single();

        if (messageError) {
          // UNIQUE constraint violation on stripe_session_id means a
          // concurrent webhook already created this message — treat as success.
          if (messageError.code === '23505') {
            console.log('Duplicate webhook detected (message already exists):', session.id);
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          console.error('Error creating message:', messageError);
          throw messageError;
        }

        // Create payment record linked to the message
        // Calculate fee using Math.round for symmetric rounding (never Math.floor)
        const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
        const platformFee = Math.round(amountInCents * platformFeePercentage / 100);
        const creatorAmount = amountInCents - platformFee;

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            message_id: message.id,
            creator_id,
            stripe_session_id: session.id,
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

        // Send emails (fire-and-forget; failures are logged)
        const { data: msgCreator } = await supabase
          .from('creators')
          .select('display_name, email')
          .eq('id', creator_id)
          .single();

        if (msgCreator) {
          // 1. Confirmation to the sender
          const senderEmailPayload = messageConfirmationEmail({
            senderName: sender_name,
            creatorName: msgCreator.display_name,
            messageContent: message_content,
            amountCents: amountInCents,
          });
          await sendEmail({ to: sender_email, ...senderEmailPayload, idempotencyKey: `${session.id}_msg_sender` });

          // 2. Notification to the creator
          const creatorEmailPayload = newMessageNotificationEmail({
            creatorName: msgCreator.display_name,
            senderName: sender_name,
            senderEmail: sender_email,
            senderInstagram: sender_instagram || null,
            messageContent: message_content,
            amountCents: amountInCents,
          });
          await sendEmail({ to: msgCreator.email, ...creatorEmailPayload, idempotencyKey: `${session.id}_msg_creator` });
        }

        // 3. Push notification to the creator (fire-and-forget)
        void sendPushNotification(
          creator_id,
          '💬 New paid message!',
          `${sender_name} sent you a paid message`,
        );
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
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
