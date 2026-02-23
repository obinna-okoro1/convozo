-- Add stripe_checkout_session_id to messages table for idempotency.
--
-- Previously, duplicate webhook deliveries from Stripe could race past the
-- SELECT-based idempotency check (which queries the payments table) and both
-- insert a message before either creates a payment record.
--
-- Adding a UNIQUE constraint directly on the messages table guarantees that
-- even under concurrent webhook invocations, only one message is ever created
-- per checkout session.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT UNIQUE;
