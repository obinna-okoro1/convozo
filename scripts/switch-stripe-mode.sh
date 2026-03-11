#!/usr/bin/env bash
# =============================================================================
# switch-stripe-mode.sh
#
# Switches the PRODUCTION Supabase project between Stripe test and live modes.
# This updates STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET via supabase secrets.
#
# Usage:
#   ./scripts/switch-stripe-mode.sh test   # Switch to Stripe test mode
#   ./scripts/switch-stripe-mode.sh live   # Switch back to Stripe live mode
#
# Prerequisites:
#   - supabase CLI installed and authenticated
#   - supabase/.env.stripe-keys exists with both key pairs filled in
#   - You are in the project root directory
# =============================================================================

set -euo pipefail

MODE="${1:-}"
KEYS_FILE="supabase/.env.stripe-keys"
PRODUCTION_PROJECT_REF="pfmscnpmpwxpdlrbeokb"

# ── Validate input ─────────────────────────────────────────────────────────────
if [[ "$MODE" != "live" && "$MODE" != "test" ]]; then
  echo "❌ Usage: $0 [live|test]"
  echo "   live  → Switch to Stripe live keys (production billing)"
  echo "   test  → Switch to Stripe test keys (no real money)"
  exit 1
fi

# ── Check keys file exists ────────────────────────────────────────────────────
if [[ ! -f "$KEYS_FILE" ]]; then
  echo "❌ Keys file not found: $KEYS_FILE"
  echo "   Create it from the template and fill in both key pairs."
  exit 1
fi

# ── Load keys (source safely) ─────────────────────────────────────────────────
# shellcheck disable=SC1090
source "$KEYS_FILE"

if [[ "$MODE" == "test" ]]; then
  STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY_TEST:-}"
  STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET_TEST:-}"
else
  STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY_LIVE:-}"
  STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET_LIVE:-}"
fi

# ── Validate keys are not placeholder values ───────────────────────────────────
if [[ -z "$STRIPE_SECRET_KEY" || "$STRIPE_SECRET_KEY" == *"REPLACE"* ]]; then
  echo "❌ ${MODE^^} STRIPE_SECRET_KEY is not set in $KEYS_FILE"
  echo "   Fill in the correct key before switching to $MODE mode."
  exit 1
fi

if [[ -z "$STRIPE_WEBHOOK_SECRET" || "$STRIPE_WEBHOOK_SECRET" == *"REPLACE"* ]]; then
  echo "❌ ${MODE^^} STRIPE_WEBHOOK_SECRET is not set in $KEYS_FILE"
  echo "   Fill in the correct secret before switching to $MODE mode."
  exit 1
fi

# ── Confirm before proceeding ─────────────────────────────────────────────────
KEY_PREFIX="${STRIPE_SECRET_KEY:0:14}..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Switching production Stripe → ${MODE^^} mode"
echo "  Project: $PRODUCTION_PROJECT_REF"
echo "  Key:     $KEY_PREFIX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -r -p "Proceed? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# ── Link to production and apply secrets ──────────────────────────────────────
echo ""
echo "🔗 Linking to production project..."
supabase link --project-ref "$PRODUCTION_PROJECT_REF"

echo "🔑 Setting STRIPE_SECRET_KEY..."
supabase secrets set "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"

echo "🔑 Setting STRIPE_WEBHOOK_SECRET..."
supabase secrets set "STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET"

echo ""
echo "✅ Production is now on Stripe ${MODE^^} mode."

if [[ "$MODE" == "test" ]]; then
  echo ""
  echo "⚠️  REMINDER: Test mode — no real money is charged."
  echo "   Stripe Dashboard: https://dashboard.stripe.com/test/webhooks"
  echo "   Verify the webhook endpoint for the production URL is in TEST mode."
else
  echo ""
  echo "✅ LIVE mode active — real payments are now enabled."
  echo "   Stripe Dashboard: https://dashboard.stripe.com/webhooks"
  echo "   Verify the webhook endpoint for the production URL is in LIVE mode."
fi
