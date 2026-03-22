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

echo "📦 Pulling latest develop..."
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
