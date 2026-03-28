import { sendEmail, creatorReplyEmail } from '../_shared/email.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, requireAuth, makeRateLimiter, getAppUrl } from '../_shared/http.ts';
import { generateMagicLink } from '../_shared/magic-link.ts';

/** Maximum allowed reply length (characters). */
const MAX_REPLY_LENGTH = 5000;
/** UUID v4 pattern for message_id validation. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limit: 20 replies per hour per creator
const checkRateLimit = makeRateLimiter(20, 60 * 60 * 1000);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ── 1. Authenticate the caller via JWT ────────────────────────────────
    const user = await requireAuth(req, supabase, corsHeaders);
    if (user instanceof Response) return user;

    // Rate limit: max 20 replies per hour per creator
    if (!checkRateLimit(user.id)) {
      return jsonError('Rate limit exceeded. Please try again later.', 429, { ...corsHeaders, 'Retry-After': '3600' });
    }

    // ── 2. Parse & validate body ──────────────────────────────────────────
    const body = await req.json();
    const messageId: string | undefined = body?.message_id;
    const replyContent: string | undefined = typeof body?.reply_content === 'string'
      ? body.reply_content.trim()
      : undefined;

    if (!messageId || !replyContent) {
      return jsonError('Missing required fields: message_id, reply_content', 400, corsHeaders);
    }

    if (!UUID_RE.test(messageId)) {
      return jsonError('Invalid message ID format', 400, corsHeaders);
    }

    if (replyContent.length > MAX_REPLY_LENGTH) {
      return jsonError(`Reply too long (max ${MAX_REPLY_LENGTH} characters)`, 400, corsHeaders);
    }

    // ── 3. Fetch message & verify ownership ───────────────────────────────
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, sender_email, message_content, replied_at, conversation_token, creators(display_name, user_id)')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return jsonError('Message not found', 404, corsHeaders);
    }

    // Only the creator who received the message may reply
    if (message.creators.user_id !== user.id) {
      return jsonError('Forbidden', 403, corsHeaders);
    }

    // ── 4. Persist the reply ──────────────────────────────────────────────
    // Update the parent message: mark handled; set reply_content only on first reply
    const updatePayload: Record<string, unknown> = { is_handled: true };
    if (!message.replied_at) {
      updatePayload.reply_content = replyContent;
      updatePayload.replied_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update(updatePayload)
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    // Also record in message_replies for the full thread
    const { error: replyInsertError } = await supabase
      .from('message_replies')
      .insert({ message_id: messageId, sender_type: 'expert', content: replyContent });

    if (replyInsertError) {
      // Non-fatal: log but don't fail the request — the reply_content is already set
      console.error('[send-reply-email] Failed to insert into message_replies:', replyInsertError);
    }

    // ── 5. Send notification email (fire-and-forget) ──────────────────────
    // getAppUrl() guards against localhost leaking into production emails
    const appUrl = getAppUrl();
    const conversationUrl = `${appUrl}/conversation/${message.conversation_token}`;

    // Generate a fresh magic link so the client can jump straight to their portal
    const portalUrl = await generateMagicLink(message.sender_email);

    const emailPayload = creatorReplyEmail({
      creatorName: message.creators.display_name,
      originalMessage: message.message_content,
      replyContent,
      conversationUrl,
      portalUrl: portalUrl ?? undefined,
    });

    const sent = await sendEmail({ to: message.sender_email, ...emailPayload, idempotencyKey: `reply_${messageId}_${Date.now()}` });
    if (!sent) {
      console.error('[send-reply-email] Email delivery failed for message:', messageId);
    }

    return jsonOk({ success: true }, corsHeaders);
  } catch (err) {
    console.error('[send-reply-email] Unhandled error:', err);
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
