#!/usr/bin/env bash
# scripts/tiktok-oauth.sh — BBF · TikTok Content Posting API OAuth helpers.
# ─────────────────────────────────────────────────────────────────────────────
# Thin wrappers around the deployed bbf-tiktok-oauth / bbf-tiktok-publish edge
# functions, so the OAuth bootstrap + readiness checks live in version control
# and run programmatically — not pasted from chat history.
#
#   ./scripts/tiktok-oauth.sh authorize   # print the TikTok consent URL to open once
#   ./scripts/tiktok-oauth.sh verify      # creator info + allowed privacy levels (no post)
#   ./scripts/tiktok-oauth.sh status      # token presence / expiry (no external call)
#   ./scripts/tiktok-oauth.sh refresh     # force an access-token refresh
#
# REQUIRES (secret): BBF_COACH_AGENT_TOKEN — the X-BBF-Admin-Token shared secret.
#   Put it in .env (auto-sourced) or export it. NEVER hardcode it here.
# Public + overridable: SUPABASE_ANON_KEY (gateway apikey), BBF_FUNCTIONS_BASE.

set -euo pipefail

PROJECT_REF="ihclbceghxpuawymlvgi"

# Auto-source .env (for BBF_COACH_AGENT_TOKEN / SUPABASE_ANON_KEY) when present.
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

FUNCTIONS_BASE="${BBF_FUNCTIONS_BASE:-https://${PROJECT_REF}.supabase.co/functions/v1}"
# Public anon key (already shipped in the client bundle — not a secret). Overridable.
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY2xiY2VnaHhwdWF3eW1sdmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTk1MDIsImV4cCI6MjA5MTg3NTUwMn0.0f7d1aqtygMR__QiyYYUB87yrFLaSRihVQdiFaIhsP0}"
ADMIN_TOKEN="${BBF_COACH_AGENT_TOKEN:-}"

die() { printf '✗ %s\n' "$1" >&2; exit 1; }

# call <function-name> <json-body>
call() {
  [[ -n "$ADMIN_TOKEN" ]] || die "BBF_COACH_AGENT_TOKEN is not set — put it in .env or export it."
  local fn="$1" body="$2" out
  out=$(curl -sS -X POST "${FUNCTIONS_BASE}/${fn}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "X-BBF-Admin-Token: ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body")
  if command -v jq >/dev/null 2>&1; then printf '%s\n' "$out" | jq .; else printf '%s\n' "$out"; fi
}

case "${1:-help}" in
  authorize)
    echo "→ Requesting TikTok authorize_url …" >&2
    call bbf-tiktok-oauth '{"action":"authorize"}'
    echo "↑ Open the \"authorize_url\" value above in a browser and approve once." >&2
    ;;
  verify)  call bbf-tiktok-publish '{"action":"verify"}' ;;
  status)  call bbf-tiktok-oauth   '{"action":"status"}' ;;
  refresh) call bbf-tiktok-oauth   '{"action":"refresh"}' ;;
  help|--help|-h)
    grep -E '^#( |$)' "$0" | sed -E 's/^# ?//' || true
    ;;
  *)
    die "Unknown command: ${1} (try: authorize | verify | status | refresh | help)"
    ;;
esac
