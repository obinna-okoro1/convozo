/**
 * Message Payment Handler
 *
 * Processes checkout.session.completed events for regular messages
 * (metadata.type is undefined — fallback branch).
 * Creates the messages + payments rows, sends confirmation emails,
 * and pushes a notification.
 *
 * Idempotent: duplicate stripe_session_id is rejected by unique constraint.
 */
import { Stripe } from '../../_shared/stripe.ts';
import { supabase } from '../../_shared/supabase.ts';
import {
  sendEmail,
  messageConfirmationEmail,
  newMessageNotificationEmail,
} from '../../_shared/email.ts';
import { generateMagicLink } from '../../_shared/magic-link.ts';
import { sendPushNotification } from './push-notification.ts';
import { getPlatformFeePercentage } from '../../_shared/http.ts';

/** Metadata shape expected on message checkout sessions. */
interface MessageMetadata {
  creator_id: string;
  message_content: string;
  sender_name: string;
  sender_email: string;
  message_type: string;
}

/** Valid message types — reject anything outside this set. */
const VALID_MESSAGE_TYPES = ['message', 'call', 'support'] as const;

/** Returns a JSON-serialisable response body. */
export async function handleMessagePayment(
  session: Stripe.Checkout.Session,
): Promise<{ received: true; duplicate?: true }> {
  const meta = session.metadata as unknown as MessageMetadata;
  const { creator_id, message_content, sender_name, sender_email, message_type } = meta;

  // Use Stripe-authoritative amount, not metadata (prevents manipulation)
  const amountInCents = session.amount_total || 0;
  const validMessageType = (VALID_MESSAGE_TYPES as readonly string[]).includes(message_type)
    ? message_type
    : 'message';

  // ── Insert message ────────────────────────────────────────────────
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      creator_id,
      sender_name,
      sender_email,
      message_content,
      amount_paid: amountInCents,
      message_type: validMessageType,
      stripe_session_id: session.id,
    })
    .select('id')
    .single();

  if (messageError) {
    if (messageError.code === '23505') {
      console.log('[message-payment] Duplicate, skipping:', session.id);
      return { received: true, duplicate: true };
    }
    console.error('[message-payment] Error creating message:', messageError);
    throw messageError;
  }

  // ── Insert payment record ─────────────────────────────────────────
  // Platform fee is exactly 22% — computed with integer arithmetic, no floats.
  const platformFeePercentage = getPlatformFeePercentage();
  const platformFee = Math.round(amountInCents * platformFeePercentage / 100);
  const creatorAmount = amountInCents - platformFee;

  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      message_id: message.id,
      creator_id,
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      amount: amountInCents,
      platform_fee: platformFee,
      creator_amount: creatorAmount,
      status: 'completed',
      sender_email,
    });

  if (paymentError) {
    console.error('[message-payment] Error creating payment:', paymentError);
    throw paymentError;
  }

  console.log('[message-payment] Created message + payment:', message.id);

  // ── Emails (non-blocking) ─────────────────────────────────────────
  const { data: creator } = await supabase
    .from('creators')
    .select('display_name, email')
    .eq('id', creator_id)
    .single();

  if (creator) {
    // 1. Sender confirmation — includes magic-link to client portal
    const portalUrl = await generateMagicLink(sender_email);
    const senderPayload = messageConfirmationEmail({
      senderName: sender_name,
      creatorName: creator.display_name,
      messageContent: message_content,
      amountCents: amountInCents,
      portalUrl: portalUrl ?? undefined,
    });
    await sendEmail({ to: sender_email, ...senderPayload, idempotencyKey: `${session.id}_msg_sender` });

    // 2. Creator notification
    const creatorPayload = newMessageNotificationEmail({
      creatorName: creator.display_name,
      senderName: sender_name,
      senderEmail: sender_email,
      messageContent: message_content,
      amountCents: amountInCents,
    });
    await sendEmail({ to: creator.email, ...creatorPayload, idempotencyKey: `${session.id}_msg_creator` });
  }

  // 3. Push notification (fire-and-forget)
  void sendPushNotification(
    creator_id,
    '💬 New paid message!',
    `${sender_name} sent you a paid message`,
  );

  return { received: true };
}
