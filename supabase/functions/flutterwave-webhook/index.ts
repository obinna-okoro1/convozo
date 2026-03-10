import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, messageConfirmationEmail, callBookingConfirmationEmail, newMessageNotificationEmail, newCallBookingNotificationEmail } from '../_shared/email.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') || '';
const FLW_WEBHOOK_HASH = Deno.env.get('FLW_WEBHOOK_HASH') || '';

Deno.serve(async (req) => {
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, verif-hash',
      },
    });
  }

  // Flutterwave sends GET to validate the webhook URL is reachable
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only POST allowed beyond this point
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Verify webhook authenticity using the secret hash header
    const verifHash = req.headers.get('verif-hash');
    if (!verifHash || verifHash !== FLW_WEBHOOK_HASH) {
      console.error('Invalid webhook hash');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();

    // Flutterwave sends event = "charge.completed" for successful payments
    if (payload.event !== 'charge.completed' || payload.data?.status !== 'successful') {
      // Acknowledge but do nothing
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const txData = payload.data;
    const txRef = txData.tx_ref as string;
    const meta = txData.meta || {};

    // Idempotency: skip if this transaction has already been processed
    const [{ data: existingPayment }, { data: existingBooking }, { data: existingMessage }] = await Promise.all([
      supabase.from('payments').select('id').eq('flw_tx_ref', txRef).maybeSingle(),
      supabase.from('call_bookings').select('id').eq('flw_tx_ref', txRef).maybeSingle(),
      supabase.from('messages').select('id').eq('flw_tx_ref', txRef).maybeSingle(),
    ]);

    if (existingPayment || existingBooking || existingMessage) {
      console.log('Transaction already processed, skipping:', txRef);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the transaction with Flutterwave to prevent fraud
    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${txData.id}/verify`, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
    });
    const verifyData = await verifyResponse.json();

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      console.error('Transaction verification failed:', verifyData);
      return new Response(JSON.stringify({ error: 'Verification failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // amount_paid is always stored in USD cents, regardless of what currency
    // Flutterwave charged in. We read the original USD cents from meta (set at
    // checkout time) so the frontend's "/ 100 → $" formatting is always correct.
    const amountInCents = parseInt(meta.amount_cents || '0', 10) || Math.round(verifyData.data.amount);

    // Check if this is a call booking
    if (meta.type === 'call_booking') {
      const { creator_id, booker_name, booker_email, booker_instagram, message_content, duration } = meta;

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
          flw_tx_ref: txRef,
          flw_transaction_id: String(txData.id),
        })
        .select()
        .single();

      if (bookingError) {
        if (bookingError.code === '23505') {
          console.log('Duplicate webhook detected (booking already exists):', txRef);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        console.error('Error creating call booking:', bookingError);
        throw bookingError;
      }

      console.log('Call booking created successfully:', booking.id);

      // Send emails (fire-and-forget)
      const { data: callCreator } = await supabase
        .from('creators')
        .select('display_name, email')
        .eq('id', creator_id)
        .single();

      if (callCreator) {
        const bookerEmail = callBookingConfirmationEmail({
          bookerName: booker_name,
          creatorName: callCreator.display_name,
          durationMinutes: parseInt(duration),
          amountCents: amountInCents,
        });
        await sendEmail({ to: booker_email, ...bookerEmail, idempotencyKey: `${txRef}_call_booker` });

        const creatorEmail = newCallBookingNotificationEmail({
          creatorName: callCreator.display_name,
          bookerName: booker_name,
          bookerEmail: booker_email,
          bookerInstagram: booker_instagram || null,
          durationMinutes: parseInt(duration),
          amountCents: amountInCents,
          callNotes: message_content || null,
        });
        await sendEmail({ to: callCreator.email, ...creatorEmail, idempotencyKey: `${txRef}_call_creator` });
      }
    } else {
      // Handle regular message payment
      const { creator_id, message_content, sender_name, sender_email, sender_instagram, message_type } = meta;

      const validMessageType = ['message', 'call', 'follow_back', 'support'].includes(message_type) ? message_type : 'message';

      // Create the message only after payment is verified
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
          flw_tx_ref: txRef,
        })
        .select('id')
        .single();

      if (messageError) {
        if (messageError.code === '23505') {
          console.log('Duplicate webhook detected (message already exists):', txRef);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        console.error('Error creating message:', messageError);
        throw messageError;
      }

      // Create payment record linked to the message
      const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
      const platformFee = Math.floor(amountInCents * (platformFeePercentage / 100));
      const creatorAmount = amountInCents - platformFee;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          message_id: message.id,
          creator_id,
          flw_tx_ref: txRef,
          flw_transaction_id: String(txData.id),
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
        await sendEmail({ to: sender_email, ...senderEmailPayload, idempotencyKey: `${txRef}_msg_sender` });

        const creatorEmailPayload = newMessageNotificationEmail({
          creatorName: msgCreator.display_name,
          senderName: sender_name,
          senderEmail: sender_email,
          senderInstagram: sender_instagram || null,
          messageContent: message_content,
          amountCents: amountInCents,
        });
        await sendEmail({ to: msgCreator.email, ...creatorEmailPayload, idempotencyKey: `${txRef}_msg_creator` });
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
