-- Migration: Add phone_number column to creators table
-- Phone number is mandatory for new creators (with country code, e.g., "+1 555-123-4567")

ALTER TABLE public.creators
ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '';

-- Add a comment for documentation
COMMENT ON COLUMN public.creators.phone_number IS 'Creator phone number with country code, e.g. +1 555-123-4567. Required during onboarding.';
