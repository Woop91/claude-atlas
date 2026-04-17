#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
( sleep 1 && ( command -v xdg-open >/dev/null && xdg-open http://localhost:4173/ \
              || command -v open >/dev/null && open http://localhost:4173/ \
              || true ) ) &
exec npm run dev
