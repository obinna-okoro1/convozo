-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 046: pg_cron schedules for internal edge function crons
--
-- Registers two recurring cron jobs using pg_cron + pg_net:
--
--   check-no-show   — every 10 minutes
--     Scans call_bookings for overdue in-progress calls and marks no-shows.
--     Requires INTERNAL_SECRET to be set as a Supabase secret.
--
--   release-payout  — every hour (on the hour)
--     Scans call_bookings for pending_release rows whose payout_release_at
--     has elapsed and transitions them to released.
--
-- Notes:
--   • pg_cron and pg_net are enabled by default on Supabase.
--   • This migration is idempotent: cron.unschedule() is called first so
--     re-running it does not create duplicates.
--   • The INTERNAL_SECRET is read from app.settings (set via Vault or
--     supabase secrets set INTERNAL_SECRET=...).
--   • In local dev the edge functions are invoked via supabase functions serve;
--     cron jobs do not fire locally — use direct HTTP calls for testing.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions (no-op if already enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Store function base URL as a Postgres setting ────────────────────────────
-- On the hosted platform this is the project's functions URL.
-- Override by running: ALTER DATABASE postgres SET app.functions_url = '...';
do $$
begin
  if current_setting('app.functions_url', true) is null or current_setting('app.functions_url', true) = '' then
    perform set_config('app.functions_url',
      'https://' || current_setting('app.supabase_url', true) || '/functions/v1',
      false);
  end if;
exception when others then
  -- Silently skip if setting is not available (e.g. local dev without Vault)
  null;
end $$;

-- ── Unschedule existing jobs (idempotent) ────────────────────────────────────
select cron.unschedule('check-no-show')  where exists (select 1 from cron.job where jobname = 'check-no-show');
select cron.unschedule('release-payout') where exists (select 1 from cron.job where jobname = 'release-payout');

-- ── Schedule: check-no-show (every 10 minutes) ───────────────────────────────
select cron.schedule(
  'check-no-show',
  '*/10 * * * *',
  $$
  select net.http_post(
    url    := current_setting('app.functions_url') || '/check-no-show',
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-internal-secret', current_setting('app.settings.INTERNAL_SECRET', true)
    ),
    body   := '{}'::jsonb
  ) as request_id;
  $$
);

-- ── Schedule: release-payout (every hour on the hour) ────────────────────────
select cron.schedule(
  'release-payout',
  '0 * * * *',
  $$
  select net.http_post(
    url    := current_setting('app.functions_url') || '/release-payout',
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-internal-secret', current_setting('app.settings.INTERNAL_SECRET', true)
    ),
    body   := '{}'::jsonb
  ) as request_id;
  $$
);

comment on extension pg_cron is
  'Cron job scheduler — used by Convozo for check-no-show (*/10) and release-payout (0 * * * *)';
