#!/usr/bin/env bash
set -euo pipefail

echo "Checking coverage prior baseline in PostgreSQL..."

COUNT=$(docker compose exec -T postgres psql -U postgres -d ais -t -A -c \
  "SELECT count(*) FROM coverage_prior WHERE n_obs >= 500;" 2>/dev/null || echo "0")

if [ "${COUNT}" -eq "0" ]; then
  echo "⚠️ WARNING: coverage_prior table has 0 confident cells (n_obs >= 500)."
  echo "   Running the absence sweeper without a prior will suppress all alerts by design."
  echo "   Tip: Run 'make prior' or insert seed prior rows before starting the stream."
else
  echo "✓ Coverage prior verified: ${COUNT} confident H3 cells available."
fi
