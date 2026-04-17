/**
 * check-no-show Edge Function
 *
 * Called by a scheduled CRON or manually by the system to detect no-shows.
 * Checks confirmed bookings where the call was supposed to happen but
 * one or both parties did not join within the grace period.
 *
 * Can operate on a single booking or scan all overdue bookings.
 *
 * Expects:
 *   POST { booking_id?: string }
 *   - If booking_id provided: checks that specific booking
 *   - If omitted: scans all 'confirmed' bookings past the grace period
 *
 * Architecture: Manual Capture Escrow
 *   - Payments are authorized only (capture_method: 'manual') at checkout.
 *   - No money moves until explicitly captured here.
 *   - Platform NEVER pays refunds from its own funds — only cancels authorizations
 *     or refunds with reverse_transfer for legacy auto-captured payments.
 *
 * No-show rules:
 *   - Grace period: 10 minutes after scheduled time
 *   - Creator no-show: fan joined but creator absent → cancel authorization (full refund)
 *   - Fan no-show: creator joined but fan absent → capture 30% as no-show fee, cancel rest
 *   - Both no-show: neither joined → cancel authorization (full refund)
 *
 * Payout hold:
 *   - Captured payments enter a 7-day hold period before release to expert.
 *
 * Returns:
 *   { processed: number, results: [...] }
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { jsonOk, jsonError } from '../_shared/http.ts';
import { deleteRoom } from '../_shared/daily.ts';
import {
  PAYOUT_HOLD_DAYS,
  COMPLETION_THRESHOLD,
  SHORT_CALL_CHARGE_PERCENT,
  FAN_NO_SHOW_FEE_PERCENT,
  GRACE_PERIOD_MINUTES,
} from '../_shared/constants.ts';

/** Fallback: if no scheduled_at, check bookings older than 24 hours */
const FALLBACK_HOURS = 24;

