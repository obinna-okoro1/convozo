/**
 * complete-call Edge Function
 *
 * Called when the video call ends (either by time expiry or manual leave).
 * Computes actual duration, verifies the 30% completion threshold,
 * marks the booking as completed, and releases the creator payout.
 *
 * Expects:
 *   POST { booking_id: string, ended_by: 'creator' | 'fan' | 'system', fan_access_token?: string }
 *   Authorization: Bearer <creator JWT>  — OR —  fan_access_token in body
 *
 * Auth:
 *   - Creator: must provide a valid JWT that matches the booking's creator
 *   - Fan: must provide the fan_access_token issued at booking time
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
 * Payout / refund policy:
 *   > 30% of booked duration → creator payout released, no refund to fan
 *   ≤ 30% of booked duration → fan refunded in full, payout kept held
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { deleteRoom } from '../_shared/daily.ts';

/** Completion threshold: if the call ran for at least 30% of the booked duration,
 *  the creator keeps the payment. Below 30%, the fan is refunded in full. */
const COMPLETION_THRESHOLD = 0.30;

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

    // ── Auth: creator JWT OR fan access token ─────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Creator path: validate JWT and ownership
      const authResult = await requireAuth(req, supabase, corsHeaders);
      if (authResult instanceof Response) return authResult;
      const user = authResult;
      const creatorUserId = (booking.creators as { user_id: string }).user_id;
      if (user.id !== creatorUserId) {
        return jsonError('You are not authorized to complete this call', 403, corsHeaders);
      }
    } else if (fan_access_token) {
      // Fan path: validate the secret token issued at booking time
      const storedToken = booking.fan_access_token as string | null;
      if (!storedToken || fan_access_token !== storedToken) {
        return jsonError('Invalid access token', 403, corsHeaders);
      }
    } else {
      return jsonError('Authentication required', 403, corsHeaders);
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

    if (meetsThreshold && booking.payout_status === 'held') {
      // Call ran for > 30% of booked time — release payout to creator.
      // The payment was already captured with application_fee_amount during checkout;
      // the transfer to the connected account happens automatically via transfer_data.
      updatePayload.payout_status = 'released';
      updatePayload.payout_released_at = now.toISOString();
      payoutReleased = true;
      console.log(`[complete-call] Payout released for booking ${booking_id} (${actualDurationSeconds}s / ${bookedDurationSeconds}s)`);
    } else if (!meetsThreshold) {
      // Call was too short (≤ 30% of booked duration) — refund the fan in full.
      const paymentIntentId = booking.stripe_payment_intent_id as string | null;
      if (paymentIntentId && booking.payout_status === 'held') {
        try {
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer',
          });
          updatePayload.payout_status = 'refunded';
          updatePayload.refunded_at = now.toISOString();
          refunded = true;
          console.log(`[complete-call] Fan refunded — call too short (${actualDurationSeconds}s / ${bookedDurationSeconds}s, threshold 30%)`);
        } catch (refundErr) {
          // Refund failure is logged; payout remains held for manual review
          console.error('[complete-call] Refund error (payout held for review):', (refundErr as Error).message);
        }
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
        payout_released: payoutReleased,
        refunded,
      },
    });

    if (payoutReleased) {
      await supabase.from('call_events').insert({
        booking_id,
        event_type: 'payout_released',
        actor: 'system',
        metadata: { released_at: now.toISOString() },
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
      payout_released: payoutReleased,
      refunded,
    }, corsHeaders);

  } catch (err) {
    console.error('[complete-call] Error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
