-- ============================================================
-- 018_account_change_requests.sql
-- Bank account change requests — admin must approve before
-- the subaccount details are updated in flutterwave_subaccounts.
-- ============================================================

CREATE TABLE public.account_change_requests (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id               UUID        NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  requested_bank_code      TEXT        NOT NULL,
  requested_bank_name      TEXT        NOT NULL,
  requested_account_number TEXT        NOT NULL,
  requested_country        TEXT        NOT NULL DEFAULT 'NG',
  verified_account_name    TEXT        NOT NULL,
  status                   TEXT        NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes              TEXT,
  reviewed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER update_account_change_requests_updated_at
  BEFORE UPDATE ON public.account_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Trigger: stamp reviewed_at when admin changes the status ────────────────

CREATE OR REPLACE FUNCTION set_change_request_reviewed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected') THEN
    NEW.reviewed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stamp_change_request_reviewed_at
  BEFORE UPDATE ON public.account_change_requests
  FOR EACH ROW EXECUTE FUNCTION set_change_request_reviewed_at();

-- ── Trigger: auto-apply approval to flutterwave_subaccounts ────────────────
-- When admin sets status → 'approved', the local subaccount record is updated
-- automatically. The Flutterwave-side update is handled separately by admin.

CREATE OR REPLACE FUNCTION apply_approved_change_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.flutterwave_subaccounts
    SET
      bank_name      = NEW.requested_bank_name,
      account_number = NEW.requested_account_number,
      country        = NEW.requested_country,
      updated_at     = NOW()
    WHERE creator_id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_change_request_approved
  AFTER UPDATE ON public.account_change_requests
  FOR EACH ROW EXECUTE FUNCTION apply_approved_change_request();

-- ── Row-Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.account_change_requests ENABLE ROW LEVEL SECURITY;

-- Creators can view their own requests
CREATE POLICY "Creators can view own change requests"
  ON public.account_change_requests
  FOR SELECT TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creators can insert (submit) new requests
CREATE POLICY "Creators can submit change requests"
  ON public.account_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Service role has unrestricted access (for admin operations)
CREATE POLICY "Service role full access to change requests"
  ON public.account_change_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
