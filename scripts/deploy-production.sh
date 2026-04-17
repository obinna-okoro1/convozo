#!/bin/bash
# deploy-production.sh
# Merges develop → main with a guaranteed merge commit so Cloudflare always
# triggers a fresh production build (not a cached develop build).
#
# Usage: ./scripts/deploy-production.sh

set -e

CURRENT_BRANCH=$(git branch --show-current)

echo "🔍 Checking git status..."
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

echo "🧪 Running unit tests..."
npx ng test --watch=false --browsers=ChromeHeadless
if [[ $? -ne 0 ]]; then
  echo "❌ Tests failed. Deployment aborted."
  exit 1
fi
echo "✅ All tests passed."

echo "⚙️  Running Deno backend unit tests..."
DENO_BIN="$(command -v deno 2>/dev/null || echo "$HOME/.deno/bin/deno")"
(cd supabase/functions && "$DENO_BIN" task test)
if [[ $? -ne 0 ]]; then
  echo "❌ Backend unit tests failed. Deployment aborted."
  exit 1
fi
echo "✅ Backend unit tests passed."

echo "🔌 Running backend integration tests..."
FUNCTIONS_PID=""
LOCAL_SUPABASE_RUNNING=0
if ! curl -sf http://127.0.0.1:54321/health >/dev/null 2>&1; then
  echo "⚠️  Local Supabase not running — skipping integration tests."
  echo "   Run 'supabase start && supabase db reset' then re-run to include them."
else
  LOCAL_SUPABASE_RUNNING=1
  # Start functions serve — keep it alive through both integration AND E2E phases.
  # E2E test 09-call-booking-slots directly calls the Edge Function endpoint.
  supabase functions serve >/tmp/convozo-functions-serve.log 2>&1 &
  FUNCTIONS_PID=$!
  sleep 6
  set +e
  INTEGRATION_FAILED=0
  python3 supabase/functions/tests/test_analytics_retention.py || INTEGRATION_FAILED=1
  python3 supabase/functions/tests/test_functions.py            || INTEGRATION_FAILED=1
  python3 supabase/functions/tests/test_payment_flows.py        || INTEGRATION_FAILED=1
  set -e
  if [[ $INTEGRATION_FAILED -ne 0 ]]; then
    kill "$FUNCTIONS_PID" 2>/dev/null
    echo "❌ Backend integration tests failed. Deployment aborted."
    exit 1
  fi
  echo "✅ Backend integration tests passed."
fi

echo "🌐 Running E2E tests..."
if [[ -n "${STAGING_URL:-}" ]]; then
  echo "   Target: $STAGING_URL (live staging)"
  npx cypress run --config "baseUrl=$STAGING_URL"
  CYPRESS_EXIT=$?
else
  echo "   ⚠️  STAGING_URL not set — running against local dev server."
  echo "   Tip: export STAGING_URL=https://your-branch.convozo.pages.dev"
  npx start-server-and-test 'npx ng serve' http://localhost:4200 'npx cypress run'
  CYPRESS_EXIT=$?
fi
# Kill functions serve now that both integration and E2E phases are complete
if [[ -n "$FUNCTIONS_PID" ]]; then
  kill "$FUNCTIONS_PID" 2>/dev/null
fi
if [[ $CYPRESS_EXIT -ne 0 ]]; then
  echo "❌ E2E tests failed. Deployment aborted."
  exit 1
fi
echo "✅ E2E tests passed."

echo "� Verifying production build..."
npx ng build --configuration=production
if [[ $? -ne 0 ]]; then
  echo "❌ Production build failed. Deployment aborted."
  exit 1
fi
echo "✅ Production build succeeded."

echo "�📦 Pulling latest develop..."
git checkout develop
git pull origin develop

echo "🚀 Merging develop → main (--no-ff to force a new merge commit)..."
git checkout main
git pull origin main
git merge --no-ff develop -m "chore: merge develop into main for production deploy"

echo "⬆️  Pushing main to origin (triggers Cloudflare production build)..."
git push origin main

echo "🔄 Syncing develop with main..."
git checkout develop
git merge main
git push origin develop

echo ""
echo "✅ Done! Cloudflare will now build main with the production config."
echo "   Monitor: https://dash.cloudflare.com → Pages → convozo → Deployments"
echo ""
echo "🔁 Returning to your previous branch: $CURRENT_BRANCH"
git checkout "$CURRENT_BRANCH"
