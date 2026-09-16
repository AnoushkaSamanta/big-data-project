#!/usr/bin/env bash
set -euo pipefail

# Wait for Docker Compose services to report healthy
for svc in "$@"; do
  printf "Waiting for %s to become healthy" "$svc"
  for i in $(seq 1 60); do
    status=$(docker compose ps --format json "$svc" 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "starting")
    if [[ "$status" == "healthy" ]]; then
      echo " -> OK"
      break
    fi
    printf "."
    sleep 2
    if [[ $i -eq 60 ]]; then
      echo " -> TIMEOUT"
      docker compose logs "$svc" --tail=20
      exit 1
    fi
  done
done
