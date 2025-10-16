#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CF_API_TOKEN:-}" || -z "${CF_ZONE_ID:-}" ]]; then
  echo "CF_API_TOKEN and CF_ZONE_ID environment variables must be set." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULE_PAYLOAD_FILE="${SCRIPT_DIR}/cloudflare-ads-txt-bypass.json"
API_BASE="https://api.cloudflare.com/client/v4"
ENTRYPOINT_ENDPOINT="${API_BASE}/zones/${CF_ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint"

if [[ ! -f "${RULE_PAYLOAD_FILE}" ]]; then
  echo "Missing rule payload file at ${RULE_PAYLOAD_FILE}" >&2
  exit 1
fi

echo "[cloudflare] Fetching existing firewall custom ruleset entrypoint..." >&2
ENTRYPOINT_RESPONSE="$(curl -sS -X GET "${ENTRYPOINT_ENDPOINT}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json")"

if [[ -z "${ENTRYPOINT_RESPONSE}" ]]; then
  echo "Failed to fetch ruleset entrypoint." >&2
  exit 1
fi

TMP_ENTRYPOINT="$(mktemp)"
TMP_UPDATE_PAYLOAD="$(mktemp)"
trap 'rm -f "${TMP_ENTRYPOINT}" "${TMP_UPDATE_PAYLOAD}"' EXIT

printf '%s' "${ENTRYPOINT_RESPONSE}" > "${TMP_ENTRYPOINT}"

python <<'PY' "${TMP_ENTRYPOINT}" "${RULE_PAYLOAD_FILE}" "${TMP_UPDATE_PAYLOAD}"
import json
import sys
from pathlib import Path

entrypoint_path = Path(sys.argv[1])
rule_payload_path = Path(sys.argv[2])
output_path = Path(sys.argv[3])

entrypoint = json.loads(entrypoint_path.read_text())
rule_payload = json.loads(rule_payload_path.read_text())

rules = entrypoint.get("result", {}).get("rules", [])
expression = rule_payload.get("expression")
if not expression:
    raise SystemExit("Rule payload missing expression")

existing_rule = None
for rule in rules:
    if rule.get("expression") == expression:
        existing_rule = rule
        break

if existing_rule:
    existing_rule.update({
        "action": rule_payload.get("action"),
        "action_parameters": rule_payload.get("action_parameters", {}),
        "description": rule_payload.get("description", existing_rule.get("description")),
        "enabled": True,
    })
else:
    rules.append({
        "action": rule_payload.get("action"),
        "action_parameters": rule_payload.get("action_parameters", {}),
        "expression": expression,
        "description": rule_payload.get("description"),
        "enabled": True,
    })

payload = {"rules": rules}
output_path.write_text(json.dumps(payload))
PY

echo "[cloudflare] Updating firewall custom ruleset entrypoint..." >&2
UPDATE_RESPONSE="$(curl -sS -X PUT "${ENTRYPOINT_ENDPOINT}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "@${TMP_UPDATE_PAYLOAD}")"

echo "${UPDATE_RESPONSE}" | python - <<'PY'
import json
import sys

data = json.load(sys.stdin)
if not data.get("success"):
    print(json.dumps(data, indent=2))
    raise SystemExit("Cloudflare API update failed")
print(json.dumps({"message": "Ruleset updated", "result_id": data.get("result", {}).get("id")}, indent=2))
PY

echo "[cloudflare] Purging ads.txt from Cloudflare cache..." >&2
PURGE_PAYLOAD='{"files": ["https://thetankguide.com/ads.txt"]}'
PURGE_RESPONSE="$(curl -sS -X POST "${API_BASE}/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "${PURGE_PAYLOAD}")"

echo "${PURGE_RESPONSE}" | python - <<'PY'
import json
import sys

data = json.load(sys.stdin)
if not data.get("success"):
    print(json.dumps(data, indent=2))
    raise SystemExit("Cloudflare cache purge failed")
print(json.dumps({"message": "Cache purge requested"}, indent=2))
PY

echo "[cloudflare] Done." >&2
