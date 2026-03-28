/**
 * post-client-reply
 *
 * Public edge function — no auth required. Uses conversation_token for ownership.
 * Allows the client (the person who paid) to reply back to the expert's response,
 * keeping the entire consultation on Convozo rather than drifting to email/WhatsApp.
 *
 * Input:  POST { token: string, content: string }
 * Output: { success: true, reply: { id, created_at } }
 * Errors: 400, 404, 409 (no expert reply yet), 429 (rate limit), 500
 *
 * Rate limit: 10 client replies per conversation token per hour.
 */

import { supabase } from '../_shared/supabase.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonOk, jsonError, makeRateLimiter, getAppUrl } from '../_shared/http.ts';
import { sendEmail } from '../_shared/email.ts';
import { escapeHtml } from '../_shared/email.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REPLY_LENGTH = 5000;

/** 10 client replies per token per hour */
const checkRateLimit = makeRateLimiter(10, 60 * 60 * 1000);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405, corsHeaders);
  }

  try {
    // ── 1. Parse & validate body ─────────────────────────────────────────────
    const body: unknown = await req.json();

    const token =
      body !== null && typeof body === 'object' && 'token' in body
        ? String((body as Record<string, unknown>).token ?? '')
        : '';

    const content =
      body !== null && typeof body === 'object' && 'content' in body
        ? String((body as Record<string, unknown>).content ?? '').trim()
        : '';

    if (!UUID_RE.test(token)) {
      return jsonError('Invalid or missing conversation token', 400, corsHeaders);
    }

    if (!content || content.length > MAX_REPLY_LENGTH) {
      return jsonError(`Reply must be between 1 and ${MAX_REPLY_LENGTH} characters`, 400, corsHeaders);
    }

    // Rate-limit by token (prevents spam on a single conversation)
    if (!checkRateLimit(token)) {
      return jsonError('Too many replies. Please wait before sending another.', 429, corsHeaders);
    }

    // ── 2. Resolve message by token ──────────────────────────────────────────
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        sender_name,
        message_content,
        creators!inner (
          display_name,
          email,
          slug
        )
      `)
      .eq('conversation_token', token)
      .single();

    if (msgError || !message) {
      return jsonError('Conversation not found', 404, corsHeaders);
    }

    // Ensure the expert has replied at least once before the client can reply back
    const { count, error: countError } = await supabase
      .from('message_replies')
      .select('id', { count: 'exact', head: true })
      .eq('message_id', message.id)
      .eq('sender_type', 'expert');

    if (countError) {
      console.error('[post-client-reply] count error:', countError);
      return jsonError('Internal error', 500, corsHeaders);
    }

    if ((count ?? 0) === 0) {
      return jsonError(
        'The expert has not replied yet. You can reply once they respond.',
        409,
        corsHeaders,
      );
    }

    // ── 3. Insert client reply ───────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from('message_replies')
      .insert({ message_id: message.id, sender_type: 'client', content })
      .select('id, created_at')
      .single();

    if (insertError || !inserted) {
      console.error('[post-client-reply] insert error:', insertError);
      return jsonError('Failed to save reply', 500, corsHeaders);
    }

    // ── 4. Notify expert by email (fire-and-forget) ──────────────────────────
    // getAppUrl() guards against localhost leaking into production emails
    const appUrl = getAppUrl();
    const dashboardUrl = `${appUrl}/creator/dashboard`;

    const emailPayload = clientReplyNotificationEmail({
      creatorName: message.creators.display_name,
      clientName: message.sender_name,
      clientReply: content,
      dashboardUrl,
    });

    const sent = await sendEmail({
      to: message.creators.email,
      ...emailPayload,
      idempotencyKey: `client_reply_${inserted.id}`,
    });

    if (!sent) {
      console.error('[post-client-reply] expert notification email failed for reply:', inserted.id);
    }

    return jsonOk({ success: true, reply: inserted }, corsHeaders);
  } catch (err) {
    console.error('[post-client-reply] unhandled error:', err);
    return jsonError('Internal server error', 500, corsHeaders);
  }
});

// ── Email template ────────────────────────────────────────────────────────────

function clientReplyNotificationEmail(opts: {
  creatorName: string;
  clientName: string;
  clientReply: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const client = escapeHtml(opts.clientName);
  const reply = escapeHtml(opts.clientReply);
  const url = escapeHtml(opts.dashboardUrl);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Convozo</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">${client} replied to your message</h2>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 20px;">
        A client just replied to your consultation on Convozo. Head to your dashboard to continue the conversation.
      </p>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Their reply:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${reply}</p>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">
          View in Dashboard
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} Convozo</p>
    </div>
  </div>
</body>
</html>`.trim();

  return { subject: `${client} replied to your consultation`, html };
}
