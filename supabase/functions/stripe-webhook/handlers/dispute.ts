/**
 * Dispute Handler
 *
 * Handles Stripe chargeback/dispute lifecycle events fired to our webhook:
 *   charge.dispute.created  → freeze payout immediately, notify expert
 *   charge.dispute.closed   → unfreeze on win; confirm loss on lost/charge_refunded
 *
 * Why we freeze on 'created':
 *   When Stripe opens a dispute, the disputed amount is immediately debited from
 *   the platform balance. If we have already released the payout to the expert's
 *   connected account, we absorb the loss directly. Freezing the payout_status
 *   before it reaches 'released' prevents the release-payout cron from
 *   transferring funds while the dispute is open.
 *
 * What this handler does NOT do:
 *   - Reverse an already-released payout (requires a manual Stripe transfer
 *     reversal or future automation — flagged for ops team review).
 *   - Issue a refund — the client gets their money back through Stripe's own
 *     dispute resolution if the dispute is lost.
 *
 * Lookup strategy:
 *   We match call_bookings and payments by stripe_payment_intent_id.
 *   Both are checked — a given PI belongs to exactly one record.
 *
 * Expects:
 *   dispute: Stripe.Dispute from event.data.object
 *
 * Returns:
 *   { received: true }
 *
 * Errors: all errors are logged but never thrown — Stripe will retry the event.
 */
import { Stripe } from '../../_shared/stripe.ts';
import { supabase } from '../../_shared/supabase.ts';
import { sendPushNotification } from './push-notification.ts';

/** Handle charge.dispute.created — freeze payout + notify expert. */
export async function handleDisputeCreated(
  dispute: Stripe.Dispute,
): Promise<{ received: true }> {
  const paymentIntentId = dispute.payment_intent as string | null;
  if (!paymentIntentId) {
    console.warn('[dispute] charge.dispute.created: no payment_intent on dispute', dispute.id);
    return { received: true };
  }

  const now = new Date().toISOString();
  console.log('[dispute] Freezing payout for dispute:', dispute.id, 'PI:', paymentIntentId);

  // ── Freeze call_booking payout ────────────────────────────────────────────
  // Only update if not already refunded — 'refunded' is a terminal state.
  const { data: frozenBooking } = await supabase
    .from('call_bookings')
    .update({
      payout_status: 'disputed',
      dispute_id: dispute.id,
      dispute_frozen_at: now,
    })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .neq('payout_status', 'refunded')
    .select('id, creator_id, amount_paid')
    .maybeSingle();

  // ── Freeze message payment ────────────────────────────────────────────────
  const { data: frozenPayment } = await supabase
    .from('payments')
    .update({
      status: 'disputed',
      dispute_id: dispute.id,
      dispute_frozen_at: now,
    })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .neq('status', 'refunded')
    .select('id, creator_id, amount')
    .maybeSingle();

  const affected = frozenBooking ?? frozenPayment;
  if (!affected) {
    // May be a Flutterwave payment or an unrecognised PI — log and return 200.
    // Returning 200 prevents Stripe from endlessly retrying an unmatchable event.
    console.warn('[dispute] No matching record found for PI:', paymentIntentId, '— skipping');
    return { received: true };
  }

  console.log(
    '[dispute] Payout frozen:',
    frozenBooking?.id ?? frozenPayment?.id,
    '— dispute:', dispute.id,
  );

  // ── Notify expert ──────────────────────────────────────────────────────────
  // Non-fatal — freeze is more important than the notification.
  const amountDollars = Math.round(
    ((frozenBooking?.amount_paid ?? frozenPayment?.amount ?? 0) as number) / 100,
  );
  try {
    await sendPushNotification(
      affected.creator_id as string,
      '⚠️ Chargeback Alert',
      `A client has opened a payment dispute for $${amountDollars}. Your payout has been frozen pending resolution.`,
    );
  } catch (err) {
    console.error('[dispute] Push notification failed (non-fatal):', (err as Error).message);
  }

  return { received: true };
}

/** Handle charge.dispute.closed — unfreeze on win; mark refunded on loss. */
export async function handleDisputeClosed(
  dispute: Stripe.Dispute,
): Promise<{ received: true }> {
  const paymentIntentId = dispute.payment_intent as string | null;
  if (!paymentIntentId) {
    console.warn('[dispute] charge.dispute.closed: no payment_intent on dispute', dispute.id);
    return { received: true };
  }

  const { status: outcomeStatus } = dispute;
  console.log('[dispute] Dispute closed:', dispute.id, 'outcome:', outcomeStatus);

  if (outcomeStatus === 'won') {
    // ── WON: unfreeze, restore to pending_release so cron can pay expert ───
    const { error: bookingErr } = await supabase
      .from('call_bookings')
      .update({
        payout_status: 'pending_release',
        // Clear freeze timestamp — payout is eligible again.
        // Keep dispute_id for the audit trail.
        dispute_frozen_at: null,
      })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('payout_status', 'disputed');

    const { error: paymentErr } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        dispute_frozen_at: null,
      })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('status', 'disputed');

    if (bookingErr) console.error('[dispute] Failed to unfreeze call_booking:', bookingErr);
    if (paymentErr) console.error('[dispute] Failed to unfreeze payment:', paymentErr);

    console.log('[dispute] Won — payout unfrozen for PI:', paymentIntentId);
  } else if (outcomeStatus === 'lost' || outcomeStatus === 'charge_refunded') {
    // ── LOST / CHARGE REFUNDED: Stripe has already returned money to the client.
    // Mark both records as refunded so nothing else tries to act on them.
    const now = new Date().toISOString();

    const { error: bookingErr } = await supabase
      .from('call_bookings')
      .update({
        payout_status: 'refunded',
        status: 'refunded',
        refunded_at: now,
      })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('payout_status', 'disputed');

    const { error: paymentErr } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refunded_at: now,
      })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('status', 'disputed');

    if (bookingErr) console.error('[dispute] Failed to mark booking refunded:', bookingErr);
    if (paymentErr) console.error('[dispute] Failed to mark payment refunded:', paymentErr);

    console.log('[dispute] Lost — records marked refunded for PI:', paymentIntentId);
  }
  // Other statuses (warning_needs_response, under_review, needs_response):
  // no action needed — wait for the final 'won' or 'lost' outcome.

  return { received: true };
}
