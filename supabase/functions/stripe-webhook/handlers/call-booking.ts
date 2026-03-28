/**
 * Call Booking Handler
 *
 * Processes checkout.session.completed events with metadata.type === 'call_booking'.
 * Creates the call_bookings row, provisions a Daily.co room + scoped tokens,
 * sends confirmation emails, and pushes a notification.
 *
 * Idempotent: duplicate Stripe session IDs are silently ignored (unique constraint).
 */
import { Stripe } from '../../_shared/stripe.ts';
import { supabase } from '../../_shared/supabase.ts';
import {
  sendEmail,
  callBookingConfirmationEmail,
  newCallBookingNotificationEmail,
} from '../../_shared/email.ts';
import { createRoom, createMeetingToken } from '../../_shared/daily.ts';
import { getAppUrl } from '../../_shared/http.ts';
import { generateMagicLink } from '../../_shared/magic-link.ts';
import { sendPushNotification } from './push-notification.ts';

/** Metadata shape expected on call booking checkout sessions. */
interface CallBookingMetadata {
  creator_id: string;
  booker_name: string;
  booker_email: string;
  message_content: string;
  duration: string;
  scheduled_at: string;
  fan_timezone: string;
}

/** Returns a JSON-serialisable response body. */
export async function handleCallBooking(
  session: Stripe.Checkout.Session,
): Promise<{ received: true; duplicate?: true }> {
  const meta = session.metadata as unknown as CallBookingMetadata;
  const {
    creator_id, booker_name, booker_email,
    message_content, duration, scheduled_at, fan_timezone,
  } = meta;

  const amountInCents = session.amount_total || 0;
  const durationMinutes = parseInt(duration);

  // ── Provision Daily.co room + tokens ──────────────────────────────
  const dailyRoom = await provisionDailyRoom(session.id, durationMinutes, creator_id, booker_name);

  // ── Insert booking ────────────────────────────────────────────────
  // Determine capture method from the PaymentIntent status.
  // Manual capture: PI status is 'requires_capture' (authorized only).
  // Automatic capture (legacy): PI status is 'succeeded' (already captured).
  const captureMethod = session.payment_status === 'unpaid' ? 'manual' : 'automatic';

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
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      scheduled_at: scheduled_at || null,
      fan_timezone: fan_timezone || 'UTC',
      daily_room_name: dailyRoom.roomName,
      daily_room_url: dailyRoom.roomUrl,
      creator_meeting_token: dailyRoom.creatorToken,
      fan_meeting_token: dailyRoom.fanToken,
      payout_status: 'held',
      capture_method: captureMethod,
    })
    .select()
    .single();

  if (bookingError) {
    if (bookingError.code === '23505') {
      console.log('[call-booking] Duplicate, skipping:', session.id);
      return { received: true, duplicate: true };
    }
    console.error('[call-booking] Error creating booking:', bookingError);
    throw bookingError;
  }

  console.log('[call-booking] Created:', booking.id);

  // ── Audit trail for room creation ─────────────────────────────────
  if (dailyRoom.roomName) {
    await supabase.from('call_events').insert({
      booking_id: booking.id,
      event_type: 'room_created',
      actor: 'system',
      metadata: { room_name: dailyRoom.roomName, room_url: dailyRoom.roomUrl },
    });
  }

  // ── Emails (non-blocking) ─────────────────────────────────────────
  const { data: creator } = await supabase
    .from('creators')
    .select('display_name, email')
    .eq('id', creator_id)
    .single();

  if (creator) {
    const appUrl = getAppUrl();
    const fanToken = booking.fan_access_token as string;
    const fanJoinUrl = `${appUrl}/call/${booking.id}?role=fan&token=${fanToken}`;
    const creatorJoinUrl = `${appUrl}/call/${booking.id}?role=creator`;

    // 1. Booker confirmation — includes magic-link to client portal
    const portalUrl = await generateMagicLink(booker_email);
    const bookerPayload = callBookingConfirmationEmail({
      bookerName: booker_name,
      creatorName: creator.display_name,
      durationMinutes,
      amountCents: amountInCents,
      callJoinUrl: fanJoinUrl,
      scheduledAt: scheduled_at || undefined,
      fanTimezone: fan_timezone || undefined,
      portalUrl: portalUrl ?? undefined,
    });
    await sendEmail({ to: booker_email, ...bookerPayload, idempotencyKey: `${session.id}_call_booker` });

    // 2. Creator notification
    const creatorPayload = newCallBookingNotificationEmail({
      creatorName: creator.display_name,
      bookerName: booker_name,
      bookerEmail: booker_email,
      durationMinutes,
      amountCents: amountInCents,
      callNotes: message_content || null,
      scheduledAt: scheduled_at || undefined,
      fanTimezone: fan_timezone || undefined,
      creatorJoinUrl,
    });
    await sendEmail({ to: creator.email, ...creatorPayload, idempotencyKey: `${session.id}_call_creator` });
  }

  // 3. Push notification (fire-and-forget)
  void sendPushNotification(
    creator_id,
    '📅 New call booking!',
    `${booker_name} booked a ${durationMinutes}-minute call with you`,
  );

  return { received: true };
}

// ── Daily.co room provisioning (private) ────────────────────────────

interface DailyRoomResult {
  roomName: string | null;
  roomUrl: string | null;
  creatorToken: string | null;
  fanToken: string | null;
}

async function provisionDailyRoom(
  sessionId: string,
  durationMinutes: number,
  creatorId: string,
  bookerName: string,
): Promise<DailyRoomResult> {
  try {
    const { data: creatorRow } = await supabase
      .from('creators')
      .select('display_name')
      .eq('id', creatorId)
      .single();

    const creatorName = creatorRow?.display_name || 'Creator';
    const room = await createRoom(sessionId, durationMinutes);

    const creatorToken = await createMeetingToken(room.name, creatorName, true, durationMinutes);
    const fanToken = await createMeetingToken(room.name, bookerName, false, durationMinutes);

    return { roomName: room.name, roomUrl: room.url, creatorToken, fanToken };
  } catch (err) {
    // Daily room creation is non-fatal — booking still created, room can be re-created later
    console.error('[call-booking] Daily room creation failed (non-fatal):', (err as Error).message);
    return { roomName: null, roomUrl: null, creatorToken: null, fanToken: null };
  }
}
