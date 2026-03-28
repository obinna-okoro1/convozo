/**
 * get-client-portal
 *
 * Returns all messages and call bookings for the authenticated client,
 * identified by auth.email(). Used by the /portal Angular page.
 *
 * Expects:
 *   Authorization: Bearer <supabase-jwt>   (from magic-link session)
 *   Method: POST  (no body required)
 *
 * Returns:
 *   {
 *     messages: PortalMessage[],
 *     bookings: PortalBooking[]
 *   }
 *
 * Errors:
 *   401 — not authenticated
 *   500 — database error
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // ── 1. Authenticate via JWT (magic-link session) ──────────────────────
    const user = await requireAuth(req, supabase, corsHeaders);
    if (user instanceof Response) return user;

    const clientEmail = user.email;
    if (!clientEmail) {
      return jsonError('Unable to determine client email from session', 400, corsHeaders);
    }

    // ── 2. Fetch messages sent by this client ─────────────────────────────
    // Join creators table for display_name and slug
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        message_content,
        amount_paid,
        message_type,
        is_handled,
        replied_at,
        created_at,
        conversation_token,
        sender_name,
        creators (
          display_name,
          slug,
          profile_image_url
        )
      `)
      .eq('sender_email', clientEmail)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('[get-client-portal] Messages query failed:', messagesError);
      return jsonError('Failed to load messages', 500, corsHeaders);
    }

    // ── 3. Fetch the latest reply for each message ────────────────────────
    const messageIds = (messages ?? []).map((m) => m.id);
    let repliesByMessageId: Record<string, { content: string; sender_type: string; created_at: string }[]> = {};

    if (messageIds.length > 0) {
      const { data: replies, error: repliesError } = await supabase
        .from('message_replies')
        .select('message_id, sender_type, content, created_at')
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });

      if (repliesError) {
        // Non-fatal — portal still works without reply threads
        console.error('[get-client-portal] Replies query failed:', repliesError);
      } else {
        for (const reply of replies ?? []) {
          if (!repliesByMessageId[reply.message_id]) {
            repliesByMessageId[reply.message_id] = [];
          }
          repliesByMessageId[reply.message_id].push({
            content: reply.content,
            sender_type: reply.sender_type,
            created_at: reply.created_at,
          });
        }
      }
    }

    // ── 4. Fetch call bookings made by this client ────────────────────────
    const { data: bookings, error: bookingsError } = await supabase
      .from('call_bookings')
      .select(`
        id,
        duration,
        amount_paid,
        status,
        scheduled_at,
        fan_timezone,
        fan_access_token,
        call_notes,
        created_at,
        booker_name,
        creators (
          display_name,
          slug,
          profile_image_url
        )
      `)
      .eq('booker_email', clientEmail)
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('[get-client-portal] Bookings query failed:', bookingsError);
      return jsonError('Failed to load bookings', 500, corsHeaders);
    }

    // ── 5. Shape and return ───────────────────────────────────────────────
    const shapedMessages = (messages ?? []).map((m) => ({
      id: m.id,
      message_content: m.message_content,
      amount_paid: m.amount_paid,
      message_type: m.message_type,
      is_handled: m.is_handled,
      replied_at: m.replied_at,
      created_at: m.created_at,
      conversation_token: m.conversation_token,
      sender_name: m.sender_name,
      creator: m.creators,
      replies: repliesByMessageId[m.id] ?? [],
    }));

    const shapedBookings = (bookings ?? []).map((b) => ({
      id: b.id,
      duration: b.duration,
      amount_paid: b.amount_paid,
      status: b.status,
      scheduled_at: b.scheduled_at,
      fan_timezone: b.fan_timezone,
      fan_access_token: b.fan_access_token,
      call_notes: b.call_notes,
      created_at: b.created_at,
      booker_name: b.booker_name,
      creator: b.creators,
    }));

    return jsonOk({ messages: shapedMessages, bookings: shapedBookings }, corsHeaders);

  } catch (err) {
    console.error('[get-client-portal] Unhandled error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
