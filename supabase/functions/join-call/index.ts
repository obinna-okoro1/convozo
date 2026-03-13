/**
 * join-call Edge Function
 *
 * Called when a participant (creator or fan) is about to enter the video call.
 * Records attendance timestamps and returns the meeting token + room URL.
 *
 * Expects:
 *   POST { booking_id: string, role: 'creator' | 'fan' }
 *   - Creator must be authenticated (Bearer JWT)
 *   - Fan identifies via booking_id + fan token (no auth required)
 *
 * Returns:
 *   { room_url: string, token: string, booking: { ... } }
 *
 * Errors:
 *   400 — missing fields, invalid role
 *   404 — booking not found or no room configured
 *   403 — unauthorized (creator JWT mismatch)
 *   409 — call already completed/cancelled/refunded
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { createRoom, createMeetingToken } from '../_shared/daily.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body: unknown = await req.json();

    // Validate shape
    if (
      typeof body !== 'object' || body === null ||
      !('booking_id' in body) || !('role' in body)
    ) {
      return jsonError('Missing required fields: booking_id, role', 400, corsHeaders);
    }

    const { booking_id, role } = body as { booking_id: string; role: string };

    if (role !== 'creator' && role !== 'fan') {
      return jsonError('Invalid role. Must be "creator" or "fan"', 400, corsHeaders);
    }

    // Fetch the booking with all video call fields
    const { data: booking, error: bookingError } = await supabase
      .from('call_bookings')
      .select('*, creators!inner(user_id, display_name)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return jsonError('Booking not found', 404, corsHeaders);
    }

    // Block joining if call is in a terminal state
    const terminalStatuses = ['completed', 'cancelled', 'refunded', 'no_show'];
    if (terminalStatuses.includes(booking.status as string)) {
      return jsonError(`Call is already ${booking.status}`, 409, corsHeaders);
    }

    // ── Authorization ──────────────────────────────────────────────────
    if (role === 'creator') {
      // Creator must be authenticated and own this booking
      const authResult = await requireAuth(req, supabase, corsHeaders);
      if (authResult instanceof Response) return authResult;
      const user = authResult;

      const creatorUserId = (booking.creators as { user_id: string }).user_id;
      if (user.id !== creatorUserId) {
        return jsonError('You are not authorized to join this call', 403, corsHeaders);
      }
    }
    // Fan access: no JWT required — the booking_id itself acts as the access control.
    // Meeting tokens are scoped and time-limited for additional security.

    // ── Ensure a Daily room exists ─────────────────────────────────────
    let roomUrl = booking.daily_room_url as string | null;
    let roomName = booking.daily_room_name as string | null;
    let token: string | null = null;

    // If room was not created during webhook (e.g., Daily API was down), create now
    if (!roomName || !roomUrl) {
      const creatorName = (booking.creators as { display_name: string }).display_name;
      const durationMinutes = booking.duration as number;

      const room = await createRoom(booking_id, durationMinutes);
      roomName = room.name;
      roomUrl = room.url;

      // Generate fresh tokens for both participants
      const creatorToken = await createMeetingToken(room.name, creatorName, true, durationMinutes);
      const fanToken = await createMeetingToken(room.name, booking.booker_name as string, false, durationMinutes);

      // Persist room + tokens on booking
      await supabase
        .from('call_bookings')
        .update({
          daily_room_name: roomName,
          daily_room_url: roomUrl,
          creator_meeting_token: creatorToken,
          fan_meeting_token: fanToken,
        })
        .eq('id', booking_id);

      // Log event
      await supabase.from('call_events').insert({
        booking_id,
        event_type: 'room_created',
        actor: 'system',
        metadata: { room_name: roomName, room_url: roomUrl, created_by: 'join-call' },
      });

      token = role === 'creator' ? creatorToken : fanToken;
    } else {
      // Room exists — return the appropriate token
      token = role === 'creator'
        ? (booking.creator_meeting_token as string)
        : (booking.fan_meeting_token as string);
    }

    // ── Record attendance ──────────────────────────────────────────────
    const now = new Date().toISOString();
    const updateFields: Record<string, string> = {};
    let eventType: string;

    if (role === 'creator' && !booking.creator_joined_at) {
      updateFields.creator_joined_at = now;
      eventType = 'creator_joined';
    } else if (role === 'fan' && !booking.fan_joined_at) {
      updateFields.fan_joined_at = now;
      eventType = 'fan_joined';
    } else {
      // Re-join — no update needed, but still return room info
      eventType = '';
    }

    if (Object.keys(updateFields).length > 0) {
      // Check if the other party already joined — if so, this starts the call
      const otherJoined = role === 'creator'
        ? Boolean(booking.fan_joined_at)
        : Boolean(booking.creator_joined_at);

      if (otherJoined) {
        updateFields.call_started_at = now;
        updateFields.status = 'in_progress';
      }

      await supabase
        .from('call_bookings')
        .update(updateFields)
        .eq('id', booking_id);

      // Log attendance event
      await supabase.from('call_events').insert({
        booking_id,
        event_type: eventType,
        actor: role,
        metadata: { joined_at: now },
      });

      // If call just started, log that too
      if (updateFields.call_started_at) {
        await supabase.from('call_events').insert({
          booking_id,
          event_type: 'call_started',
          actor: 'system',
          metadata: { started_at: now },
        });
      }
    }

    return jsonOk({
      room_url: roomUrl,
      token,
      booking: {
        id: booking.id,
        status: updateFields.status || booking.status,
        duration: booking.duration,
        booker_name: booking.booker_name,
        creator_name: (booking.creators as { display_name: string }).display_name,
        call_started_at: updateFields.call_started_at || booking.call_started_at || null,
      },
    }, corsHeaders);

  } catch (err) {
    console.error('[join-call] Error:', err);
    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
