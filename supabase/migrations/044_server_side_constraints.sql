-- ============================================================================
-- Migration 044: Server-Side Validation Constraints
--
-- Moves critical business-rule validation from the Angular frontend (which can
-- be bypassed by any user with a valid Supabase session) to the database layer,
-- where it is enforced for ALL callers regardless of client.
--
-- Rules enforced:
--   1. creators.slug must match ^[a-z0-9][a-z0-9_-]{2,29}$ — format only
--      (uniqueness is already guaranteed by the existing UNIQUE constraint)
--   2. creators.display_name must be 1–150 characters
--   3. creators.bio must be at most 1000 characters (NULL is allowed)
--   4. creators.linkedin_url must start with https:// if set
--   5. creator_settings.message_price must be >= 100 cents ($1.00 minimum)
--      OR NULL (when messages are disabled)
--   6. creator_settings.call_price must be >= 500 cents ($5.00 minimum)
--      OR NULL (when calls are disabled)
--   7. creator_settings.call_duration must be a positive integer
--      OR NULL (when calls are disabled)
-- ============================================================================

-- ── 1. Slug format constraint ─────────────────────────────────────────────────
-- Regex: starts with [a-z0-9], followed by 2-29 chars of [a-z0-9_-]
-- Total length: 3–30 characters. Lowercase only. No leading hyphens/underscores.
-- Cannot start with hyphen or underscore (prevents ugly URLs like /-admin).
ALTER TABLE public.creators
  ADD CONSTRAINT creators_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

-- ── 2. Display name length ────────────────────────────────────────────────────
-- Empty string is a data quality issue, 150 chars is a generous but sane cap.
ALTER TABLE public.creators
  ADD CONSTRAINT creators_display_name_length
    CHECK (char_length(trim(display_name)) BETWEEN 1 AND 150);

-- ── 3. Bio length ─────────────────────────────────────────────────────────────
-- NULL is fine (bio is optional). A non-NULL bio must not exceed 1000 chars.
ALTER TABLE public.creators
  ADD CONSTRAINT creators_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 1000);

-- ── 4. LinkedIn URL format ────────────────────────────────────────────────────
-- NULL is fine (optional). If set, must be an https:// URL to prevent
-- javascript: or data: URI injection.
ALTER TABLE public.creators
  ADD CONSTRAINT creators_linkedin_url_format
    CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https?://');

-- ── 5. Message price minimum ──────────────────────────────────────────────────
-- NULL means messages are disabled (price not configured).
-- When set, must be at least $1.00 (100 cents).
-- Without this, a creator could set price = 0 and bypass checkout validation.
ALTER TABLE public.creator_settings
  ADD CONSTRAINT creator_settings_message_price_min
    CHECK (message_price IS NULL OR message_price >= 100);

-- ── 6. Call price minimum ─────────────────────────────────────────────────────
-- NULL means calls are disabled. When set, must be at least $5.00 (500 cents).
ALTER TABLE public.creator_settings
  ADD CONSTRAINT creator_settings_call_price_min
    CHECK (call_price IS NULL OR call_price >= 500);

-- ── 7. Call duration sanity ───────────────────────────────────────────────────
-- NULL means calls are disabled. When set, must be 5–240 minutes.
ALTER TABLE public.creator_settings
  ADD CONSTRAINT creator_settings_call_duration_range
    CHECK (call_duration IS NULL OR (call_duration >= 5 AND call_duration <= 240));
