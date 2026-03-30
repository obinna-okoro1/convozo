/**
 * complete-call Edge Function
 *
 * Called when the video call ends (either by time expiry or manual leave).
 * Computes actual duration, verifies the 30% completion threshold,
 * marks the booking as completed, and captures or cancels the payment.
 *
 * Architecture: Manual Capture Escrow
 *   - At checkout, payments are authorized only (capture_method: 'manual').
 *   - No money moves until this function explicitly captures the PaymentIntent.
 *   - If the call fails the threshold, the authorization is cancelled — no refund needed.
 *   - The platform NEVER pays from its own funds.
 *
 * Expects:
 *   POST { booking_id: string, ended_by: 'creator' | 'fan' | 'system', fan_access_token?: string }
 *   Authorization: Bearer <creator JWT>  — OR —  fan_access_token in body
 *
 * Auth:
 *   - Fan: provides fan_access_token in the body (checked FIRST — the Supabase
 *     JS SDK always sends an Authorization header, even for anon users)
 *   - Creator: must provide a valid JWT that matches the booking's creator
 *   Either path triggers full call completion. If both parties race to call this
 *   simultaneously, the second caller receives 409 (already completed) — harmless.
 *
 * Returns:
 *   { status: 'completed', actual_duration_seconds: number, payout_released: boolean }
 *
 * Errors:
 *   400 — missing fields, call never started
 *   404 — booking not found
 *   403 — unauthorized (bad JWT or wrong/missing fan_access_token)
 *   409 — already completed/cancelled/refunded
 *
 * Payout / capture policy:
 *   ≥ 30% of booked duration → capture full payment, payout held for 7-day review period
 *   < 30% of booked duration → capture 50% of payment as short-session fee, hold for 7-day review
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { deleteRoom } from '../_shared/daily.ts';
import { PAYOUT_HOLD_DAYS, COMPLETION_THRESHOLD, SHORT_CALL_CHARGE_PERCENT } from '../_shared/constants.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body: unknown = await req.json();

    if (
      typeof body !== 'object' || body === null ||
      !('booking_id' in body)
    ) {
      return jsonError('Missing required field: booking_id', 400, corsHeaders);
    }

    const { booking_id, ended_by, fan_access_token } = body as {
      booking_id: string;
      ended_by?: string;
      fan_access_token?: string;
    };
    const actor = ended_by === 'fan' ? 'fan' : ended_by === 'system' ? 'system' : 'creator';

    // ── Fetch booking first (needed for both auth paths) ─────────────
    const { data: booking, error: bookingError } = await supabase
      .from('call_bookings')
      .select('*, creators!inner(user_id, display_name, stripe_accounts(stripe_account_id))')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return jsonError('Booking not found', 404, corsHeaders);
    }

    // ── Auth: fan access token OR creator JWT ──────────────────────────
    // Check fan_access_token FIRST because the Supabase JS SDK always sends
    // an Authorization header (with the anon key) even for unauthenticated
    // users. If we checked the header first, fans would always hit the
    // creator JWT path and fail with 401.
    if (fan_access_token) {
      // Fan path: validate the secret token issued at booking time
      const storedToken = booking.fan_access_token as string | null;
      if (!storedToken || fan_access_token !== storedToken) {
        return jsonError('Invalid access token', 403, corsHeaders);
      }
    } else {
      // Creator path: validate JWT and ownership
      const authResult = await requireAuth(req, supabase, corsHeaders);
      if (authResult instanceof Response) return authResult;
      const user = authResult;
      const creatorUserId = (booking.creators as { user_id: string }).user_id;
      if (user.id !== creatorUserId) {
        return jsonError('You are not authorized to complete this call', 403, corsHeaders);
      }
    }

    // Block if already terminal
    const terminalStatuses = ['completed', 'cancelled', 'refunded', 'no_show'];
    if (terminalStatuses.includes(booking.status as string)) {
      return jsonError(`Booking is already ${booking.status}`, 409, corsHeaders);
    }

    // Call must have started to be completed
    if (!booking.call_started_at) {
      return jsonError('Call has not started yet — cannot complete', 400, corsHeaders);
    }

    // ── Compute actual duration ────────────────────────────────────────
    const now = new Date();
    const startedAt = new Date(booking.call_started_at as string);
    const actualDurationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    const bookedDurationSeconds = (booking.duration as number) * 60;

    // Check completion threshold (30%): call must run for at least 30% of booked duration
    // for the creator to keep the payment. Below 30% → fan is refunded.
    const meetsThreshold = actualDurationSeconds >= bookedDurationSeconds * COMPLETION_THRESHOLD;

    // ── Update booking ──────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      call_ended_at: now.toISOString(),
      actual_duration_seconds: actualDurationSeconds,
      status: 'completed',
    };

    let payoutReleased = false;
    let refunded = false;
    let captured = false;

    const paymentIntentId = booking.stripe_payment_intent_id as string | null;

    if (meetsThreshold && paymentIntentId) {
      // Call ran for ≥ 30% of booked time — capture the payment.
      // The transfer_data + application_fee_amount set at checkout will execute automatically
      // on capture. Payout is held for a 3-day review period before release.
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (pi.status === 'requires_capture') {
          // Manual capture flow (new bookings): capture the authorized payment
          await stripe.paymentIntents.capture(paymentIntentId);
          captured = true;
          console.log(`[complete-call] Payment captured for booking ${booking_id} (${actualDurationSeconds}s / ${bookedDurationSeconds}s)`);
        } else if (pi.status === 'succeeded') {
          // Legacy flow (old bookings created before manual capture migration):
          // payment was auto-captured at checkout. Nothing to capture.
          captured = true;
          console.log(`[complete-call] Payment already captured (legacy) for booking ${booking_id}`);
        }
      } catch (captureErr) {
        console.error('[complete-call] Capture error:', (captureErr as Error).message);
      }

      // Payout held for 3-day review period — a separate cron job releases it
      const payoutReleaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      updatePayload.payout_status = 'pending_release';
      updatePayload.payout_release_at = payoutReleaseAt.toISOString();
      console.log(`[complete-call] Payout pending release at ${payoutReleaseAt.toISOString()} for booking ${booking_id}`);
    } else if (!meetsThreshold && paymentIntentId) {
      // Call was too short (< 30% of booked duration) — charge 50% short-session fee
      const totalAmount = booking.amount_paid as number;
      const shortSessionFee = Math.round(totalAmount * SHORT_CALL_CHARGE_PERCENT / 100);

      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (pi.status === 'requires_capture') {
          // Manual capture flow: capture only 50% as short-session fee
          await stripe.paymentIntents.capture(paymentIntentId, {
            amount_to_capture: shortSessionFee,
          });
          captured = true;
          console.log(`[complete-call] Short session: captured ${shortSessionFee} of ${totalAmount} cents (${SHORT_CALL_CHARGE_PERCENT}%) for booking ${booking_id} (${actualDurationSeconds}s / ${bookedDurationSeconds}s, threshold 30%)`);
        } else if (pi.status === 'succeeded') {
          // Legacy flow: payment was already captured in full. Refund 50% with reverse_transfer.
          // Platform NEVER pays from its own funds.
          const refundAmount = totalAmount - shortSessionFee;
          if (refundAmount > 0) {
            await stripe.refunds.create({
              payment_intent: paymentIntentId,
              amount: refundAmount,
              reverse_transfer: true,
              reason: 'requested_by_customer',
            });
          }
          captured = true;
          console.log(`[complete-call] Legacy short session: refunded ${refundAmount} of ${totalAmount} cents, kept ${shortSessionFee} (${SHORT_CALL_CHARGE_PERCENT}%) for booking ${booking_id}`);
        }

        // Hold captured fee for 3-day review period before releasing to expert
        const payoutReleaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
        updatePayload.payout_status = 'pending_release';
        updatePayload.payout_release_at = payoutReleaseAt.toISOString();
        console.log(`[complete-call] Short session payout pending release at ${payoutReleaseAt.toISOString()} for booking ${booking_id}`);
      } catch (captureErr) {
        // Capture/refund failure is logged; payout remains held for manual review
        console.error('[complete-call] Short session capture error (payout held for review):', (captureErr as Error).message);
      }
    }

    await supabase
      .from('call_bookings')
      .update(updatePayload)
      .eq('id', booking_id);

    // ── Audit events ──────────────────────────────────────────────────
    await supabase.from('call_events').insert({
      booking_id,
      event_type: 'call_ended',
      actor,
      metadata: { ended_at: now.toISOString(), actual_duration_seconds: actualDurationSeconds },
    });

    await supabase.from('call_events').insert({
      booking_id,
      event_type: 'call_completed',
      actor: 'system',
      metadata: {
        meets_threshold: meetsThreshold,
        threshold_percent: COMPLETION_THRESHOLD * 100,
        actual_seconds: actualDurationSeconds,
        booked_seconds: bookedDurationSeconds,
        captured,
        payout_released: payoutReleased,
        refunded,
      },
    });

    if (captured && !payoutReleased) {
      await supabase.from('call_events').insert({
        booking_id,
        event_type: 'payout_pending_release',
        actor: 'system',
        metadata: { hold_days: PAYOUT_HOLD_DAYS, release_at: updatePayload.payout_release_at },
      });
    }

    if (refunded) {
      await supabase.from('call_events').insert({
        booking_id,
        event_type: 'refund_issued',
        actor: 'system',
        metadata: { reason: 'call_too_short', threshold_percent: COMPLETION_THRESHOLD * 100 },
      });
    }

    // ── Cleanup: delete Daily room (fire-and-forget) ──────────────────
    if (booking.daily_room_name) {
      void deleteRoom(booking.daily_room_name as string);
    }

    return jsonOk({
      status: 'completed',
      actual_duration_seconds: actualDurationSeconds,
      booked_duration_seconds: bookedDurationSeconds,
      meets_threshold: meetsThreshold,
      captured,
      payout_released: payoutReleased,
      refunded,
    }, corsHeaders);

  } catch (err) {
    console.error('[complete-call] Error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
