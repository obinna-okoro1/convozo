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

echo "📦 Pulling latest develop..."
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
