/**
 * create-refund Edge Function
 *
 * Issues a full Stripe refund for a paid message or call booking.
 * Only the expert who owns the record can trigger this.
 *
 * Expects:
 *   POST { type: 'message' | 'call_booking', id: string }
 *   Authorization: Bearer <expert JWT>
 *
 * Returns:
 *   { refunded: true, refund_id: string | null }
 *   (refund_id is null for voided authorizations — no charge was ever made)
 *
 * Refund mechanics:
 *
 *   Message payments:
 *     - Full refund on the PaymentIntent with reverse_transfer: true.
 *       This unwinds the destination charge split so the connected account's
 *       balance is also reversed — the platform does not absorb the loss.
 *     - DB: payments.status = 'refunded', payments.refund_id, payments.refunded_at
 *     - DB: messages.refunded_at (denormalised for fast inbox display)
 *
 *   Call booking payments:
 *     - If capture_method = 'manual' AND booking is not yet completed/no_show:
 *         Cancel the PaymentIntent — voids the authorization.
 *         No charge was ever made; client sees nothing on their statement.
 *     - If payment was already captured (status = completed / no_show / in_progress):
 *         Full refund with reverse_transfer: true (same as message flow).
 *     - DB: call_bookings.status = 'refunded', .payout_status = 'refunded',
 *           .refunded_at, .refund_id (null for voids)
 *
 * Errors:
 *   400 — missing / invalid fields
 *   401 — not authenticated
 *   403 — expert doesn't own this record
 *   404 — record not found
 *   409 — already refunded, disputed (cannot refund), or cancelled without charge
 *   500 — Stripe API error
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RefundPayload {
  type: 'message' | 'call_booking';
  id: string;
}

/** Booking statuses that mean the payment was already captured. */
const CAPTURED_STATUSES = ['completed', 'no_show', 'in_progress'] as const;

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Auth ────────────────────────────────────────────────────────
    const authResult = await requireAuth(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    // ── Validate request body ────────────────────────────────────────
    const body: unknown = await req.json();
    if (
      typeof body !== 'object' || body === null ||
      !('type' in body) || !('id' in body)
    ) {
      return jsonError('Missing required fields: type, id', 400, corsHeaders);
    }

    const { type, id } = body as RefundPayload;

    if (type !== 'message' && type !== 'call_booking') {
      return jsonError('Invalid type — must be "message" or "call_booking"', 400, corsHeaders);
    }
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return jsonError('Invalid id', 400, corsHeaders);
    }

    // ── Route to the correct refund path ────────────────────────────
    if (type === 'message') {
      return await refundMessage(id, user.id, corsHeaders);
    } else {
      return await refundCallBooking(id, user.id, corsHeaders);
    }
  } catch (err) {
    console.error('[create-refund] Unhandled error:', err);
    return jsonError('Refund failed. Please try again.', 500, corsHeaders);
  }
});

// ── Message refund ────────────────────────────────────────────────────────────

async function refundMessage(
  messageId: string,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Look up message and verify expert ownership via creator.user_id
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .select('id, creator_id, amount_paid, refunded_at, creators!inner(user_id)')
    .eq('id', messageId)
    .single();

  if (msgErr || !message) {
    return jsonError('Message not found', 404, corsHeaders);
  }

  // Verify ownership
  const ownerUserId = (message.creators as { user_id: string }).user_id;
  if (ownerUserId !== userId) {
    return jsonError('You are not authorized to refund this message', 403, corsHeaders);
  }

  // Already refunded?
  if (message.refunded_at) {
    return jsonError('This message has already been refunded', 409, corsHeaders);
  }

  // Get payment record to retrieve the PaymentIntent ID
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .select('id, stripe_payment_intent_id, status, amount')
    .eq('message_id', messageId)
    .single();

  if (payErr || !payment) {
    return jsonError('Payment record not found for this message', 404, corsHeaders);
  }

  if (payment.status === 'refunded') {
    return jsonError('This payment has already been refunded', 409, corsHeaders);
  }

  if (payment.status === 'disputed') {
    return jsonError(
      'Cannot refund while a chargeback dispute is open. Stripe will handle the refund if the dispute is lost.',
      409,
      corsHeaders,
    );
  }

  if (!payment.stripe_payment_intent_id) {
    return jsonError('No PaymentIntent found — cannot issue refund', 500, corsHeaders);
  }

  // ── Issue Stripe refund ──────────────────────────────────────────
  // reverse_transfer: true unwinds the destination charge — connected account's
  // balance is reversed so the platform does not absorb the loss alone.
  let stripeRefund: { id: string };
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reverse_transfer: true,
      // refund_application_fee defaults to true for full refunds on destination charges
    });
  } catch (stripeErr) {
    const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    console.error('[create-refund] Stripe refund failed (message):', msg);
    return jsonError(`Stripe refund failed: ${msg}`, 500, corsHeaders);
  }

  const now = new Date().toISOString();

  // ── Update DB ────────────────────────────────────────────────────
  const [{ error: paymentUpdateErr }, { error: messageUpdateErr }] = await Promise.all([
    supabase
      .from('payments')
      .update({
        status: 'refunded',
        refund_id: stripeRefund.id,
        refunded_at: now,
      })
      .eq('id', payment.id),
    supabase
      .from('messages')
      .update({ refunded_at: now })
      .eq('id', messageId),
  ]);

  if (paymentUpdateErr) {
    console.error('[create-refund] Failed to update payment record:', paymentUpdateErr);
    // Refund was issued on Stripe — log but don't fail the response.
    // Ops can reconcile from the Stripe dashboard.
  }
  if (messageUpdateErr) {
    console.error('[create-refund] Failed to update message record:', messageUpdateErr);
  }

  console.log('[create-refund] Message refunded:', messageId, 'refund:', stripeRefund.id);

  return jsonOk({ refunded: true, refund_id: stripeRefund.id }, corsHeaders);
}

