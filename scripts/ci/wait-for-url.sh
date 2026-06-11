#!/usr/bin/env bash
set -euo pipefail

URL="${1:-}"
TIMEOUT_SEC="${2:-60}"
SLEEP_SEC="${3:-2}"

if [[ -z "$URL" ]]; then
  echo "usage: wait-for-url.sh <url> [timeoutSec=60] [sleepSec=2]" >&2
  exit 2
fi

deadline=$(( $(date +%s) + TIMEOUT_SEC ))
while true; do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    echo "ok: $URL"
    exit 0
  fi

  now=$(date +%s)
  if (( now >= deadline )); then
    echo "timeout after ${TIMEOUT_SEC}s: $URL" >&2
    exit 1
  fi

  sleep "$SLEEP_SEC"
done

