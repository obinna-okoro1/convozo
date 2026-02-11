-- Row Level Security Policies for Convozo
-- Run this migration after creating the tables

-- Enable RLS on all tables
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Creators policies
-- Creators can read their own profile
CREATE POLICY "Creators can view own profile"
  ON public.creators FOR SELECT
  USING (auth.uid() = user_id);

-- Creators can update their own profile
CREATE POLICY "Creators can update own profile"
  ON public.creators FOR UPDATE
  USING (auth.uid() = user_id);

-- Creators can insert their own profile
CREATE POLICY "Creators can insert own profile"
  ON public.creators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Anyone can view creator profiles by slug (for public page)
CREATE POLICY "Public can view creator profiles by slug"
  ON public.creators FOR SELECT
  USING (is_active = true);

-- Creator settings policies
-- Creators can read their own settings
CREATE POLICY "Creators can view own settings"
  ON public.creator_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = creator_settings.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can update their own settings
CREATE POLICY "Creators can update own settings"
  ON public.creator_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = creator_settings.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can insert their own settings
CREATE POLICY "Creators can insert own settings"
  ON public.creator_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = creator_settings.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Anyone can view settings for public pages (needed for pricing display)
CREATE POLICY "Public can view creator settings"
  ON public.creator_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = creator_settings.creator_id
      AND creators.is_active = true
    )
  );

-- Stripe accounts policies
-- Creators can read their own stripe account
CREATE POLICY "Creators can view own stripe account"
  ON public.stripe_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = stripe_accounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can update their own stripe account
CREATE POLICY "Creators can update own stripe account"
  ON public.stripe_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = stripe_accounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can insert their own stripe account
CREATE POLICY "Creators can insert own stripe account"
  ON public.stripe_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = stripe_accounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Messages policies
-- Creators can read messages sent to them
CREATE POLICY "Creators can view own messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = messages.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can update messages (for replies and marking as handled)
CREATE POLICY "Creators can update own messages"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = messages.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Service role can insert messages (used by Edge Functions after payment)
-- Note: Regular users cannot insert messages directly

-- Payments policies
-- Creators can view payments for their messages
CREATE POLICY "Creators can view own payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = payments.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Service role can insert payments (used by Edge Functions)
-- Note: Regular users cannot insert payments directly
