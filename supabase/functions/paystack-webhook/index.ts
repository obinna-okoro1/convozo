/**
 * paystack-webhook
 *
 * Handles incoming Paystack webhook events for Convozo.
 *
 * What it does:
 *   - Verifies the x-paystack-signature header using HMAC-SHA512
 *   - Handles the `charge.success` event
 *   - Performs a secondary verify call to Paystack to confirm the payment
 *   - Inserts the message or call booking record
 *   - Sends confirmation emails to the fan and notification emails to the creator
 *   - Triggers push notifications (fire-and-forget)
 *
 * What it expects:
 *   - POST request from Paystack with a valid x-paystack-signature header
 *   - Metadata embedded in the transaction at checkout time:
 *       For messages: creator_id, message_content, sender_name, sender_email, message_type, amount
 *       For calls:    type='call_booking', creator_id, booker_name, booker_email,
 *                     message_content, duration, scheduled_at, fan_timezone, amount
 *
 * What it returns:
 *   - 200 JSON for all successfully handled (or safely skipped) events
 *   - 400 JSON for invalid signature or missing data
 *   - 500 JSON for unexpected processing errors (Paystack will retry)
 *
 * Errors it can produce:
 *   - Signature mismatch → 400 (not retried by Paystack)
 *   - Duplicate event (idempotency key collision) → 200 silently skipped
 *   - DB insert failure → 500 (Paystack retries after delay)
 */

import {
  verifyPaystackSignature,
  verifyPaystackTransaction,
} from '../_shared/paystack.ts';
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
      console.error('[paystack-webhook] Push notification failed:', res.status, text);
    }
  } catch (err) {
    console.error('[paystack-webhook] Push notification error (non-fatal):', (err as Error).message);
  }
}

// ── Metadata extractor ────────────────────────────────────────────────────────

/**
 * Paystack embeds metadata as custom_fields array.
 * Convert it to a plain key→value object for easy access.
 */
function extractMetadata(
  customFields?: Array<{ variable_name: string; value: string }>,
): Record<string, string> {
  if (!customFields) return {};
  const result: Record<string, string> = {};
  for (const field of customFields) {
    result[field.variable_name] = field.value;
  }
  return result;
}

// ── Webhook handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const signature = req.headers.get('x-paystack-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing x-paystack-signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Read raw body bytes — must remain unmodified for signature verification.
  const rawBody = new Uint8Array(await req.arrayBuffer());

  // Verify signature before trusting any payload content.
  const isValid = await verifyPaystackSignature(rawBody, signature);
  if (!isValid) {
    console.error('[paystack-webhook] Invalid signature — rejecting request');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = JSON.parse(new TextDecoder().decode(rawBody)) as {
    event: string;
    data: {
      status: string;
      reference: string;
      amount: number;
      currency: string;
      customer: { email: string };
      metadata: {
        custom_fields?: Array<{ variable_name: string; value: string }>;
      };
    };
  };

  // Only process successful charges.
  if (event.event !== 'charge.success') {
    console.log('[paystack-webhook] Ignoring event:', event.event);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { reference, amount: rawAmount, metadata } = event.data;

  // Additional safety: verify the transaction with Paystack's API directly.
  // This prevents replay attacks and ensures the amount is authoritative.
  let verifiedTx: Awaited<ReturnType<typeof verifyPaystackTransaction>>;
  try {
    verifiedTx = await verifyPaystackTransaction(reference);
  } catch (err) {
    console.error('[paystack-webhook] Transaction verification failed:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Could not verify transaction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (verifiedTx.status !== 'success') {
    console.log('[paystack-webhook] Transaction not successful, status:', verifiedTx.status);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use the Paystack-authoritative amount, not metadata.
  const amountInCents = verifiedTx.amount; // Paystack amount is already in subunits

  const meta = extractMetadata(metadata?.custom_fields);
  const { creator_id, message_type, provider } = meta;

  if (!creator_id || provider !== 'paystack') {
    console.log('[paystack-webhook] Skipping — missing creator_id or not a Paystack transaction');
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appUrl = getAppUrl();

  // ── Call booking ────────────────────────────────────────────────────────────

  if (meta.type === 'call_booking') {
    const { booker_name, booker_email, message_content, duration, scheduled_at, fan_timezone } = meta;
    const durationMinutes = parseInt(duration || '30');

    // Idempotency: check if booking already created for this reference
    const { data: existingBooking } = await supabase
      .from('call_bookings')
      .select('id')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (existingBooking) {
      console.log('[paystack-webhook] Duplicate booking, skipping:', reference);
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
      console.error('[paystack-webhook] Daily room creation failed (non-fatal):', (dailyErr as Error).message);
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
        // Store Paystack reference so we can detect duplicates on webhook retries
        paystack_reference: reference,
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
        console.log('[paystack-webhook] Duplicate booking (23505), skipping:', reference);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[paystack-webhook] Error creating call booking:', bookingError);
      throw bookingError;
    }

    console.log('[paystack-webhook] Call booking created:', booking.id);

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
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (existingMessage) {
      console.log('[paystack-webhook] Duplicate message, skipping:', reference);
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
        paystack_reference: reference,
      })
      .select('id')
      .single();

    if (messageError) {
      if (messageError.code === '23505') {
        console.log('[paystack-webhook] Duplicate message (23505), skipping:', reference);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('[paystack-webhook] Error creating message:', messageError);
      throw messageError;
    }

    // Record payment analytics
    const platformFee = Math.round(amountInCents * PLATFORM_FEE_PERCENTAGE / 100);
    const creatorAmount = amountInCents - platformFee;

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        message_id: message.id,
        creator_id,
        paystack_reference: reference,
        amount: amountInCents,
        platform_fee: platformFee,
        creator_amount: creatorAmount,
        status: 'completed',
        sender_email,
      });

    if (paymentError) {
      console.error('[paystack-webhook] Error creating payment record:', paymentError);
      throw paymentError;
    }

    console.log('[paystack-webhook] Message and payment created:', message.id);

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
