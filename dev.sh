#!/usr/bin/env bash
set -euo pipefail

# GitHub authentication for Exalcopl
GITHUB_ACCOUNT="exalcopl"
echo "Checking GitHub account..."
CURRENT_ACCOUNT=$(gh api user --jq '.login' 2>/dev/null || echo "")

if [ "$CURRENT_ACCOUNT" != "$GITHUB_ACCOUNT" ]; then
  if [ -z "$CURRENT_ACCOUNT" ]; then
    echo "❌ Not logged in to GitHub"
  else
    echo "⚠️  Currently logged in as: $CURRENT_ACCOUNT"
  fi
  echo "📝 Logging in to GitHub account: $GITHUB_ACCOUNT"
  gh auth login
else
  echo "✅ Logged in as: $CURRENT_ACCOUNT"
fi
echo ""

PORT=3000

# Kill anything on port 3000
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "Killing process(es) on port $PORT: $PIDS"
  echo "$PIDS" | xargs kill -9
fi

# Dev credentials
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dev credentials"
echo "  Email:  admin@exalco.pl"
echo "  Hasło:  Admin12345!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Convex dev in background
echo "Starting Convex dev..."
npx convex dev &
CONVEX_PID=$!

# Give Convex a moment to initialize
sleep 2

# Start Next.js
echo "Starting Next.js on port $PORT..."
npx next dev --port $PORT &
NEXT_PID=$!

# Forward signals to both children
trap "kill $CONVEX_PID $NEXT_PID 2>/dev/null; exit" INT TERM

# Wait for both
wait $CONVEX_PID $NEXT_PID
