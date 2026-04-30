/**
 * verify-physical-meeting Edge Function
 *
 * Called by the expert via their Convozo dashboard after an in-person session.
 * The client shows their confirmation-email CVZ code to the expert, who types
 * it in to confirm the meeting took place and trigger the 7-day payout hold.
 *
 * This replaces the automatic video-call completion flow (complete-call) for
 * physical (session_type === 'physical') bookings.
 *
 * Expects:
 *   POST { booking_id: string, verification_code: string }
 *   Authorization: Bearer <creator JWT>
 *
 * Validates:
 *   - Booking belongs to the authenticated creator
 *   - session_type === 'physical'
 *   - status === 'confirmed'
 *   - verification_code matches stored code (case-insensitive, dashes/spaces stripped)
 *
 * On success:
 *   - Captures the Stripe PaymentIntent in full (no threshold check — physical
 *     sessions cannot be partially measured; code possession proves attendance)
 *   - Sets status = 'completed', payout_status = 'pending_release',
 *     payout_release_at = NOW() + 7 days,
 *     actual_duration_seconds = booking.duration * 60 (full booked duration)
 *   - Nulls out meeting_verification_code (single-use; prevents replay)
 *   - Inserts call_events audit rows
 *
 * Returns:
 *   { status: 'completed', booking_id: string }
 *
 * Errors:
 *   400 — missing fields, wrong session_type
 *   401 — missing/invalid creator JWT
 *   403 — booking does not belong to this creator
 *   404 — booking not found
 *   409 — booking already terminal (completed / cancelled / no_show / refunded)
 *   422 — verification code does not match
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { PAYOUT_HOLD_DAYS } from '../_shared/constants.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Parse & validate request body ────────────────────────────────────
    const body: unknown = await req.json();

    if (
      typeof body !== 'object' || body === null ||
      !('booking_id' in body) ||
      !('verification_code' in body)
    ) {
      return jsonError('Missing required fields: booking_id, verification_code', 400, corsHeaders);
    }

    const { booking_id, verification_code } = body as {
      booking_id: string;
      verification_code: string;
    };

    if (typeof booking_id !== 'string' || !booking_id.trim()) {
      return jsonError('booking_id must be a non-empty string', 400, corsHeaders);
    }
    if (typeof verification_code !== 'string' || !verification_code.trim()) {
      return jsonError('verification_code must be a non-empty string', 400, corsHeaders);
    }

    // Normalise: strip dashes and spaces, uppercase — so 'CVZ-1A2B-3C4D-5E6F'
    // and 'CVZ1A2B3C4D5E6F' both match the stored value.
    const normalisedCode = verification_code.replace(/[-\s]/g, '').toUpperCase();

    // ── Auth: creator JWT required ────────────────────────────────────────
    const authResult = await requireAuth(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    // ── Fetch booking ─────────────────────────────────────────────────────
    const { data: booking, error: bookingError } = await supabase
      .from('call_bookings')
      .select('*, creators!inner(user_id, display_name, stripe_accounts(stripe_account_id))')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return jsonError('Booking not found', 404, corsHeaders);
    }

    // ── Verify creator ownership ──────────────────────────────────────────
    const creatorUserId = (booking.creators as { user_id: string }).user_id;
    if (user.id !== creatorUserId) {
      return jsonError('You are not authorised to verify this booking', 403, corsHeaders);
    }

    // ── Enforce session type ──────────────────────────────────────────────
    if (booking.session_type !== 'physical') {
      return jsonError(
        'This booking is an online session — use the video call flow instead',
        400,
        corsHeaders,
      );
    }

    // ── Block if already terminal ─────────────────────────────────────────
    const terminalStatuses = ['completed', 'cancelled', 'refunded', 'no_show'];
    if (terminalStatuses.includes(booking.status as string)) {
      return jsonError(`Booking is already ${booking.status}`, 409, corsHeaders);
    }

    // ── Validate verification code ────────────────────────────────────────
    const storedCode = booking.meeting_verification_code as string | null;

    if (!storedCode) {
      // Code was already consumed or was never generated (legacy row).
      return jsonError(
        'Verification code has already been used or is not available for this booking',
        409,
        corsHeaders,
      );
    }

    const normalisedStored = storedCode.replace(/[-\s]/g, '').toUpperCase();

    if (normalisedCode !== normalisedStored) {
      console.warn(`[verify-physical-meeting] Code mismatch for booking ${booking_id}`);
      return jsonError('Verification code is incorrect', 422, corsHeaders);
    }

    // ── Capture Stripe PaymentIntent ──────────────────────────────────────
    const paymentIntentId = booking.stripe_payment_intent_id as string | null;
    let captured = false;

    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (pi.status === 'requires_capture') {
          // Standard flow: authorized at checkout, capture full amount now.
          await stripe.paymentIntents.capture(paymentIntentId);
          captured = true;
          console.log(`[verify-physical-meeting] Payment captured for booking ${booking_id}`);
        } else if (pi.status === 'succeeded') {
          // Legacy automatic-capture booking — already captured at checkout.
          captured = true;
          console.log(`[verify-physical-meeting] Payment already captured (legacy) for booking ${booking_id}`);
        } else {
          console.warn(
            `[verify-physical-meeting] Unexpected PI status '${pi.status}' for booking ${booking_id} — payout held for manual review`,
          );
        }
      } catch (captureErr) {
        // Capture failure is logged; payout stays 'held' for manual review.
        // We still mark the booking completed so the expert knows it was confirmed.
        console.error('[verify-physical-meeting] Stripe capture error:', (captureErr as Error).message);
      }
    }

    // ── Update booking ────────────────────────────────────────────────────
    const now = new Date();
    const payoutReleaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
    const actualDurationSeconds = (booking.duration as number) * 60; // full booked duration

    const { error: updateError } = await supabase
      .from('call_bookings')
      .update({
        status: 'completed',
        actual_duration_seconds: actualDurationSeconds,
        call_started_at: booking.scheduled_at ?? now.toISOString(), // best-effort
        call_ended_at: now.toISOString(),
        payout_status: captured ? 'pending_release' : 'held',
        payout_release_at: captured ? payoutReleaseAt.toISOString() : null,
        // Null out the code — single-use; prevents replay attacks.
        meeting_verification_code: null,
      })
      .eq('id', booking_id);

    if (updateError) {
      console.error('[verify-physical-meeting] Update error:', updateError);
      return jsonError('Failed to update booking', 500, corsHeaders);
    }

    // ── Audit trail ───────────────────────────────────────────────────────
    await supabase.from('call_events').insert({
      booking_id,
      event_type: 'call_completed',
      actor: 'creator',
      metadata: {
        method: 'physical_verification_code',
        captured,
        actual_duration_seconds: actualDurationSeconds,
      },
    });

    if (captured) {
      await supabase.from('call_events').insert({
        booking_id,
        event_type: 'payout_pending_release',
        actor: 'system',
        metadata: {
          hold_days: PAYOUT_HOLD_DAYS,
          release_at: payoutReleaseAt.toISOString(),
        },
      });
    }

    console.log(`[verify-physical-meeting] Booking ${booking_id} verified and completed`);

    return jsonOk({ status: 'completed', booking_id }, corsHeaders);
  } catch (err) {
    console.error('[verify-physical-meeting] Unhandled error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
