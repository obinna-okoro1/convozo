/**
 * get-conversation
 *
 * Public edge function — no auth required.
 * Returns the full conversation thread for a given conversation_token.
 *
 * Input:  POST { token: string }
 * Output: { message: {...}, creator: {...}, replies: [...] }
 * Errors: 400 (bad token), 404 (not found), 500 (internal)
 */

import { supabase } from '../_shared/supabase.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonOk, jsonError } from '../_shared/http.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405, corsHeaders);
  }

  try {
    // ── 1. Parse & validate token ────────────────────────────────────────────
    const body: unknown = await req.json();
    const token =
      body !== null && typeof body === 'object' && 'token' in body
        ? String((body as Record<string, unknown>).token ?? '')
        : '';

    if (!UUID_RE.test(token)) {
      return jsonError('Invalid or missing conversation token', 400, corsHeaders);
    }

    // ── 2. Fetch message by token (service role bypasses RLS) ────────────────
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        sender_name,
        message_content,
        amount_paid,
        message_type,
        created_at,
        creators!inner (
          display_name,
          slug,
          profile_image_url
        )
      `)
      .eq('conversation_token', token)
      .single();

    if (msgError || !message) {
      return jsonError('Conversation not found', 404, corsHeaders);
    }

    // ── 3. Fetch all replies in chronological order ──────────────────────────
    const { data: replies, error: repliesError } = await supabase
      .from('message_replies')
      .select('id, sender_type, content, created_at')
      .eq('message_id', message.id)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('[get-conversation] replies fetch error:', repliesError);
      return jsonError('Failed to load replies', 500, corsHeaders);
    }

    return jsonOk(
      {
        message: {
          id: message.id,
          sender_name: message.sender_name,
          message_content: message.message_content,
          amount_paid: message.amount_paid,
          message_type: message.message_type,
          created_at: message.created_at,
        },
        creator: message.creators,
        replies: replies ?? [],
      },
      corsHeaders,
    );
  } catch (err) {
    console.error('[get-conversation] unhandled error:', err);
    return jsonError('Internal server error', 500, corsHeaders);
  }
});
