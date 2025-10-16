#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CF_API_TOKEN:-}" || -z "${CF_ZONE_ID:-}" ]]; then
  cat <<'MSG'
CF_API_TOKEN and CF_ZONE_ID are not set. To purge /ads.txt from Cloudflare manually, run:

  curl -X POST "https://api.cloudflare.com/client/v4/zones/<YOUR_ZONE_ID>/purge_cache" \
    -H "Authorization: Bearer <YOUR_API_TOKEN>" \
    -H "Content-Type: application/json" \
    --data '{"files": ["https://thetankguide.com/ads.txt"]}'

Replace <YOUR_ZONE_ID> and <YOUR_API_TOKEN> with valid credentials.
MSG
  exit 0
fi

API_BASE="https://api.cloudflare.com/client/v4"
PURGE_PAYLOAD='{"files": ["https://thetankguide.com/ads.txt"]}'

echo "[purge] Requesting Cloudflare cache purge for /ads.txt..." >&2
RESPONSE="$(curl -sS -X POST "${API_BASE}/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "${PURGE_PAYLOAD}")"

echo "${RESPONSE}" | python - <<'PY'
import json
import sys

data = json.load(sys.stdin)
if not data.get("success"):
    print(json.dumps(data, indent=2))
    raise SystemExit("Cloudflare cache purge failed")
print(json.dumps({"message": "Cache purge requested"}, indent=2))
PY
