/**
 * flutterwave-webhook
 *
 * Handles incoming Flutterwave webhook events for Convozo.
 *
 * What it does:
 *   - Verifies the verif-hash header against FLW_SECRET_HASH (timing-safe comparison)
 *   - Handles the `charge.completed` event with status `successful`
 *   - Performs a secondary verify call to Flutterwave using the transaction ID to confirm payment
 *   - Inserts the message or call booking record
 *   - Sends confirmation emails to the client and notification emails to the expert
 *   - Triggers push notifications (fire-and-forget)
 *
 * What it expects:
 *   - POST request from Flutterwave with a valid verif-hash header
 *   - Metadata embedded in the transaction at checkout time (data.meta):
 *       For messages: creator_id, message_content, sender_name, sender_email, message_type, amount, provider
 *       For calls:    type='call_booking', creator_id, booker_name, booker_email,
 *                     message_content, duration, scheduled_at, fan_timezone, amount, provider
 *
 * What it returns:
 *   - 200 JSON for all successfully handled (or safely skipped) events
 *   - 400 JSON for invalid/missing signature
 *   - 500 JSON for unexpected processing errors (Flutterwave will retry)
 *
 * Errors it can produce:
 *   - Signature mismatch → 400 (not retried by Flutterwave)
 *   - Duplicate event (idempotency key collision) → 200 silently skipped
 *   - DB insert failure → 500 (Flutterwave retries after delay)
 */

import {
  verifyFlutterwaveSignature,
  verifyFlutterwaveTransaction,
} from '../_shared/flutterwave.ts';
import { supabase, supabaseUrl, supabaseServiceKey } from '../_shared/supabase.ts';
import {
  sendEmail,
  messageConfirmationEmail,
  newMessageNotificationEmail,
  callBookingConfirmationEmail,
  newCallBookingNotificationEmail,
} from '../_shared/email.ts';
import { createRoom, createMeetingToken } from '../_shared/daily.ts';
import { getAppUrl } from '../_shared/http.ts';

const PLATFORM_FEE_PERCENTAGE = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');

// ── Push helper (fire-and-forget) ─────────────────────────────────────────────

async function sendPushNotification(creatorId: string, title: string, body: string): Promise<void> {
  try {
    const fnUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const internalSecret = Deno.env.get('INTERNAL_SECRET') || '';
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
      },
      body: JSON.stringify({ creator_id: creatorId, title, body, url: '/creator/dashboard' }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[flutterwave-webhook] Push notification failed:', res.status, text);
    }
  } catch (err) {
    console.error('[flutterwave-webhook] Push notification error (non-fatal):', (err as Error).message);
  }
}

