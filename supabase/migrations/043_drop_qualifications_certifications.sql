-- Migration 043: Drop qualifications and certifications columns
-- Education & Certifications feature has been removed from the product.
-- These JSONB columns are no longer written or read by any application code.

ALTER TABLE public.creators
  DROP COLUMN IF EXISTS qualifications,
  DROP COLUMN IF EXISTS certifications;
