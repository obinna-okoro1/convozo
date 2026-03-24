/**
 * Shop Order Handler
 *
 * Processes checkout.session.completed events with metadata.type === 'shop'.
 * Creates the shop_orders row, sends buyer/creator emails, and pushes a notification.
 *
 * Idempotent: duplicate Stripe session IDs are silently ignored (unique constraint).
 */
import { Stripe } from '../../_shared/stripe.ts';
import { supabase } from '../../_shared/supabase.ts';
import { sendEmail } from '../../_shared/email.ts';
import { getAppUrl } from '../../_shared/http.ts';
import { sendPushNotification } from './push-notification.ts';

/** Metadata shape expected on shop checkout sessions. */
interface ShopSessionMetadata {
  creator_id: string;
  creator_slug: string;
  item_id: string;
  item_title: string;
  item_type: string;
  is_request_based: string;
  buyer_name: string;
  buyer_email: string;
  request_details: string;
}

/** Returns a JSON-serialisable response body. */
export async function handleShopOrder(
  session: Stripe.Checkout.Session,
): Promise<{ received: true; duplicate?: true }> {
  const meta = session.metadata as unknown as ShopSessionMetadata;
  const {
    creator_id, creator_slug: shopCreatorSlug, item_id, item_title,
    item_type, is_request_based, buyer_name, buyer_email, request_details,
  } = meta;

  const amountInCents = session.amount_total || 0;
  const isRequestBased = is_request_based === 'true';
  const idempotencyKey = `shop:${session.id}`;

  // ── Insert order ────────────────────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .insert({
      item_id,
      creator_id,
      buyer_name,
      buyer_email,
      amount_paid: amountInCents,
      stripe_session_id: session.id,
      idempotency_key: idempotencyKey,
      status: isRequestBased ? 'pending' : 'completed',
      request_details: request_details || null,
    })
    .select('id')
    .single();

  if (orderError) {
    if (orderError.code === '23505') {
      console.log('[shop-order] Duplicate, skipping:', session.id);
      return { received: true, duplicate: true };
    }
    console.error('[shop-order] Error creating order:', orderError);
    throw orderError;
  }

  console.log('[shop-order] Created:', order.id, 'item:', item_id);

  // ── Emails + push (non-blocking) ───────────────────────────────────
  const { data: creator } = await supabase
    .from('creators')
    .select('display_name, email')
    .eq('id', creator_id)
    .single();

  if (creator) {
    const appUrl = getAppUrl();
    await sendShopEmails({
      session, order, creator, appUrl,
      shopCreatorSlug, item_title, item_type, isRequestBased,
      buyer_name, buyer_email, request_details, amountInCents,
    });
  }

  void sendPushNotification(
    creator_id,
    '🛍️ New shop sale!',
    `${buyer_name} bought "${item_title}"`,
  );

  return { received: true };
}

// ── Email helpers (private to this handler) ──────────────────────────

interface ShopEmailContext {
  session: Stripe.Checkout.Session;
  order: { id: string };
  creator: { display_name: string; email: string };
  appUrl: string;
  shopCreatorSlug: string;
  item_title: string;
  item_type: string;
  isRequestBased: boolean;
  buyer_name: string;
  buyer_email: string;
  request_details: string;
  amountInCents: number;
}

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬', audio: '🎵', pdf: '📄', image: '🖼️', shoutout_request: '🎥',
};

async function sendShopEmails(ctx: ShopEmailContext): Promise<void> {
  const emoji = TYPE_EMOJI[ctx.item_type] ?? '📦';
  const formattedAmount = `$${(ctx.amountInCents / 100).toFixed(2)}`;

  // 1. Buyer confirmation
  const downloadUrl = `${ctx.appUrl}/success?session_id=${ctx.session.id}&creator=${ctx.shopCreatorSlug}&shop=1&item_id=${ctx.order.id}`;
  const buyerHtml = ctx.isRequestBased
    ? buildRequestReceivedEmail({ ...ctx, emoji, formattedAmount })
    : buildDownloadReadyEmail({ ...ctx, emoji, formattedAmount, downloadUrl });

  await sendEmail({
    to: ctx.buyer_email,
    subject: ctx.isRequestBased
      ? `${emoji} Your request to ${ctx.creator.display_name} is confirmed!`
      : `${emoji} Your purchase from ${ctx.creator.display_name} is ready!`,
    html: buyerHtml,
    idempotencyKey: `${ctx.session.id}_shop_buyer`,
  });

  // 2. Creator notification
  const creatorHtml = buildCreatorSaleEmail({ ...ctx, emoji, formattedAmount });
  await sendEmail({
    to: ctx.creator.email,
    subject: `🛍️ New shop sale: ${ctx.item_title} — ${formattedAmount}`,
    html: creatorHtml,
    idempotencyKey: `${ctx.session.id}_shop_creator`,
  });
}

interface EmailBuildContext extends ShopEmailContext {
  emoji: string;
  formattedAmount: string;
  downloadUrl?: string;
}

