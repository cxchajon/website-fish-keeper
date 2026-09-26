#!/usr/bin/env bash
# Read-only production check for the Stocking Advisor: records the live response headers of the page,
# its calculator modules and the species dataset, and saves each body for the content checks.
# Used by .github/workflows/stocking-advisor-live-verify.yml (manual dispatch only).
set -euo pipefail

BASE="${BASE_URL:-https://thetankguide.com}"
OUT="${OUT_DIR:-live-verify}"
mkdir -p "$OUT/headers" "$OUT/body"

PATHS=(
  /stocking-advisor.html
  /js/stocking-advisor/init.js
  /js/stocking-advisor/logic/species-adapter.v2.js
  /js/stocking-advisor/logic/bioload-model.js
  /data/stocking-advisor/species.v2.json
  /js/stocking.js
  /js/logic/compute.legacy.js
)
FIELDS=(cache-control age cf-cache-status server etag last-modified content-type expires vary
  cf-ray x-github-request-id x-served-by x-cache via)

hdr() { tr -d '\r' < "$1" | awk -v k="$2" 'BEGIN{IGNORECASE=1} tolower($0) ~ "^"k":" {sub(/^[^:]*:[ ]*/,""); print; exit}'; }

{
  echo "# Stocking Advisor live headers"
  echo
  echo "Base: \`$BASE\` — fetched $(date -u +%Y-%m-%dT%H:%M:%SZ) from a GitHub-hosted runner."
  echo "Each URL is requested twice with a plain GET (the real URL, no cache-busting query), so the"
  echo "second request shows whether Cloudflare's edge serves it from cache."
  echo
} > "$OUT/summary.md"

for p in "${PATHS[@]}"; do
  name="$(basename "$p")"
  for n in 1 2; do
    status=$(curl -sS -L --compressed -A "ttg-live-verify/1.0" -D "$OUT/headers/$name.$n.txt" \
      -o "$OUT/body/$name" -w '%{http_code}' "$BASE$p")
  done
  {
    echo "## \`$p\`"
    echo
    echo "| field | request 1 | request 2 |"
    echo "|---|---|---|"
    echo "| status | $(head -1 "$OUT/headers/$name.1.txt" | tr -d '\r') | $status |"
    for f in "${FIELDS[@]}"; do
      echo "| $f | $(hdr "$OUT/headers/$name.1.txt" "$f") | $(hdr "$OUT/headers/$name.2.txt" "$f") |"
    done
    echo
  } >> "$OUT/summary.md"
done

cat "$OUT/summary.md"
