#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${REPO_ROOT}/ad-audits"
OUTPUT_FILE="${OUTPUT_DIR}/ads-txt-check.json"
EXPECTED_BODY='google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0'

mkdir -p "${OUTPUT_DIR}"

declare -a PROBES
PROBES+=("https://thetankguide.com/ads.txt")
PROBES+=("http://thetankguide.com/ads.txt")

WWW_HOST="www.thetankguide.com"
if command -v getent >/dev/null 2>&1 && getent ahosts "${WWW_HOST}" >/dev/null 2>&1; then
  PROBES+=("https://${WWW_HOST}/ads.txt")
else
  echo "[ads.txt-check] Skipping https://${WWW_HOST}/ads.txt probe (host not detected via getent)." >&2
fi

TMP_RESULTS="$(mktemp)"
trap 'rm -f "${TMP_RESULTS}"' EXIT

for url in "${PROBES[@]}"; do
  echo "[ads.txt-check] Probing ${url}" >&2
  header_file="$(mktemp)"
  body_file="$(mktemp)"

  set +e
  curl -sS -D "${header_file}" -o "${body_file}" --compressed --max-time 10 -L --proto-redir =https --proto-redir =http "${url}"
  curl_exit=$?
  set -e

  python - <<'PY' "${header_file}" "${body_file}" "${url}" "${curl_exit}" "${EXPECTED_BODY}" >> "${TMP_RESULTS}"
import json
import sys
from pathlib import Path

header_path = Path(sys.argv[1])
body_path = Path(sys.argv[2])
url = sys.argv[3]
curl_exit = int(sys.argv[4])
expected_body = sys.argv[5]

result = {
    "url": url,
    "curl_exit_code": curl_exit,
}

if not header_path.exists() or header_path.stat().st_size == 0:
    error_message = f"curl exited with code {curl_exit}" if curl_exit != 0 else "No headers captured"
    result.update({
        "final_status": None,
        "status_chain": [],
        "headers": {},
        "cf_headers": {},
        "body_preview": "",
        "body_length": 0,
        "trimmed_body_matches_expected": False,
        "pass": False,
        "error": error_message,
    })
else:
    raw_headers = header_path.read_bytes().decode("iso-8859-1")
    blocks = [b for b in raw_headers.split("\r\n\r\n") if b.strip()]
    status_chain = []
    final_headers = {}
    for block in blocks:
        lines = [line for line in block.splitlines() if line.strip()]
        if not lines or not lines[0].startswith("HTTP/"):
            continue
        parts = lines[0].split()
        if len(parts) >= 2:
            try:
                status_chain.append(int(parts[1]))
            except ValueError:
                status_chain.append(parts[1])
        block_headers = {}
        for line in lines[1:]:
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            block_headers[name.strip().lower()] = value.strip()
        if block_headers:
            final_headers = block_headers

    if status_chain:
        last_status = status_chain[-1]
        final_status = int(last_status) if isinstance(last_status, str) else last_status
    else:
        final_status = None

    body_bytes = body_path.read_bytes()
    body_preview = body_bytes[:200].decode("utf-8", "replace")
    body_text = body_bytes.decode("utf-8", "replace")
    trimmed_body = body_text.rstrip("\r\n")

    cf_headers = {k: v for k, v in final_headers.items() if k.startswith("cf-")}

    content_type = final_headers.get("content-type", "")
    x_content_type = final_headers.get("x-content-type-options")
    cache_control = final_headers.get("cache-control")

    passed = (
        curl_exit == 0
        and final_status == 200
        and content_type.lower().startswith("text/plain")
        and trimmed_body == expected_body
    )

    result.update({
        "final_status": final_status,
        "status_chain": status_chain,
        "headers": {
            "content-type": content_type,
            "x-content-type-options": x_content_type,
            "cache-control": cache_control,
        },
        "cf_headers": cf_headers,
        "body_preview": body_preview,
        "body_length": len(body_bytes),
        "trimmed_body_matches_expected": trimmed_body == expected_body,
        "pass": passed,
    })

print(json.dumps(result))
PY

  rm -f "${header_file}" "${body_file}"
done

python - <<'PY' "${TMP_RESULTS}" "${OUTPUT_FILE}"
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

results_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])

with results_path.open() as fh:
    probes = [json.loads(line) for line in fh if line.strip()]

overall_pass = all(p.get("pass") for p in probes)
summary = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "pass": overall_pass,
    "probes": probes,
}

output_path.write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
if not summary["pass"]:
    raise SystemExit(1)
PY