function buildRequestReceivedEmail(ctx: EmailBuildContext): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0d1a;color:#fff;border-radius:1rem;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:2rem;text-align:center">
        <h1 style="margin:0;font-size:1.75rem">${ctx.emoji} Request Received!</h1>
        <p style="margin:.5rem 0 0;opacity:.9">Order #${ctx.order.id.slice(0, 8).toUpperCase()}</p>
      </div>
      <div style="padding:2rem">
        <p style="color:#c4b5fd;font-size:1rem">Hi <strong>${ctx.buyer_name}</strong>,</p>
        <p style="color:#e2e8f0">Your request for <strong>${ctx.item_title}</strong> from <strong>${ctx.creator.display_name}</strong> has been received! 🎉</p>
        <div style="background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:.75rem;padding:1.25rem;margin:1.5rem 0">
          <p style="margin:0;color:#a78bfa;font-weight:600">Your brief:</p>
          <p style="margin:.5rem 0 0;color:#e2e8f0">${ctx.request_details || 'No details provided'}</p>
        </div>
        <p style="color:#94a3b8">The creator will get in touch once your ${ctx.item_type.replace('_', ' ')} is ready. Keep an eye on <strong>${ctx.buyer_email}</strong>.</p>
        <p style="color:#64748b;font-size:.875rem">Amount paid: <strong>${ctx.formattedAmount}</strong></p>
      </div>
      <div style="background:rgba(255,255,255,.05);padding:1.5rem;text-align:center">
        <p style="margin:0;color:#64748b;font-size:.75rem">Powered by <a href="${ctx.appUrl}" style="color:#a78bfa;text-decoration:none">Convozo</a></p>
      </div>
    </div>`;
}

function buildDownloadReadyEmail(ctx: EmailBuildContext): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0d1a;color:#fff;border-radius:1rem;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:2rem;text-align:center">
        <h1 style="margin:0;font-size:1.75rem">${ctx.emoji} Purchase Complete!</h1>
        <p style="margin:.5rem 0 0;opacity:.9">Your download is ready</p>
      </div>
      <div style="padding:2rem">
        <p style="color:#c4b5fd;font-size:1rem">Hi <strong>${ctx.buyer_name}</strong>,</p>
        <p style="color:#e2e8f0">Thanks for purchasing <strong>${ctx.item_title}</strong> from <strong>${ctx.creator.display_name}</strong>! 🎉</p>
        <div style="text-align:center;margin:2rem 0">
          <a href="${ctx.downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:1rem 2.5rem;border-radius:.75rem;font-weight:700;font-size:1.1rem">⬇️ Download Your Item</a>
        </div>
        <p style="color:#94a3b8;font-size:.875rem;text-align:center">Your file is stored securely on Convozo. Click the button above to go to your download page.</p>
        <p style="color:#64748b;font-size:.875rem">Amount paid: <strong>${ctx.formattedAmount}</strong></p>
      </div>
      <div style="background:rgba(255,255,255,.05);padding:1.5rem;text-align:center">
        <p style="margin:0;color:#64748b;font-size:.75rem">Powered by <a href="${ctx.appUrl}" style="color:#a78bfa;text-decoration:none">Convozo</a></p>
      </div>
    </div>`;
}

function buildCreatorSaleEmail(ctx: EmailBuildContext): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0d1a;color:#fff;border-radius:1rem;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:2rem;text-align:center">
        <h1 style="margin:0;font-size:1.75rem">🛍️ New Shop Sale!</h1>
        <p style="margin:.5rem 0 0;opacity:.9">${ctx.formattedAmount} earned</p>
      </div>
      <div style="padding:2rem">
        <p style="color:#c4b5fd">Hi <strong>${ctx.creator.display_name}</strong>,</p>
        <p style="color:#e2e8f0"><strong>${ctx.buyer_name}</strong> (${ctx.buyer_email}) just purchased <strong>${ctx.item_title}</strong> from your shop.</p>
        ${ctx.isRequestBased ? `
        <div style="background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:.75rem;padding:1.25rem;margin:1.5rem 0">
          <p style="margin:0;color:#a78bfa;font-weight:600">Their brief:</p>
          <p style="margin:.5rem 0 0;color:#e2e8f0">${ctx.request_details || 'No details provided'}</p>
        </div>
        <p style="color:#f59e0b;font-weight:600">⚡ Action required: fulfil this request and send your delivery link via your dashboard.</p>
        ` : ''}
        <a href="${ctx.appUrl}/creator/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:.875rem 2rem;border-radius:.75rem;font-weight:700;margin-top:1rem">View in Dashboard →</a>
      </div>
      <div style="background:rgba(255,255,255,.05);padding:1.5rem;text-align:center">
        <p style="margin:0;color:#64748b;font-size:.75rem">Powered by <a href="${ctx.appUrl}" style="color:#a78bfa;text-decoration:none">Convozo</a></p>
      </div>
    </div>`;
}
