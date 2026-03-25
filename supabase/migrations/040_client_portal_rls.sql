/**
 * Migration 040 — Client Portal RLS
 *
 * Adds row-level security policies so authenticated clients (who signed in
 * via magic link) can read their own messages, call bookings, and message
 * replies by matching auth.email() against sender_email / booker_email.
 *
 * Client identity = the email address used at checkout, matched against
 * auth.email() from their Supabase magic-link session.
 *
 * These policies are additive — they do not affect existing creator policies.
 */

-- ── messages ────────────────────────────────────────────────────────────────

-- Clients can read messages they sent (by email address)
CREATE POLICY "clients_select_own_messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (sender_email = auth.email());

-- ── call_bookings ───────────────────────────────────────────────────────────

-- Clients can read call bookings they made
CREATE POLICY "clients_select_own_call_bookings"
  ON public.call_bookings
  FOR SELECT
  TO authenticated
  USING (booker_email = auth.email());

-- ── message_replies ─────────────────────────────────────────────────────────

-- Clients can read all replies on messages they sent
CREATE POLICY "clients_select_own_message_replies"
  ON public.message_replies
  FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT id FROM public.messages WHERE sender_email = auth.email()
    )
  );

-- Clients can insert replies on their own messages (authenticated version of
-- the public post-client-reply edge function — both paths remain valid)
CREATE POLICY "clients_insert_own_message_replies"
  ON public.message_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'client'
    AND message_id IN (
      SELECT id FROM public.messages WHERE sender_email = auth.email()
    )
  );
