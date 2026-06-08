#!/usr/bin/env bash
set -euo pipefail

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
