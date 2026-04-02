#!/usr/bin/env bash
# =============================================================================
# migrate-stripe-express-to-standard.sh
#
# Migrates all existing Stripe Connect Express accounts to Standard.
#
# What this does:
#   1. Reads all real Stripe account IDs from the currently linked Supabase project
#      (local Docker DB or remote depending on SUPABASE_DB_URL).
#   2. For each account that is an Express account, deletes it from Stripe via the API.
#      (Stripe does not support converting account types — the only path is
#       delete the Express account and let the expert re-onboard as Standard.)
#   3. Removes all rows from public.stripe_accounts so experts are prompted
#      to reconnect via the new Standard onboarding flow on next login.
#
# IMPORTANT:
#   - Run against STAGING first. Verify. Then run against PRODUCTION.
#   - Experts will lose their connected Stripe account and must re-onboard.
#   - Ensure there are no pending payouts on Express accounts before running.
#   - Stripe Express accounts with active balances should be paid out first
#     via the Stripe Dashboard before deletion.
#
# Usage:
#   # Local
#   STRIPE_SECRET_KEY=sk_test_... ./scripts/migrate-stripe-express-to-standard.sh --local
#
#   # Staging
#   supabase link --project-ref fzltvpbyhnvviuzanyha
#   STRIPE_SECRET_KEY=sk_test_... SUPABASE_DB_URL="postgres://postgres:<pass>@db.fzltvpbyhnvviuzanyha.supabase.co:5432/postgres" \
#     ./scripts/migrate-stripe-express-to-standard.sh --remote
#
#   # Production
#   supabase link --project-ref pfmscnpmpwxpdlrbeokb
#   STRIPE_SECRET_KEY=sk_live_... SUPABASE_DB_URL="postgres://postgres:<pass>@db.pfmscnpmpwxpdlrbeokb.supabase.co:5432/postgres" \
#     ./scripts/migrate-stripe-express-to-standard.sh --remote
# =============================================================================

set -euo pipefail

MODE="${1:-}"

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "❌  STRIPE_SECRET_KEY is not set. Aborting."
  exit 1
fi

if [[ "$MODE" != "--local" && "$MODE" != "--remote" ]]; then
  echo "Usage: $0 --local | --remote"
  exit 1
fi

echo ""
echo "============================================================"
echo "  Stripe Connect Express → Standard Migration"
echo "  Mode: $MODE"
echo "============================================================"
echo ""

# ── Step 1: Fetch all Stripe account IDs from the DB ─────────────────────────

echo "▶  Fetching existing Stripe account IDs from database..."

if [[ "$MODE" == "--local" ]]; then
  ACCOUNTS=$(docker exec supabase_db_convozo psql -U postgres -d postgres -t -A \
    -c "SELECT stripe_account_id FROM public.stripe_accounts WHERE stripe_account_id LIKE 'acct_%' AND stripe_account_id NOT LIKE 'acct_test_%';" 2>&1)
else
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "❌  SUPABASE_DB_URL is not set for remote mode. Aborting."
    exit 1
  fi
  ACCOUNTS=$(psql "$SUPABASE_DB_URL" -t -A \
    -c "SELECT stripe_account_id FROM public.stripe_accounts WHERE stripe_account_id LIKE 'acct_%' AND stripe_account_id NOT LIKE 'acct_test_%';" 2>&1)
fi

if [[ -z "$ACCOUNTS" ]]; then
  echo "✅  No real Stripe accounts found in the database. Nothing to migrate."
else
  echo "   Found accounts:"
  echo "$ACCOUNTS" | while read -r ACCT; do
    echo "   - $ACCT"
  done
  echo ""

  # ── Step 2: Check each account type in Stripe and delete if Express ──────

  echo "▶  Checking account types and deleting Express accounts from Stripe..."
  echo ""

  echo "$ACCOUNTS" | while read -r ACCOUNT_ID; do
    [[ -z "$ACCOUNT_ID" ]] && continue

    echo -n "   [$ACCOUNT_ID] Checking type... "

    ACCOUNT_JSON=$(curl -s -X GET "https://api.stripe.com/v1/accounts/${ACCOUNT_ID}" \
      -u "${STRIPE_SECRET_KEY}:" \
      -H "Stripe-Version: 2024-06-20")

    ACCOUNT_TYPE=$(echo "$ACCOUNT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('type','unknown'))" 2>/dev/null || echo "unknown")

    if [[ "$ACCOUNT_TYPE" == "express" ]]; then
      echo "Express — deleting from Stripe..."

      DELETE_RESPONSE=$(curl -s -X DELETE "https://api.stripe.com/v1/accounts/${ACCOUNT_ID}" \
        -u "${STRIPE_SECRET_KEY}:" \
        -H "Stripe-Version: 2024-06-20")

      DELETED=$(echo "$DELETE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('deleted','false'))" 2>/dev/null || echo "false")

      if [[ "$DELETED" == "True" || "$DELETED" == "true" ]]; then
        echo "   ✅  $ACCOUNT_ID deleted from Stripe."
      else
        echo "   ⚠️   Could not delete $ACCOUNT_ID from Stripe. Response:"
        echo "       $DELETE_RESPONSE"
        echo "       You may need to delete this manually in the Stripe Dashboard."
      fi

    elif [[ "$ACCOUNT_TYPE" == "standard" ]]; then
      echo "already Standard — skipping Stripe deletion."
    else
      echo "type=$ACCOUNT_TYPE — skipping (check manually)."
    fi
  done
fi

echo ""

# ── Step 3: Clear stripe_accounts table (skip seed/test rows) ────────────────

echo "▶  Clearing stripe_accounts table in the database..."
echo "   (Test/seed rows with 'acct_test_' prefix are preserved)"

if [[ "$MODE" == "--local" ]]; then
  docker exec supabase_db_convozo psql -U postgres -d postgres \
    -c "DELETE FROM public.stripe_accounts WHERE stripe_account_id NOT LIKE 'acct_test_%';" 2>&1
  ROW_COUNT=$(docker exec supabase_db_convozo psql -U postgres -d postgres -t -A \
    -c "SELECT COUNT(*) FROM public.stripe_accounts WHERE stripe_account_id NOT LIKE 'acct_test_%';" 2>&1)
else
  psql "$SUPABASE_DB_URL" \
    -c "DELETE FROM public.stripe_accounts WHERE stripe_account_id NOT LIKE 'acct_test_%';"
  ROW_COUNT=$(psql "$SUPABASE_DB_URL" -t -A \
    -c "SELECT COUNT(*) FROM public.stripe_accounts WHERE stripe_account_id NOT LIKE 'acct_test_%';")
fi

if [[ "$ROW_COUNT" -eq 0 ]]; then
  echo "   ✅  stripe_accounts table cleared. $ROW_COUNT non-seed rows remaining."
else
  echo "   ⚠️   $ROW_COUNT rows remain. Please check manually."
fi

echo ""
echo "============================================================"
echo "  Migration complete."
echo ""
echo "  Next steps:"
echo "  1. Deploy the updated create-connect-account function:"
echo "     supabase functions deploy create-connect-account --no-verify-jwt"
echo ""
echo "  2. Notify affected experts to reconnect their Stripe account"
echo "     via their Settings → Payments page."
echo ""
echo "  3. Their onboarding_completed flag is now false — the"
echo "     dashboard tabs (Inbox, Analytics, Bookings, Availability)"
echo "     will be hidden until they complete Standard onboarding."
echo "============================================================"
echo ""
