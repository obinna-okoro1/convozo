-- CVZ-053: Physical meeting verification code
--
-- Physical (in-person) sessions cannot use the automatic video-call completion
-- flow. Instead, a one-time CVZ code is generated at checkout and sent to the
-- client in their confirmation email. The client presents the code to the expert
-- at the meeting; the expert enters it in their dashboard to mark the session as
-- completed and trigger the 7-day payout hold.
--
-- The code is nulled out after successful verification (single-use).

ALTER TABLE call_bookings
  ADD COLUMN IF NOT EXISTS meeting_verification_code TEXT NULL;

-- Sparse index: only physical bookings with a pending code ever have this set.
CREATE INDEX IF NOT EXISTS idx_call_bookings_verification_code
  ON call_bookings (meeting_verification_code)
  WHERE meeting_verification_code IS NOT NULL;
