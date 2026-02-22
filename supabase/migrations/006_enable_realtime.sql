-- Enable Supabase Realtime for the messages table
-- so the creator dashboard updates instantly when new messages arrive or replies are sent
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
