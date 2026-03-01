import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, creatorReplyEmail } from '../_shared/email.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/** Maximum allowed reply length (characters). */
const MAX_REPLY_LENGTH = 5000;
/** UUID v4 pattern for message_id validation. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limiting store (in-memory, per-instance)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX = 20; // max replies per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const requests = rateLimitStore.get(userId) || [];
  const recent = requests.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitStore.set(userId, recent);
  return true;
}

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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: max 20 replies per hour per creator
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' } }
      );
    }

    // ── 2. Parse & validate body ──────────────────────────────────────────
    const body = await req.json();
    const messageId: string | undefined = body?.message_id;
    const replyContent: string | undefined = typeof body?.reply_content === 'string'
      ? body.reply_content.trim()
      : undefined;

    if (!messageId || !replyContent) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message_id, reply_content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!UUID_RE.test(messageId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid message ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (replyContent.length > MAX_REPLY_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Reply too long (max ${MAX_REPLY_LENGTH} characters)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Fetch message & verify ownership ───────────────────────────────
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, sender_email, message_content, replied_at, creators(display_name, user_id)')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only the creator who received the message may reply
    if (message.creators.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent double-replying
    if (message.replied_at) {
      return new Response(
        JSON.stringify({ error: 'This message has already been replied to' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Persist the reply ──────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        reply_content: replyContent,
        replied_at: new Date().toISOString(),
        is_handled: true,
      })
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    // ── 5. Send notification email (fire-and-forget) ──────────────────────
    const emailPayload = creatorReplyEmail({
      creatorName: message.creators.display_name,
      originalMessage: message.message_content,
      replyContent,
    });

    const sent = await sendEmail({ to: message.sender_email, ...emailPayload, idempotencyKey: `reply_${messageId}` });
    if (!sent) {
      console.error('[send-reply-email] Email delivery failed for message:', messageId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[send-reply-email] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