// ── Call booking refund ───────────────────────────────────────────────────────

async function refundCallBooking(
  bookingId: string,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Look up booking and verify ownership via creator.user_id
  const { data: booking, error: bookErr } = await supabase
    .from('call_bookings')
    .select(
      'id, creator_id, status, payout_status, capture_method, stripe_payment_intent_id, ' +
      'amount_paid, refunded_at, creators!inner(user_id)',
    )
    .eq('id', bookingId)
    .single();

  if (bookErr || !booking) {
    return jsonError('Booking not found', 404, corsHeaders);
  }

  // Verify ownership
  const ownerUserId = (booking.creators as { user_id: string }).user_id;
  if (ownerUserId !== userId) {
    return jsonError('You are not authorized to refund this booking', 403, corsHeaders);
  }

  // Terminal state checks
  if (booking.status === 'refunded' || booking.payout_status === 'refunded') {
    return jsonError('This booking has already been refunded', 409, corsHeaders);
  }

  if (booking.payout_status === 'disputed') {
    return jsonError(
      'Cannot refund while a chargeback dispute is open. Stripe will handle the refund if the dispute is lost.',
      409,
      corsHeaders,
    );
  }

  if (!booking.stripe_payment_intent_id) {
    return jsonError('No PaymentIntent found for this booking', 404, corsHeaders);
  }

  const now = new Date().toISOString();
  const isCaptured = (CAPTURED_STATUSES as readonly string[]).includes(booking.status as string);
  const isManualCapture = booking.capture_method === 'manual';

  // ── Path A: Manual capture, not yet captured → cancel (void authorization) ─
  if (isManualCapture && !isCaptured) {
    try {
      await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      // If already cancelled, treat as success
      if (!msg.includes('already canceled') && !msg.includes('already cancelled')) {
        console.error('[create-refund] PI cancel failed:', msg);
        return jsonError(`Failed to void payment: ${msg}`, 500, corsHeaders);
      }
    }

    const { error: updateErr } = await supabase
      .from('call_bookings')
      .update({
        status: 'refunded',
        payout_status: 'refunded',
        refunded_at: now,
        // refund_id is null — no charge was made, nothing to refund
      })
      .eq('id', bookingId);

    if (updateErr) {
      console.error('[create-refund] Failed to update booking after void:', updateErr);
    }

    console.log('[create-refund] Booking authorization voided:', bookingId);
    return jsonOk({ refunded: true, refund_id: null }, corsHeaders);
  }

  // ── Path B: Payment was captured → issue full refund ─────────────────────
  let stripeRefund: { id: string };
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      reverse_transfer: true,
      // reverse_transfer unwinds the transfer to the expert's connected account.
      // The expert's balance absorbs the reversal — the platform does not pay.
    });
  } catch (stripeErr) {
    const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    console.error('[create-refund] Stripe refund failed (booking):', msg);
    return jsonError(`Stripe refund failed: ${msg}`, 500, corsHeaders);
  }

  const { error: updateErr } = await supabase
    .from('call_bookings')
    .update({
      status: 'refunded',
      payout_status: 'refunded',
      refunded_at: now,
      refund_id: stripeRefund.id,
    })
    .eq('id', bookingId);

  if (updateErr) {
    console.error('[create-refund] Failed to update booking record:', updateErr);
    // Refund was issued — log but don't fail response.
  }

  console.log('[create-refund] Booking refunded:', bookingId, 'refund:', stripeRefund.id);

  return jsonOk({ refunded: true, refund_id: stripeRefund.id }, corsHeaders);
}
