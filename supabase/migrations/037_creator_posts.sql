-- Migration 037: Creator Posts
-- Experts can publish short posts (≤ 100 words) visible on their public profile.
-- Posts are Twitter-like: plain text, time-ordered, public feed with a library view.

-- ── 1. Table ──────────────────────────────────────────────────────────────────
CREATE TABLE public.creator_posts (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id   uuid        NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  content      text        NOT NULL,
  is_published boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Content must be non-empty
ALTER TABLE public.creator_posts
  ADD CONSTRAINT creator_posts_content_not_empty CHECK (trim(content) <> '');

-- ── 2. Auto-update updated_at ─────────────────────────────────────────────────
CREATE TRIGGER set_creator_posts_updated_at
  BEFORE UPDATE ON public.creator_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
-- Partial index covering only published posts — powers the public profile feed
CREATE INDEX creator_posts_feed_idx
  ON public.creator_posts (creator_id, created_at DESC)
  WHERE is_published = true;

-- ── 4. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts (public profile feed + library)
CREATE POLICY "Public can read published posts"
  ON public.creator_posts FOR SELECT
  USING (is_published = true);

-- Authenticated creators can fully manage their own posts
CREATE POLICY "Creator manages own posts"
  ON public.creator_posts FOR ALL
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );
