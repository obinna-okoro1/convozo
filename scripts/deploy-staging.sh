#!/bin/bash
# deploy-staging.sh
# Merges the current feature branch → develop with a guaranteed merge commit so
# Cloudflare always triggers a fresh staging build.
#
# Usage: ./scripts/deploy-staging.sh

set -e

CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" == "develop" || "$CURRENT_BRANCH" == "main" ]]; then
  echo "❌ You are on '$CURRENT_BRANCH'. Run this from your feature branch."
  exit 1
fi

echo "🔍 Checking git status..."
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

echo "🧪 Running unit tests..."
npx ng test --watch=false --browsers=ChromeHeadless
if [[ $? -ne 0 ]]; then
  echo "❌ Tests failed. Merge to develop aborted."
  exit 1
fi
echo "✅ All tests passed."

echo "⚙️  Running Deno backend unit tests..."
DENO_BIN="$(command -v deno 2>/dev/null || echo "$HOME/.deno/bin/deno")"
(cd supabase/functions && "$DENO_BIN" task test)
if [[ $? -ne 0 ]]; then
  echo "❌ Backend unit tests failed. Merge to develop aborted."
  exit 1
fi
echo "✅ Backend unit tests passed."

echo "🔌 Running backend integration tests..."
if ! curl -sf http://127.0.0.1:54321/health >/dev/null 2>&1; then
  echo "⚠️  Local Supabase not running — skipping integration tests."
  echo "   Run 'supabase start && supabase db reset' then re-run to include them."
else
  supabase functions serve >/tmp/convozo-functions-serve.log 2>&1 &
  FUNCTIONS_PID=$!
  sleep 6
  set +e
  INTEGRATION_FAILED=0
  python3 supabase/functions/tests/test_analytics_retention.py || INTEGRATION_FAILED=1
  python3 supabase/functions/tests/test_functions.py            || INTEGRATION_FAILED=1
  python3 supabase/functions/tests/test_payment_flows.py        || INTEGRATION_FAILED=1
  kill "$FUNCTIONS_PID" 2>/dev/null
  set -e
  if [[ $INTEGRATION_FAILED -ne 0 ]]; then
    echo "❌ Backend integration tests failed. Merge to develop aborted."
    exit 1
  fi
  echo "✅ Backend integration tests passed."
fi

echo "🌐 Running E2E tests against local dev server..."
npx start-server-and-test 'npx ng serve' http://localhost:4200 'npx cypress run'
CYPRESS_EXIT=$?
if [[ $CYPRESS_EXIT -ne 0 ]]; then
  echo "❌ E2E tests failed. Merge to develop aborted."
  exit 1
fi
echo "✅ E2E tests passed."

echo "� Verifying production build..."
npx ng build --configuration=production
if [[ $? -ne 0 ]]; then
  echo "❌ Production build failed. Merge to develop aborted."
  exit 1
fi
echo "✅ Production build succeeded."

echo "�📦 Pulling latest develop..."
git checkout develop
git pull origin develop

echo "🔀 Merging $CURRENT_BRANCH → develop (--no-ff to force a new merge commit)..."
git merge --no-ff "$CURRENT_BRANCH" -m "chore: merge $CURRENT_BRANCH into develop for staging deploy"

echo "⬆️  Pushing develop to origin (triggers Cloudflare staging build)..."
git push origin develop

echo ""
echo "✅ Done! Cloudflare will now build develop with the staging config."
echo "   Monitor: https://dash.cloudflare.com → Pages → convozo → Deployments"
echo ""
echo "🔁 Returning to your feature branch: $CURRENT_BRANCH"
git checkout "$CURRENT_BRANCH"
