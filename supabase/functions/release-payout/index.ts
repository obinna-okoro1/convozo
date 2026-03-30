/**
 * release-payout Edge Function
 *
 * Scans call_bookings for payments that have completed their hold period and
 * transitions them from 'pending_release' to 'released'. Sends a push
 * notification to the expert for each released payout.
 *
 * This function is called by a scheduled cron (hourly via config.toml).
 * It is NOT callable by external clients — all requests must include the
 * INTERNAL_SECRET header set via `supabase secrets set INTERNAL_SECRET=...`.
 *
 * Expects:
 *   POST {} (empty body or any body — ignored)
 *   x-internal-secret: <INTERNAL_SECRET>
 *
 * What it does:
 *   1. Queries all call_bookings where:
 *        payout_status = 'pending_release' AND payout_release_at <= NOW()
 *   2. For each eligible booking, atomically updates:
 *        payout_status = 'released'
 *        payout_released_at = NOW()
 *   3. Fires a push notification to the expert informing them their payout is live.
 *   4. Returns a summary of processed bookings.
 *
 * Returns:
 *   { processed: number, released: string[], errors: string[] }
 *
 * Errors:
 *   401 — missing or invalid x-internal-secret header
 *   500 — unexpected error during scan
 *
 * Idempotency:
 *   Safe to call multiple times — the status check (payout_status = 'pending_release')
 *   prevents double-releasing. If the cron fires twice in the same window, the second
 *   call simply finds no eligible rows and returns { processed: 0 }.
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError } from '../_shared/http.ts';

Deno.serve(async (req) => {
  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  // ── Auth: internal secret guard ──────────────────────────────────────────
  // SECURITY: This function releases payments to experts — it must only be
  // callable by the cron scheduler, never by external clients.
  const internalSecret = Deno.env.get('INTERNAL_SECRET') || '';
  const providedSecret = req.headers.get('x-internal-secret') || '';
  if (!internalSecret || providedSecret !== internalSecret) {
    return jsonError('Unauthorized', 401, corsHeaders);
  }

  try {
    const now = new Date().toISOString();

    // ── Fetch all bookings ready for release ─────────────────────────────
    const { data: eligibleBookings, error: fetchError } = await supabase
      .from('call_bookings')
      .select(`
        id,
        amount_paid,
        payout_status,
        payout_release_at,
        creators!inner (
          id,
          user_id,
          display_name
        )
      `)
      .eq('payout_status', 'pending_release')
      .lte('payout_release_at', now);

    if (fetchError) {
      console.error('[release-payout] Failed to fetch eligible bookings:', fetchError);
      return jsonError('Failed to scan bookings', 500, corsHeaders);
    }

    if (!eligibleBookings || eligibleBookings.length === 0) {
      return jsonOk({ processed: 0, released: [], errors: [] }, corsHeaders);
    }

    const released: string[] = [];
    const errors: string[] = [];

    // ── Process each booking ─────────────────────────────────────────────
    for (const booking of eligibleBookings) {
      const bookingId = booking.id as string;
      const amountPaid = booking.amount_paid as number;
      const creator = booking.creators as { id: string; user_id: string; display_name: string };

      // Atomically mark as released — the WHERE clause on payout_status ensures
      // we don't double-release if this function is called concurrently.
      const { error: updateError } = await supabase
        .from('call_bookings')
        .update({
          payout_status: 'released',
          payout_released_at: now,
        })
        .eq('id', bookingId)
        .eq('payout_status', 'pending_release'); // extra guard against races

      if (updateError) {
        console.error(`[release-payout] Failed to update booking ${bookingId}:`, updateError);
        errors.push(bookingId);
        continue;
      }

      released.push(bookingId);

      // ── Notify the expert ──────────────────────────────────────────────
      // Fire-and-forget — a notification failure must not block the release.
      const expertAmount = amountPaid - Math.round(amountPaid * 22 / 100);
      const formattedAmount = (expertAmount / 100).toFixed(2);

      supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: creator.user_id,
          title: 'Payout released 💸',
          body: `$${formattedAmount} has been released to your account.`,
          data: { type: 'payout_released', booking_id: bookingId },
        },
      }).catch((err: unknown) => {
        console.warn(`[release-payout] Push notification failed for booking ${bookingId}:`, err);
      });
    }

    console.log(`[release-payout] Released ${released.length} payouts, ${errors.length} errors.`);

    return jsonOk(
      { processed: eligibleBookings.length, released, errors },
      corsHeaders,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[release-payout] Unhandled error:', message);
    return jsonError('Internal server error', 500, corsHeaders);
  }
});