interface NoShowResult {
  booking_id: string;
  action: 'creator_no_show' | 'fan_no_show' | 'both_no_show' | 'skipped';
  refunded: boolean;
  payout_released: boolean;
  reason: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  // SECURITY: This function triggers refunds and payouts — it must only be callable
  // by the cron scheduler or other internal services, never by external clients.
  // Require the shared INTERNAL_SECRET header (same pattern as send-push-notification).
  const internalSecret = Deno.env.get('INTERNAL_SECRET') || '';
  const providedSecret = req.headers.get('x-internal-secret') || '';
  if (!internalSecret || providedSecret !== internalSecret) {
    console.warn('[check-no-show] Unauthorized access attempt — missing or invalid x-internal-secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const bookingId = (body as { booking_id?: string })?.booking_id;

    // ── Fetch bookings to check ──────────────────────────────────────
    // Check both 'confirmed' (no-show detection) and 'in_progress' (stuck calls
    // where the complete-call function was never invoked — e.g. browser closed).
    let query = supabase
      .from('call_bookings')
      .select('*')
      .eq('payout_status', 'held')
      .in('status', ['confirmed', 'in_progress']);

    if (bookingId) {
      query = query.eq('id', bookingId);
    }

    const { data: bookings, error: fetchError } = await query;

    if (fetchError) {
      console.error('[check-no-show] Fetch error:', fetchError);
      return jsonError('Failed to fetch bookings', 500, corsHeaders);
    }

    if (!bookings || bookings.length === 0) {
      return jsonOk({ processed: 0, results: [], message: 'No bookings to check' }, corsHeaders);
    }

    const now = new Date();
    const results: NoShowResult[] = [];

    for (const booking of bookings) {
      // ── Handle stuck 'in_progress' calls ────────────────────────────
      // These are calls where both parties joined but complete-call was never
      // invoked (e.g. browser closed, network drop, fan left without creator ending).
      // Auto-complete them if they've exceeded their booked duration + grace period.
      if (booking.status === 'in_progress' && booking.call_started_at) {
        const startedAt = new Date(booking.call_started_at);
        const bookedDurationMs = (booking.duration || 30) * 60 * 1000;
        const autoCompleteDeadline = new Date(startedAt.getTime() + bookedDurationMs + GRACE_PERIOD_MINUTES * 60 * 1000);

        if (now < autoCompleteDeadline) {
          results.push({
            booking_id: booking.id,
            action: 'skipped',
            refunded: false,
            payout_released: false,
            reason: `In-progress call not past deadline yet (${autoCompleteDeadline.toISOString()})`,
          });
          continue;
        }

        // Auto-complete the stuck call.
        // Policy: if the call ran for ≥ 30% of booked duration, capture full payment.
        // Below 30% → capture 50% as short-session fee (or partial refund for legacy).
        const actualDurationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
        const bookedDurationSeconds = (booking.duration || 30) * 60;
        const meetsThreshold = actualDurationSeconds >= bookedDurationSeconds * COMPLETION_THRESHOLD;

        const updatePayload: Record<string, unknown> = {
          status: 'completed',
          call_ended_at: now.toISOString(),
          actual_duration_seconds: actualDurationSeconds,
        };

        let payoutReleased = false;
        let autoRefunded = false;
        if (meetsThreshold && booking.stripe_payment_intent_id) {
          // Threshold met — capture payment, hold for 3-day review
          try {
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
            if (pi.status === 'requires_capture') {
              await stripe.paymentIntents.capture(booking.stripe_payment_intent_id);
            }
            // Payment captured (or was already captured in legacy flow)
            const payoutReleaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
            updatePayload.payout_status = 'pending_release';
            updatePayload.payout_release_at = payoutReleaseAt.toISOString();
          } catch (captureErr) {
            console.error(`[check-no-show] Capture failed for booking ${booking.id}:`, (captureErr as Error).message);
          }
        } else if (!meetsThreshold && booking.stripe_payment_intent_id && booking.payout_status === 'held') {
          // Call was too short — capture 50% as short-session fee
          const totalAmount = booking.amount_paid as number;
          const shortSessionFee = Math.round(totalAmount * SHORT_CALL_CHARGE_PERCENT / 100);

          try {
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
            if (pi.status === 'requires_capture') {
              // Manual capture: capture only 50% as short-session fee
              await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, {
                amount_to_capture: shortSessionFee,
              });
              console.log(`[check-no-show] Short session: captured ${shortSessionFee} of ${totalAmount} cents (${SHORT_CALL_CHARGE_PERCENT}%) for booking ${booking.id}`);
            } else if (pi.status === 'succeeded') {
              // Legacy: refund 50% with reverse_transfer, keeping 50% as short-session fee
              const refundAmount = totalAmount - shortSessionFee;
              if (refundAmount > 0) {
                await stripe.refunds.create({
                  payment_intent: booking.stripe_payment_intent_id,
                  amount: refundAmount,
                  reverse_transfer: true,
                  reason: 'requested_by_customer',
                });
              }
              console.log(`[check-no-show] Short session (legacy): refunded ${refundAmount} of ${totalAmount} cents for booking ${booking.id}`);
            }

            // Hold captured fee for 3-day review before releasing to expert
            const payoutReleaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
            updatePayload.payout_status = 'pending_release';
            updatePayload.payout_release_at = payoutReleaseAt.toISOString();
          } catch (captureErr) {
            console.error(`[check-no-show] Short session capture failed for booking ${booking.id}:`, (captureErr as Error).message);
          }
        }

        await supabase
          .from('call_bookings')
          .update(updatePayload)
          .eq('id', booking.id);

        await supabase.from('call_events').insert({
          booking_id: booking.id,
          event_type: 'call_auto_completed',
          actor: 'system',
          metadata: {
            reason: 'stuck_in_progress',
            actual_seconds: actualDurationSeconds,
            booked_seconds: bookedDurationSeconds,
            threshold_percent: COMPLETION_THRESHOLD * 100,
            meets_threshold: meetsThreshold,
            payout_released: payoutReleased,
            refunded: autoRefunded,
          },
        });

        // Clean up Daily room (fire-and-forget)
        if (booking.daily_room_name) {
          void deleteRoom(booking.daily_room_name);
        }

        results.push({
          booking_id: booking.id,
          action: 'skipped', // Re-using type; logged as auto-completed in events
          refunded: autoRefunded,
          payout_released: payoutReleased,
          reason: `Auto-completed stuck in_progress call (${actualDurationSeconds}s / ${bookedDurationSeconds}s, threshold 30%, short_session_fee: ${!meetsThreshold})`,  
        });
        continue;
      }

      // ── Handle 'confirmed' bookings (no-show detection) ─────────────
      // Determine the deadline for joining
      let deadline: Date;

      if (booking.scheduled_at) {
        // Grace period after scheduled time
        deadline = new Date(new Date(booking.scheduled_at).getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
      } else {
        // No scheduled time: use creation + 24h fallback
        deadline = new Date(new Date(booking.created_at).getTime() + FALLBACK_HOURS * 60 * 60 * 1000);
      }

      // Not past deadline yet — skip
      if (now < deadline) {
        results.push({
          booking_id: booking.id,
          action: 'skipped',
          refunded: false,
          payout_released: false,
          reason: `Deadline not reached (${deadline.toISOString()})`,
        });
        continue;
      }

      const creatorJoined = Boolean(booking.creator_joined_at);
      const fanJoined = Boolean(booking.fan_joined_at);

      let action: NoShowResult['action'];
      let refunded = false;
      let payoutReleased = false;
      const updatePayload: Record<string, unknown> = {};

      if (!creatorJoined && fanJoined) {
        // Creator no-show → cancel authorization (fan not charged)
        action = 'creator_no_show';
        updatePayload.status = 'no_show';

        if (booking.stripe_payment_intent_id) {
          try {
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
            if (pi.status === 'requires_capture') {
              // Manual capture: simply cancel the hold
              await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
            } else if (pi.status === 'succeeded') {
              // Legacy: refund with reverse_transfer — platform NEVER pays from own funds
              await stripe.refunds.create({
                payment_intent: booking.stripe_payment_intent_id,
                reverse_transfer: true,
                reason: 'requested_by_customer',
              });
            }
            updatePayload.payout_status = 'refunded';
            updatePayload.refunded_at = now.toISOString();
            refunded = true;
          } catch (refundErr) {
            console.error(`[check-no-show] Refund failed for booking ${booking.id}:`, (refundErr as Error).message);
          }
        }
      } else if (creatorJoined && !fanJoined) {
        // Fan no-show → charge 30% no-show fee, cancel the remaining 70%
        action = 'fan_no_show';
        updatePayload.status = 'no_show';

        if (booking.stripe_payment_intent_id) {
          try {
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
            const totalAmount = booking.amount_paid as number;
            const noShowFee = Math.round(totalAmount * FAN_NO_SHOW_FEE_PERCENT / 100);

            if (pi.status === 'requires_capture') {
              // Manual capture: capture only 30% as no-show fee
              await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, {
                amount_to_capture: noShowFee,
              });
              console.log(`[check-no-show] Fan no-show: captured ${noShowFee} of ${totalAmount} cents (${FAN_NO_SHOW_FEE_PERCENT}%) for booking ${booking.id}`);
            } else if (pi.status === 'succeeded') {
              // Legacy: refund 70% with reverse_transfer, keeping 30% as no-show fee
              const refundAmount = totalAmount - noShowFee;
              if (refundAmount > 0) {
                await stripe.refunds.create({
                  payment_intent: booking.stripe_payment_intent_id,
                  amount: refundAmount,
                  reverse_transfer: true,
                  reason: 'requested_by_customer',
                });
              }
              console.log(`[check-no-show] Fan no-show (legacy): refunded ${refundAmount} of ${totalAmount} cents for booking ${booking.id}`);
            }

            // Hold captured fee for 3-day review before releasing to expert
            const payoutReleaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
            updatePayload.payout_status = 'pending_release';
            updatePayload.payout_release_at = payoutReleaseAt.toISOString();
            payoutReleased = false; // Not released yet — held for 3 days
          } catch (captureErr) {
            console.error(`[check-no-show] Fan no-show fee capture failed for booking ${booking.id}:`, (captureErr as Error).message);
          }
        } else {
          // No Stripe payment (e.g. Flutterwave) — release payout directly
          updatePayload.payout_status = 'released';
          updatePayload.payout_released_at = now.toISOString();
          payoutReleased = true;
        }
      } else if (!creatorJoined && !fanJoined) {
        // Both no-show → cancel authorization (fan not charged)
        action = 'both_no_show';
        updatePayload.status = 'no_show';

        if (booking.stripe_payment_intent_id) {
          try {
            const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
            if (pi.status === 'requires_capture') {
              await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
            } else if (pi.status === 'succeeded') {
              // Legacy: refund with reverse_transfer
              await stripe.refunds.create({
                payment_intent: booking.stripe_payment_intent_id,
                reverse_transfer: true,
                reason: 'requested_by_customer',
              });
            }
            updatePayload.payout_status = 'refunded';
            updatePayload.refunded_at = now.toISOString();
            refunded = true;
          } catch (refundErr) {
            console.error(`[check-no-show] Refund failed for booking ${booking.id}:`, (refundErr as Error).message);
          }
        }
      } else {
        // Both joined but call wasn't completed — skip (complete-call handles this)
        results.push({
          booking_id: booking.id,
          action: 'skipped',
          refunded: false,
          payout_released: false,
          reason: 'Both parties joined — awaiting call completion',
        });
        continue;
      }

      // Apply updates
      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('call_bookings')
          .update(updatePayload)
          .eq('id', booking.id);
      }

      // Log audit event
      const eventType = action === 'creator_no_show' ? 'no_show_creator'
        : action === 'fan_no_show' ? 'no_show_fan'
        : 'no_show_creator'; // both_no_show treated as creator fault for refund purposes

      await supabase.from('call_events').insert({
        booking_id: booking.id,
        event_type: eventType,
        actor: 'system',
        metadata: {
          action,
          creator_joined: creatorJoined,
          fan_joined: fanJoined,
          refunded,
          payout_released: payoutReleased,
        },
      });

      if (refunded) {
        await supabase.from('call_events').insert({
          booking_id: booking.id,
          event_type: 'refund_issued',
          actor: 'system',
          metadata: { reason: action },
        });
      }

      // Clean up Daily room (fire-and-forget)
      if (booking.daily_room_name) {
        void deleteRoom(booking.daily_room_name);
      }

      results.push({
        booking_id: booking.id,
        action,
        refunded,
        payout_released: payoutReleased,
        reason: `${action}: creator_joined=${creatorJoined}, fan_joined=${fanJoined}`,
      });
    }

    return jsonOk({ processed: results.length, results }, corsHeaders);

  } catch (err) {
    console.error('[check-no-show] Error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
