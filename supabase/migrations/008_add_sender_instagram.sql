-- Migration: Add sender_instagram column to messages table
-- This allows fans to optionally share their Instagram handle when sending a message

ALTER TABLE public.messages
ADD COLUMN sender_instagram text;

-- Add a comment for documentation
COMMENT ON COLUMN public.messages.sender_instagram IS 'Optional Instagram handle of the message sender';
