-- Add messages_enabled toggle to creator_settings (defaults true for backward compatibility)
ALTER TABLE public.creator_settings ADD COLUMN IF NOT EXISTS messages_enabled BOOLEAN DEFAULT false;
