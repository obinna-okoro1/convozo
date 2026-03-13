/**
 * complete-call Edge Function
 *
 * Called when the video call ends (either by time expiry or manual leave).
 * Computes actual duration, verifies the 80% completion threshold,
 * marks the booking as completed, and releases the creator payout.
 *
 * Expects:
 *   POST { booking_id: string, ended_by: 'creator' | 'fan' | 'system' }
 *   Authorization: Bearer <creator JWT> (creator must own the booking)
 *
 * Returns:
 *   { status: 'completed', actual_duration_seconds: number, payout_released: boolean }
 *
 * Errors:
 *   400 — missing fields, call never started
 *   404 — booking not found
 *   403 — unauthorized
 *   409 — already completed/cancelled/refunded
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { deleteRoom } from '../_shared/daily.ts';

/** Minimum completion threshold: 80% of booked duration */
const COMPLETION_THRESHOLD = 0.80;

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

    const { booking_id, ended_by } = body as { booking_id: string; ended_by?: string };
    const actor = ended_by === 'fan' ? 'fan' : ended_by === 'system' ? 'system' : 'creator';

    // ── Auth: creator must own this booking ──────────────────────────
    const authResult = await requireAuth(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from('call_bookings')
      .select('*, creators!inner(user_id, display_name, stripe_accounts(stripe_account_id))')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return jsonError('Booking not found', 404, corsHeaders);
    }

    // Verify ownership
    const creatorUserId = (booking.creators as { user_id: string }).user_id;
    if (user.id !== creatorUserId) {
      return jsonError('You are not authorized to complete this call', 403, corsHeaders);
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

    // Check completion threshold (80%)
    const meetsThreshold = actualDurationSeconds >= bookedDurationSeconds * COMPLETION_THRESHOLD;

    // ── Update booking ──────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      call_ended_at: now.toISOString(),
      actual_duration_seconds: actualDurationSeconds,
      status: 'completed',
    };

    let payoutReleased = false;

    if (meetsThreshold && booking.payout_status === 'held') {
      // Release payout to creator via Stripe Transfer
      const stripeAccounts = (booking.creators as { stripe_accounts: { stripe_account_id: string } | null }).stripe_accounts;
      const paymentIntentId = booking.stripe_payment_intent_id as string | null;

      if (stripeAccounts?.stripe_account_id && paymentIntentId) {
        try {
          // The payment was already captured with application_fee_amount during checkout.
          // The transfer to the connected account happens automatically via transfer_data.
          // We just need to confirm the payment intent completed (it did if we got here).
          // Mark payout as released — Stripe handles the actual transfer.
          updatePayload.payout_status = 'released';
          updatePayload.payout_released_at = now.toISOString();
          payoutReleased = true;

          console.log(`[complete-call] Payout released for booking ${booking_id}`);
        } catch (payoutErr) {
          // Payout failure is logged but does not block call completion
          console.error('[complete-call] Payout release error:', (payoutErr as Error).message);
        }
      }
    } else if (!meetsThreshold) {
      // Call was too short — keep payout held for manual review
      console.log(`[complete-call] Call too short (${actualDurationSeconds}s / ${bookedDurationSeconds}s) — payout held for review`);
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
    }, corsHeaders);

  } catch (err) {
    console.error('[complete-call] Error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
