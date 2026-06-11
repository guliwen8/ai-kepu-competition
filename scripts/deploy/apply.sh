#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/aikepu/releases}"
TAG="${TAG:-}"

API_TGZ="${API_TGZ:-api-${TAG}.tgz}"
ADMIN_WEB_TGZ="${ADMIN_WEB_TGZ:-admin-web-${TAG}.tgz}"
MINIAPP_TGZ="${MINIAPP_TGZ:-miniapp-${TAG}.tgz}"

API_BASE_URL="${API_BASE_URL:-}"

HOOK_BEFORE="${HOOK_BEFORE:-}"
HOOK_AFTER="${HOOK_AFTER:-}"
HOOK_PATH_BEFORE="${HOOK_PATH_BEFORE:-${DEPLOY_PATH}/hooks/before-deploy.sh}"
HOOK_PATH_AFTER="${HOOK_PATH_AFTER:-${DEPLOY_PATH}/hooks/after-deploy.sh}"

if [[ -z "$TAG" ]]; then
  echo "TAG is required" >&2
  exit 2
fi

relDir="${DEPLOY_PATH}/${TAG}"
mkdir -p "$relDir"

cd "$relDir"

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

unpack_if_exists() {
  local tgz="$1"
  local target="$2"
  if [[ -f "$tgz" ]]; then
    rm -rf "$target"
    mkdir -p "$target"
    tar -xzf "$tgz" -C "$target"
  fi
}

unpack_if_exists "$API_TGZ" "api"
unpack_if_exists "$ADMIN_WEB_TGZ" "admin-web"
unpack_if_exists "$MINIAPP_TGZ" "miniapp"

ln -sfn "$relDir" "${DEPLOY_PATH}/current"

run_hook "$HOOK_AFTER" "$HOOK_PATH_AFTER"

if [[ -n "$API_BASE_URL" ]] && command -v curl >/dev/null 2>&1; then
  curl -fsS "${API_BASE_URL%/}/healthz" >/dev/null
fi

echo "ok: deployed ${TAG} at ${DEPLOY_PATH}/current"

