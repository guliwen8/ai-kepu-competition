#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/aikepu/releases}"
TAG="${TAG:-}"
API_BASE_URL="${API_BASE_URL:-}"

HOOK_BEFORE="${HOOK_BEFORE:-}"
HOOK_AFTER="${HOOK_AFTER:-}"
HOOK_PATH_BEFORE="${HOOK_PATH_BEFORE:-${DEPLOY_PATH}/hooks/before-rollback.sh}"
HOOK_PATH_AFTER="${HOOK_PATH_AFTER:-${DEPLOY_PATH}/hooks/after-rollback.sh}"

if [[ -z "$TAG" ]]; then
  echo "TAG is required" >&2
  exit 2
fi

relDir="${DEPLOY_PATH}/${TAG}"
if [[ ! -d "$relDir" ]]; then
  echo "release dir not found: $relDir" >&2
  exit 1
fi

run_hook() {
  local cmd="$1"
  local file="$2"
  if [[ -n "$cmd" ]]; then
    bash -lc "$cmd"
    return 0
  fi
  if [[ -f "$file" ]]; then
    bash "$file"
    return 0
  fi
  return 0
}

run_hook "$HOOK_BEFORE" "$HOOK_PATH_BEFORE"

ln -sfn "$relDir" "${DEPLOY_PATH}/current"

run_hook "$HOOK_AFTER" "$HOOK_PATH_AFTER"

if [[ -n "$API_BASE_URL" ]] && command -v curl >/dev/null 2>&1; then
  curl -fsS "${API_BASE_URL%/}/healthz" >/dev/null
fi

echo "ok: rolled back to ${TAG} at ${DEPLOY_PATH}/current"

