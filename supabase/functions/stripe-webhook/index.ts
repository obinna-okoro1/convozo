/**
 * Stripe Webhook — Entry Point (v3)
 *
 * Thin dispatcher that verifies the Stripe signature, checks idempotency,
 * and routes to the appropriate handler based on session metadata.type.
 *
 * Handlers:
 *   - shop        → handlers/shop-order.ts
 *   - call_booking → handlers/call-booking.ts
 *   - (default)    → handlers/message-payment.ts
 */
import { stripe, Stripe, stripeCryptoProvider } from '../_shared/stripe.ts';
import { supabase } from '../_shared/supabase.ts';
import { handleShopOrder } from './handlers/shop-order.ts';
import { handleCallBooking } from './handlers/call-booking.ts';
import { handleMessagePayment } from './handlers/message-payment.ts';

/** JSON response helper. */
function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

  if (!signature) {
    return jsonResponse({ error: 'No signature' }, 400);
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      stripeCryptoProvider,
    );

    if (event.type !== 'checkout.session.completed') {
      return jsonResponse({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Rule: never process a session that has not been fully paid.
    if (session.payment_status !== 'paid') {
      console.log('[webhook] Skipping unpaid session:', session.id, session.payment_status);
      return jsonResponse({ received: true, skipped: true });
    }

    // ── Global idempotency check (all three tables) ─────────────────
    const [{ data: existingPayment }, { data: existingBooking }, { data: existingMessage }] = await Promise.all([
      supabase.from('payments').select('id').eq('stripe_session_id', session.id).maybeSingle(),
      supabase.from('call_bookings').select('id').eq('stripe_session_id', session.id).maybeSingle(),
      supabase.from('messages').select('id').eq('stripe_session_id', session.id).maybeSingle(),
    ]);

    if (existingPayment || existingBooking || existingMessage) {
      console.log('[webhook] Already processed, skipping:', session.id);
      return jsonResponse({ received: true, skipped: true });
    }

    // ── Route to handler based on metadata.type ─────────────────────
    const paymentType = session.metadata?.type;
    let result: { received: true; duplicate?: true };

    if (paymentType === 'shop') {
      result = await handleShopOrder(session);
    } else if (paymentType === 'call_booking') {
      result = await handleCallBooking(session);
    } else {
      result = await handleMessagePayment(session);
    }

    return jsonResponse(result);
  } catch (err) {
    console.error('[webhook] Error:', err);
    return jsonResponse({ error: 'Webhook processing failed' }, 400);
  }
});

