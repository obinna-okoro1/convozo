-- Migration 041: Expert credentials & professional categories
--
-- Adds a professional taxonomy (category + subcategory), profession details,
-- education history, and certification/licence data to the creators table.
--
-- All new columns are nullable — existing creators are unaffected.
-- JSONB arrays default to [] so the Angular app never receives null for those fields.
--
-- Future: the category index enables a directory/search feature where clients
-- can browse experts by field of practice.

-- ── 1. Category & profession columns ─────────────────────────────────────────
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS category            TEXT,
  ADD COLUMN IF NOT EXISTS subcategory         TEXT,
  -- Free-text title the expert writes themselves, e.g. "Senior Family Lawyer"
  ADD COLUMN IF NOT EXISTS profession_title    TEXT,
  -- Whole number — no floats for UI fields either
  ADD COLUMN IF NOT EXISTS years_of_experience SMALLINT
    CONSTRAINT creators_years_of_exp_range CHECK (years_of_experience BETWEEN 0 AND 80),
  ADD COLUMN IF NOT EXISTS linkedin_url        TEXT;

-- ── 2. Credentials (JSONB arrays) ─────────────────────────────────────────────
-- qualifications schema: [{ institution: TEXT, degree: TEXT, graduation_year: INT|null }]
-- certifications schema: [{ name: TEXT, issuer: TEXT, year: INT|null }]
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Enforce that these columns are always JSON arrays (not objects or scalars)
ALTER TABLE public.creators
  ADD CONSTRAINT creators_qualifications_is_array
    CHECK (jsonb_typeof(qualifications) = 'array'),
  ADD CONSTRAINT creators_certifications_is_array
    CHECK (jsonb_typeof(certifications) = 'array');

-- ── 3. Index for future directory / category-based search ────────────────────
-- Partial — only active, categorised creators are worth indexing
CREATE INDEX IF NOT EXISTS creators_category_idx
  ON public.creators (category, subcategory)
  WHERE is_active = true AND category IS NOT NULL;
