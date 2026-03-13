/**
 * Shared Daily.co API utility for Convozo Edge Functions.
 *
 * Provides:
 *   createRoom(bookingId, durationMinutes) — creates a Daily room with auto-expiry
 *   createMeetingToken(roomName, role, durationMinutes) — creates a scoped meeting token
 *   deleteRoom(roomName) — deletes a room after call completion
 *
 * Expects: DAILY_API_KEY environment variable set via `supabase secrets set`.
 *
 * Errors: all functions throw on failure — callers must wrap in try/catch.
 */

const DAILY_API_BASE = 'https://api.daily.co/v1';

function getDailyApiKey(): string {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) {
    throw new Error('DAILY_API_KEY is not set');
  }
  return key;
}

function dailyHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getDailyApiKey()}`,
    'Content-Type': 'application/json',
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyRoom {
  id: string;
  name: string;
  url: string;
  created_at: string;
  config: Record<string, unknown>;
}

interface DailyMeetingToken {
  token: string;
}

// ── Room management ──────────────────────────────────────────────────────────

/**
 * Create a Daily.co room for a call booking.
 *
 * Room properties:
 * - Private (no one joins without a token)
 * - Max 2 participants (1:1 call)
 * - Auto-expires 2 hours after the booked duration to handle stragglers
 * - Enable recording for future premium feature
 * - Knock mode disabled (tokens control access)
 *
 * @param bookingId — used to generate a unique room name
 * @param durationMinutes — booked call duration in minutes
 * @returns DailyRoom object with name and url
 */
export async function createRoom(
  bookingId: string,
  durationMinutes: number,
): Promise<DailyRoom> {
  // Room name: convozo-<first 8 chars of booking UUID> for uniqueness + readability
  const shortId = bookingId.replace(/-/g, '').slice(0, 8);
  const roomName = `convozo-${shortId}`;

  // Room auto-deletes 2 hours after the booked call duration
  const expirySeconds = (durationMinutes + 120) * 60;
  const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;

  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: dailyHeaders(),
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        max_participants: 2,
        enable_chat: true,
        enable_knocking: false,
        enable_screenshare: false,
        enable_recording: 'cloud', // future premium: call recordings
        exp: expiresAt,
        eject_at_room_exp: true,
        // Auto-close room when empty for 60s (cleanup)
        autojoin: false,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daily.co create room failed (${res.status}): ${body}`);
  }

  const room: DailyRoom = await res.json();
  return room;
}

// ── Meeting tokens ───────────────────────────────────────────────────────────

/**
 * Create a meeting token for a participant.
 *
 * Token properties:
 * - Scoped to a specific room
 * - Expires after booked duration + 30 min buffer
 * - Role: 'owner' for creator (can mute/kick), 'participant' for fan
 * - User name displayed in the call UI
 *
 * @param roomName — the Daily room name
 * @param participantName — display name in the call
 * @param isOwner — true for creator (gets owner privileges), false for fan
 * @param durationMinutes — booked call duration (token valid for duration + 30 min)
 */
export async function createMeetingToken(
  roomName: string,
  participantName: string,
  isOwner: boolean,
  durationMinutes: number,
): Promise<string> {
  // Token valid for call duration + 30 min grace
  const expiresAt = Math.floor(Date.now() / 1000) + (durationMinutes + 30) * 60;

  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: dailyHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: participantName,
        is_owner: isOwner,
        exp: expiresAt,
        enable_recording: isOwner ? 'cloud' : undefined,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daily.co create token failed (${res.status}): ${body}`);
  }

  const data: DailyMeetingToken = await res.json();
  return data.token;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Delete a Daily.co room. Called after call completion or no-show.
 * Non-fatal — logs errors but never throws.
 */
export async function deleteRoom(roomName: string): Promise<void> {
  try {
    const res = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: dailyHeaders(),
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      console.error(`[daily] Failed to delete room ${roomName}:`, res.status, body);
    }
  } catch (err) {
    console.error(`[daily] Error deleting room ${roomName}:`, (err as Error).message);
  }
}
