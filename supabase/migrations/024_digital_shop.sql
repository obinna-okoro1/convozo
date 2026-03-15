-- ============================================================================
-- Migration 024: Digital Shop
--
-- Introduces a creator-owned digital storefront where creators can list and
-- sell digital products (videos, audio, PDFs, images) and request-based items
-- (e.g. personalised shoutout videos).
--
-- Key changes:
--   1. Add `shop_enabled` boolean to creator_settings
--   2. New `shop_items` table — creator's product listings
--   3. New `shop_orders` table — purchase records (written by stripe-webhook
--      via service_role key; never directly by the client)
--   4. RLS policies: public read of active items; creator full CRUD on own items;
--      creator read of own orders
-- ============================================================================

-- ── 1. Extend creator_settings ───────────────────────────────────────────────

ALTER TABLE public.creator_settings
  ADD COLUMN IF NOT EXISTS shop_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── 2. shop_items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID        NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description    TEXT        CHECK (char_length(description) <= 500),
  price          INTEGER     NOT NULL CHECK (price >= 100),   -- cents; minimum $1.00
  item_type      TEXT        NOT NULL
                   CHECK (item_type IN ('video', 'audio', 'pdf', 'image', 'shoutout_request')),
  file_url       TEXT,                  -- download/delivery URL; NULL for request-based items
  thumbnail_url  TEXT,                  -- optional cover image shown on the store card
  preview_text   TEXT        CHECK (char_length(preview_text) <= 200),
  delivery_note  TEXT        CHECK (char_length(delivery_note) <= 300),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  -- true when the creator must manually fulfil (e.g. shoutout_request)
  is_request_based BOOLEAN   NOT NULL DEFAULT false,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. shop_orders ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             UUID        NOT NULL REFERENCES public.shop_items(id),
  creator_id          UUID        NOT NULL REFERENCES public.creators(id),
  buyer_name          TEXT        NOT NULL CHECK (char_length(buyer_name) BETWEEN 1 AND 200),
  buyer_email         TEXT        NOT NULL,
  amount_paid         INTEGER     NOT NULL CHECK (amount_paid > 0),   -- cents
  stripe_session_id   TEXT        UNIQUE NOT NULL,
  idempotency_key     TEXT        UNIQUE NOT NULL,
  -- 'completed' = digital delivery sent; 'pending' = request awaiting creator action
  status              TEXT        NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('pending', 'completed', 'refunded')),
  -- For request-based items: the buyer's brief / instructions to the creator
  request_details     TEXT        CHECK (char_length(request_details) <= 500),
  -- Fulfilment URL added by the creator after recording a shoutout etc.
  fulfillment_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shop_items_creator_id  ON public.shop_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_is_active   ON public.shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_orders_creator_id ON public.shop_orders(creator_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_item_id    ON public.shop_orders(item_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_session    ON public.shop_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_idemp      ON public.shop_orders(idempotency_key);

-- ── 5. Automatic updated_at trigger ─────────────────────────────────────────

-- Reuse the shared set_updated_at() function if it already exists from earlier
-- migrations; CREATE OR REPLACE is safe and idempotent.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER shop_items_set_updated_at
  BEFORE UPDATE ON public.shop_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER shop_orders_set_updated_at
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.shop_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- ── shop_items ──

-- Anyone (incl. anon) may read active listings
CREATE POLICY "shop_items_public_read"
  ON public.shop_items FOR SELECT
  USING (is_active = true);

-- Authenticated creator can see ALL their own items (including inactive drafts)
CREATE POLICY "shop_items_creator_select"
  ON public.shop_items FOR SELECT
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creator can insert new items into their own shop
CREATE POLICY "shop_items_creator_insert"
  ON public.shop_items FOR INSERT
  WITH CHECK (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creator can update their own items
CREATE POLICY "shop_items_creator_update"
  ON public.shop_items FOR UPDATE
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creator can delete their own items
CREATE POLICY "shop_items_creator_delete"
  ON public.shop_items FOR DELETE
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- ── shop_orders ──

-- Creators can read orders for their own shop
CREATE POLICY "shop_orders_creator_read"
  ON public.shop_orders FOR SELECT
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creator can update fulfillment_url on their orders (to deliver request-based items)
CREATE POLICY "shop_orders_creator_update"
  ON public.shop_orders FOR UPDATE
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- NOTE: INSERT on shop_orders is performed exclusively by the stripe-webhook
-- Edge Function using the service_role key, which bypasses RLS.
-- No client-side INSERT policy is intentionally provided.
