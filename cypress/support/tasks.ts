/**
 * Cypress Node-side tasks — run in Node.js context (no browser APIs).
 *
 * PHILOSOPHY: E2E tests should drive the UI. Backend tasks are reserved for
 * operations that genuinely cannot be performed through the UI:
 *   - Cleanup (deleting test users after signup tests)
 *   - Reading DB values behind RLS (conversation tokens, booking tokens)
 *   - Polling Mailpit for confirmation/magic-link emails
 *   - Seeding call bookings (requires Stripe payment in real flow)
 *
 * NO service-role keys or admin clients. All DB access uses docker exec + psql
 * against the local Supabase container — zero secrets in test files.
 *
 * Import: referenced by cypress.config.ts → setupNodeEvents.
 */

import { execSync } from 'child_process';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Docker container name for the local Supabase Postgres DB. */
const DB_CONTAINER = 'supabase_db_convozo';

/** Mailpit API base URL (Supabase local email testing). */
const MAILPIT_URL = 'http://127.0.0.1:54324';

// ─── psql helper ──────────────────────────────────────────────────────────────

/** Run a SQL query via docker exec + psql. Returns trimmed stdout. */
function psql(sql: string): string {
  try {
    return execSync(
      `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -t -c "${sql.replace(/"/g, '\\"')}"`,
    )
      .toString()
      .trim();
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer };
    throw new Error(`psql failed: ${err.stderr?.toString() ?? String(e)}`);
  }
}

// ─── Task: deleteUserByEmail ──────────────────────────────────────────────────
/**
 * Removes an auth user (and cascade-deleted DB rows) by email.
 * Used for cleanup after signup/onboarding tests.
 */
async function deleteUserByEmail(email: string): Promise<null> {
  psql(`DELETE FROM auth.users WHERE email = '${email.replace(/'/g, "''")}'`);
  return null;
}

// ─── Task: readDbValue ────────────────────────────────────────────────────────
/**
 * Executes a SQL query and returns the first column of the first row.
 * Used to read values that are behind RLS and can't be fetched with the
 * anon key (conversation tokens, fan_access_tokens, creator IDs, etc.).
 *
 * Example: cy.task('readDbValue', "SELECT conversation_token FROM messages WHERE id = '...'")
 */
async function readDbValue(sql: string): Promise<string | null> {
  const result = psql(sql);
  return result || null;
}

// ─── Task: pollMailpitForLink ─────────────────────────────────────────────────
/**
 * Polls Mailpit until a sign-in / confirmation email arrives for the given
 * address. Extracts the GoTrue verify URL from the email body and returns it.
 *
 * Optionally replaces the redirect_to parameter so Cypress lands on the
 * desired page after verification (e.g. /portal or /auth/callback).
 *
 * Returns the full verify URL string.
 */
async function pollMailpitForLink({
  email,
  redirectTo = 'http://localhost:4200/auth/callback',
}: {
  email: string;
  redirectTo?: string;
}): Promise<string> {
  let messageId: string | null = null;

  // Poll every 500ms for up to 15 seconds
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 500));

    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const list = (await listRes.json()) as {
      messages: Array<{
        ID: string;
        To: Array<{ Address: string }>;
        Subject: string;
      }>;
    };

    const match = list.messages.find(
      (m) =>
        m.To.some((t) => t.Address === email) &&
        /sign.in|confirm|magic.link|verify/i.test(m.Subject),
    );

    if (match) {
      messageId = match.ID;
      break;
    }
  }

  if (!messageId) {
    throw new Error(`pollMailpitForLink: no email for ${email} after 15s`);
  }

  // Fetch the email body and extract the verify URL
  const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const msg = (await msgRes.json()) as { Text: string };

  const urlMatch = msg.Text.match(
    /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s)]+/,
  );
  if (!urlMatch) {
    throw new Error(
      'pollMailpitForLink: verify URL not found in email body',
    );
  }

  // Replace redirect_to so Cypress lands on the correct page
  const verifyUrl = new URL(urlMatch[0]);
  verifyUrl.searchParams.set('redirect_to', redirectTo);
  return verifyUrl.toString();
}

// ─── Task: clearMailpit ───────────────────────────────────────────────────────
/** Deletes all messages from Mailpit so polls start clean. */
async function clearMailpit(): Promise<null> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
  return null;
}

// ─── Task: seedCallBooking ────────────────────────────────────────────────────
/**
 * EXTREME CASE: Seeds a call booking directly in the DB.
 * Necessary because creating a real booking requires Stripe payment,
 * which can't be completed in E2E tests.
 *
 * Returns the booking id and fan_access_token.
 */
async function seedCallBooking({
  creatorId,
  bookerName,
  bookerEmail,
  scheduledAt,
  status = 'confirmed',
  amountPaid = 5000,
  duration = 30,
}: {
  creatorId: string;
  bookerName: string;
  bookerEmail: string;
  scheduledAt: string;
  status?: string;
  amountPaid?: number;
  duration?: number;
}): Promise<{ id: string; fanAccessToken: string }> {
  const row = psql(
    `INSERT INTO public.call_bookings (creator_id, booker_name, booker_email, scheduled_at, status, amount_paid, duration, daily_room_url, daily_room_name) VALUES ('${creatorId}', '${bookerName}', '${bookerEmail}', '${scheduledAt}', '${status}', ${amountPaid}, ${duration}, 'https://convozo.daily.co/e2e-room', 'e2e-room') RETURNING id || '|' || fan_access_token`,
  );
  const [id, fanAccessToken] = row.split('|').map((s) => s.trim());
  return { id, fanAccessToken };
}

// ─── Task: cancelBooking ──────────────────────────────────────────────────────
/** Sets a booking's status to 'cancelled'. Used for cleanup/test scenarios. */
async function cancelBooking(bookingId: string): Promise<null> {
  psql(
    `UPDATE public.call_bookings SET status = 'cancelled' WHERE id = '${bookingId}'`,
  );
  return null;
}

// ─── Task: cleanupTestBookings ────────────────────────────────────────────────
/**
 * Cancels all confirmed/in_progress bookings for a creator.
 * Prevents unique constraint violations across test runs.
 */
async function cleanupTestBookings(creatorId: string): Promise<null> {
  // Only cancel bookings with test emails — preserves seed data (e.g. alex@example.com)
  psql(
    `UPDATE public.call_bookings SET status = 'cancelled' WHERE creator_id = '${creatorId}' AND booker_email LIKE '%@convozo.test' AND status IN ('confirmed', 'in_progress')`,
  );
  return null;
}

// ─── Tasks registry — consumed by cypress.config.ts ──────────────────────────
export const tasks = {
  deleteUserByEmail,
  readDbValue,
  pollMailpitForLink,
  clearMailpit,
  seedCallBooking,
  cancelBooking,
  cleanupTestBookings,
};
