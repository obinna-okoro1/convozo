-- Migration: Add push_subscriptions table for Web Push notifications
-- Each row represents one browser/device subscription for a creator.
-- The endpoint + keys (p256dh, auth) are sent to the server when a creator
-- enables push notifications in their dashboard settings.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id  UUID        NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,
  p256dh      TEXT        NOT NULL,  -- base64url-encoded public key (encryption)
  auth        TEXT        NOT NULL,  -- base64url-encoded auth secret
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- One subscription per browser/device per creator
  UNIQUE(creator_id, endpoint)
);

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscriptions for creators. One row per browser/device. '
  'Deleted automatically when the creator unsubscribes or the subscription expires (410 Gone).';

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Creators can insert and delete their own subscriptions via the Angular client (anon key).
-- creator_id must match the authenticated user ID — the check applies on write.
CREATE POLICY "creators_manage_own_push_subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING  (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Index for fast lookup by creator_id (used by stripe-webhook to find subscriptions)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_creator_id
  ON public.push_subscriptions(creator_id);
