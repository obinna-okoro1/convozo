-- Link-in-Bio feature: creator links + click tracking
-- =====================================================

-- Creator links table
CREATE TABLE public.creator_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,                  -- brand key, e.g. 'youtube', 'twitter', 'tiktok'
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link click tracking table
CREATE TABLE public.link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.creator_links(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Theme color column on creators (nullable, defaults to purple)
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#7c3aed';

-- Indexes
CREATE INDEX idx_creator_links_creator_id ON public.creator_links(creator_id);
CREATE INDEX idx_creator_links_position ON public.creator_links(creator_id, position);
CREATE INDEX idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX idx_link_clicks_creator_id ON public.link_clicks(creator_id);
CREATE INDEX idx_link_clicks_created_at ON public.link_clicks(created_at);

-- Updated-at trigger for creator_links
CREATE TRIGGER set_creator_links_updated_at
  BEFORE UPDATE ON public.creator_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RLS Policies
-- =====================================================================

ALTER TABLE public.creator_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- creator_links: public can read active links
CREATE POLICY "Public can read active creator links"
  ON public.creator_links FOR SELECT
  USING (is_active = true);

-- creator_links: creators can CRUD their own
CREATE POLICY "Creators can manage their own links"
  ON public.creator_links FOR ALL
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

-- link_clicks: anyone can insert (public click tracking)
CREATE POLICY "Anyone can insert link clicks"
  ON public.link_clicks FOR INSERT
  WITH CHECK (true);

-- link_clicks: creators can read their own click data
CREATE POLICY "Creators can read their own link clicks"
  ON public.link_clicks FOR SELECT
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- RPC: Increment click count (called from the client after a link click)
CREATE OR REPLACE FUNCTION public.increment_click_count(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.creator_links
  SET click_count = click_count + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for creator_links
ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_links;