// ── Webhook handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Flutterwave v3 sends the raw FLW_SECRET_HASH as the `verif-hash` header.
  const signature = req.headers.get('verif-hash');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing verif-hash header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Timing-safe comparison — reject before reading body if signature is wrong.
  if (!verifyFlutterwaveSignature(signature)) {
    console.error('[flutterwave-webhook] Invalid verif-hash — rejecting request');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = await req.json() as {
    event: string;
    data: {
      id: number;           // Flutterwave's internal numeric transaction ID
      status: string;       // 'successful' | 'failed' | 'pending'
      tx_ref: string;       // our unique reference
      amount: number;       // full currency units (e.g. 10.00 for $10)
      currency: string;
      customer: { email: string };
      meta: Record<string, string> | null;
    };
  };

  // Only process completed charges.
  if (event.event !== 'charge.completed') {
    console.log('[flutterwave-webhook] Ignoring event:', event.event);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: transactionId, status: eventStatus, tx_ref } = event.data;

  if (eventStatus !== 'successful') {
    console.log('[flutterwave-webhook] Non-successful charge status:', eventStatus);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Secondary verification: call Flutterwave's API to confirm the transaction.
  // This prevents replay attacks and ensures the amount is authoritative.
  // IMPORTANT: use the numeric transactionId (data.id), not the tx_ref.
  let verifiedTx: Awaited<ReturnType<typeof verifyFlutterwaveTransaction>>;
  try {
    verifiedTx = await verifyFlutterwaveTransaction(transactionId);
  } catch (err) {
    console.error('[flutterwave-webhook] Transaction verification failed:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Could not verify transaction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (verifiedTx.status !== 'successful') {
    console.log('[flutterwave-webhook] Transaction not successful after verify, status:', verifiedTx.status);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use the Flutterwave-authoritative amount (already converted to integer cents by verifyFlutterwaveTransaction).
  const amountInCents = verifiedTx.amountCents;

  const meta = verifiedTx.meta;
  const { creator_id, message_type, provider } = meta;

  if (!creator_id || provider !== 'flutterwave') {
    console.log('[flutterwave-webhook] Skipping — missing creator_id or not a Flutterwave transaction');
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use tx_ref as the idempotency key — stable, unique, and controlled by us.
  const reference = verifiedTx.txRef || tx_ref;
  const appUrl = getAppUrl();

  // ── Call booking ────────────────────────────────────────────────────────────

  if (meta.type === 'call_booking') {
    const { booker_name, booker_email, message_content, duration, scheduled_at, fan_timezone } = meta;
    const durationMinutes = parseInt(duration || '30', 10);

    // Idempotency: check if booking already created for this reference
    const { data: existingBooking } = await supabase
      .from('call_bookings')
      .select('id')
      .eq('flutterwave_tx_ref', reference)
      .maybeSingle();

    if (existingBooking) {
      console.log('[flutterwave-webhook] Duplicate booking, skipping:', reference);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Daily.co room (non-fatal if it fails)
    let dailyRoomName: string | null = null;
    let dailyRoomUrl: string | null = null;
    let creatorMeetingToken: string | null = null;
    let fanMeetingToken: string | null = null;

    try {
      const { data: creatorForRoom } = await supabase
        .from('creators')
        .select('display_name')
        .eq('id', creator_id)
        .single();

      const creatorName = creatorForRoom?.display_name || 'Creator';
      const room = await createRoom(reference, durationMinutes);
      dailyRoomName = room.name;
      dailyRoomUrl = room.url;
      creatorMeetingToken = await createMeetingToken(room.name, creatorName, true, durationMinutes);
      fanMeetingToken = await createMeetingToken(room.name, booker_name, false, durationMinutes);
    } catch (dailyErr) {
      console.error('[flutterwave-webhook] Daily room creation failed (non-fatal):', (dailyErr as Error).message);
    }

    const { data: booking, error: bookingError } = await supabase
      .from('call_bookings')
      .insert({
        creator_id,
        booker_name,
        booker_email,
        duration: durationMinutes,
        amount_paid: amountInCents,
        status: 'confirmed',
        call_notes: message_content || null,
        flutterwave_tx_ref: reference,
        scheduled_at: scheduled_at || null,
        fan_timezone: fan_timezone || 'UTC',
        daily_room_name: dailyRoomName,
        daily_room_url: dailyRoomUrl,
        creator_meeting_token: creatorMeetingToken,
        fan_meeting_token: fanMeetingToken,
        payout_status: 'held',
      })
      .select()
      .single();

    if (bookingError) {
      if (bookingError.code === '23505') {
        console.log('[flutterwave-webhook] Duplicate booking (23505), skipping:', reference);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[flutterwave-webhook] Error creating call booking:', bookingError);
      throw bookingError;
    }

    console.log('[flutterwave-webhook] Call booking created:', booking.id);

    // Log room creation
    if (dailyRoomName) {
      await supabase.from('call_events').insert({
        booking_id: booking.id,
        event_type: 'room_created',
        actor: 'system',
        metadata: { room_name: dailyRoomName, room_url: dailyRoomUrl },
      });
    }

    const { data: callCreator } = await supabase
      .from('creators')
      .select('display_name, email')
      .eq('id', creator_id)
      .single();

    if (callCreator) {
      const fanToken = booking.fan_access_token as string | undefined;
      const fanJoinUrl = booking.id ? `${appUrl}/call/${booking.id}?role=fan&token=${fanToken}` : undefined;
      const creatorJoinUrl = booking.id ? `${appUrl}/call/${booking.id}?role=creator` : undefined;

      const bookerEmailPayload = callBookingConfirmationEmail({
        bookerName: booker_name,
        creatorName: callCreator.display_name,
        durationMinutes,
        amountCents: amountInCents,
        callJoinUrl: fanJoinUrl,
        scheduledAt: scheduled_at || undefined,
        fanTimezone: fan_timezone || undefined,
      });
      await sendEmail({
        to: booker_email,
        ...bookerEmailPayload,
        idempotencyKey: `${reference}_call_booker`,
      });

      const creatorEmailPayload = newCallBookingNotificationEmail({
        creatorName: callCreator.display_name,
        bookerName: booker_name,
        bookerEmail: booker_email,
        durationMinutes,
        amountCents: amountInCents,
        callNotes: message_content || null,
        scheduledAt: scheduled_at || undefined,
        fanTimezone: fan_timezone || undefined,
        creatorJoinUrl,
      });
      await sendEmail({
        to: callCreator.email,
        ...creatorEmailPayload,
        idempotencyKey: `${reference}_call_creator`,
      });
    }

    void sendPushNotification(
      creator_id,
      '📅 New call booking!',
      `${booker_name} booked a ${durationMinutes}-minute call with you`,
    );

  } else {
    // ── Regular message / support ──────────────────────────────────────────────────

    const { message_content, sender_name, sender_email } = meta;
    const validTypes = ['message', 'call', 'support'];
    const validMessageType = validTypes.includes(message_type) ? message_type : 'message';

    // Idempotency: check if message already created for this reference
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('flutterwave_tx_ref', reference)
      .maybeSingle();

    if (existingMessage) {
      console.log('[flutterwave-webhook] Duplicate message, skipping:', reference);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        creator_id,
        sender_name,
        sender_email,
        message_content,
        amount_paid: amountInCents,
        message_type: validMessageType,
        flutterwave_tx_ref: reference,
      })
      .select('id')
      .single();

    if (messageError) {
      if (messageError.code === '23505') {
        console.log('[flutterwave-webhook] Duplicate message (23505), skipping:', reference);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[flutterwave-webhook] Error creating message:', messageError);
      throw messageError;
    }

    // Record payment analytics — integer cents throughout, no floating point
    const platformFee = Math.round(amountInCents * PLATFORM_FEE_PERCENTAGE / 100);
    const creatorAmount = amountInCents - platformFee;

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        message_id: message.id,
        creator_id,
        flutterwave_tx_ref: reference,
        amount: amountInCents,
        platform_fee: platformFee,
        creator_amount: creatorAmount,
        status: 'completed',
        sender_email,
      });

    if (paymentError) {
      console.error('[flutterwave-webhook] Error creating payment record:', paymentError);
      throw paymentError;
    }

    console.log('[flutterwave-webhook] Message and payment created:', message.id);

    // Emails
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
      await sendEmail({
        to: sender_email,
        ...senderEmailPayload,
        idempotencyKey: `${reference}_msg_sender`,
      });

      const creatorEmailPayload = newMessageNotificationEmail({
        creatorName: msgCreator.display_name,
        senderName: sender_name,
        senderEmail: sender_email,
        messageContent: message_content,
        amountCents: amountInCents,
      });
      await sendEmail({
        to: msgCreator.email,
        ...creatorEmailPayload,
        idempotencyKey: `${reference}_msg_creator`,
      });
    }

    void sendPushNotification(
      creator_id,
      '💬 New paid message!',
      `${sender_name} sent you a paid message`,
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
