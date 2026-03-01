-- Add follow-back request pricing to creator_settings
ALTER TABLE public.creator_settings ADD COLUMN IF NOT EXISTS follow_back_price INTEGER; -- in cents
ALTER TABLE public.creator_settings ADD COLUMN IF NOT EXISTS follow_back_enabled BOOLEAN DEFAULT false;

-- Allow 'follow_back' as a valid message_type
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('message', 'call', 'follow_back'));
