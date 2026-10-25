#!/usr/bin/env bash
# Read-only production check: records the security headers Cloudflare serves for key pages and the
# HTTP -> HTTPS and www -> apex redirects. Plain HEAD/GET requests only; nothing is submitted.
# Used by .github/workflows/security-headers-verify.yml (weekly and manual dispatch).
set -euo pipefail

BASE="${BASE_URL:-https://thetankguide.com}"
OUT="${OUT_DIR:-live-verify}"
mkdir -p "$OUT/headers"

PAGES=(/ /media.html /submit-your-tank.html /stocking-advisor.html /university/)
FIELDS=(strict-transport-security content-security-policy content-security-policy-report-only
  x-content-type-options x-frame-options referrer-policy permissions-policy
  cross-origin-opener-policy content-type cf-cache-status server)
REDIRECTS=(http://thetankguide.com/ http://www.thetankguide.com/ https://www.thetankguide.com/
  https://www.thetankguide.com/media.html http://thetankguide.com/media.html)

hdr() { tr -d '\r' < "$1" | awk -v k="$2" 'BEGIN{IGNORECASE=1} tolower($0) ~ "^"k":" {sub(/^[^:]*:[ ]*/,""); print; exit}'; }

{
  echo "# Security headers"
  echo
  echo "Base: \`$BASE\` — fetched $(date -u +%Y-%m-%dT%H:%M:%SZ) from a GitHub-hosted runner."
  echo
  echo "## Redirects"
  echo
  echo "| request | status | location |"
  echo "|---|---|---|"
} > "$OUT/security-headers.md"

for u in "${REDIRECTS[@]}"; do
  f="$OUT/headers/redirect-$(echo "$u" | tr -c 'a-zA-Z0-9' '_').txt"
  curl -sS -o /dev/null -A "ttg-live-verify/1.0" -D "$f" "$u" || true
  echo "| \`$u\` | $(head -1 "$f" | tr -d '\r') | $(hdr "$f" location) |" >> "$OUT/security-headers.md"
done

for p in "${PAGES[@]}"; do
  name="$(echo "$p" | tr -c 'a-zA-Z0-9' '_')"
  f="$OUT/headers/page$name.txt"
  curl -sS -o /dev/null --compressed -A "ttg-live-verify/1.0" -D "$f" "$BASE$p"
  {
    echo
    echo "## \`$p\` — $(head -1 "$f" | tr -d '\r')"
    echo
    echo "| header | value |"
    echo "|---|---|"
    for h in "${FIELDS[@]}"; do
      v="$(hdr "$f" "$h")"
      echo "| $h | ${v:-**MISSING**} |"
    done
  } >> "$OUT/security-headers.md"
done

cat "$OUT/security-headers.md"
