#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

cleanup() {
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start Python PDF engine (Module 4)
python3 -m uvicorn document_engine.integration_api:app --host 127.0.0.1 --port 8001 &

# Start Python audit logger (Module 5)
python3 -m uvicorn backend.audit_server:app --host 127.0.0.1 --port 8002 &

# Start Node server (frontend + API gateway)
if [ "$NODE_ENV" = "production" ]; then
  npx tsx server.ts
else
  npm run dev
fi
