#!/usr/bin/env bash
# Read-only production check of the ttg-confirmation-email Worker. Every request is built to be
# rejected before Resend is called (wrong origin, wrong method or type, invalid data, missing or
# bogus Turnstile token), so no email can be sent. Used by
# .github/workflows/confirmation-email-live-verify.yml (manual dispatch only).
set -uo pipefail

URL="${CONFIRM_URL:-https://ttg-confirmation-email.fishkeepinglifeco.workers.dev/confirm}"
ORIGIN='https://thetankguide.com'
EXPECTED_POLICY='abuse-limits-v1'
OUT="${OUT_DIR:-live-verify}"
mkdir -p "$OUT"
SUMMARY="$OUT/confirmation-email.md"
failures=0

# The Worker allows 5 requests per minute per IP; space the probes so they are not rate limited.
pause() { sleep 13; }

probe() { # name expected_status method origin content_type body [expected_body_fragment]
  local name="$1" expected="$2" method="$3" origin="$4" ctype="$5" body="$6" fragment="${7:-}"
  local args=(-sS -o "$OUT/body.txt" -D "$OUT/headers.txt" -w '%{http_code}' -X "$method" -A 'ttg-live-verify/1.0')
  [ -n "$origin" ] && args+=(-H "Origin: $origin")
  [ -n "$ctype" ] && args+=(-H "Content-Type: $ctype")
  [ -n "$body" ] && args+=(--data "$body")
  local status; status=$(curl "${args[@]}" "$URL")
  local text; text=$(head -c 200 "$OUT/body.txt" | tr -d '\r\n')
  local result=PASS
  if [ "$status" != "$expected" ]; then result=FAIL; fi
  if [ -n "$fragment" ] && ! grep -q "$fragment" "$OUT/body.txt"; then result=FAIL; fi
  if grep -qiE 'secret|api[_-]?key|re_[A-Za-z0-9]{8}|stack|exception' "$OUT/body.txt"; then result=FAIL; text="$text (sensitive-looking text)"; fi
  [ "$result" = FAIL ] && failures=$((failures + 1))
  echo "| $name | $expected | $status | \`$text\` | $result |" | tee -a "$SUMMARY"
}

{
  echo "# Confirmation email Worker — live checks"
  echo
  echo "Endpoint: \`$URL\` — $(date -u +%Y-%m-%dT%H:%M:%SZ) from a GitHub-hosted runner. No request can reach Resend."
  echo
  echo "| check | expected | status | body | result |"
  echo "|---|---|---|---|---|"
} > "$SUMMARY"

probe 'untrusted origin (preflight)' 403 OPTIONS 'https://attacker.example' '' ''
probe 'no origin' 403 POST '' 'application/json' '{}'
probe 'allowed origin preflight' 204 OPTIONS "$ORIGIN" '' ''
grep -qi "^access-control-allow-origin: $ORIGIN" "$OUT/headers.txt" || { failures=$((failures + 1)); echo "| preflight allow-origin header | $ORIGIN | missing | | FAIL |" | tee -a "$SUMMARY"; }
# Only the abuse-limits revision sends this marker; without it the remaining probes cannot tell the
# deployed code from the previous Worker, which answers them identically.
policy=$(tr -d '\r' < "$OUT/headers.txt" | awk 'tolower($0) ~ /^x-confirmation-policy:/ {sub(/^[^:]*:[ ]*/,""); print; exit}')
if [ "$policy" = "$EXPECTED_POLICY" ]; then
  echo "| deployed revision (X-Confirmation-Policy) | $EXPECTED_POLICY | $policy | | PASS |" | tee -a "$SUMMARY"
else
  failures=$((failures + 1))
  echo "| deployed revision (X-Confirmation-Policy) | $EXPECTED_POLICY | ${policy:-absent: previous Worker still deployed} | | FAIL |" | tee -a "$SUMMARY"
fi
probe 'wrong method' 404 GET "$ORIGIN" '' ''
pause
probe 'wrong content type' 415 POST "$ORIGIN" 'text/plain' 'x'
pause
probe 'invalid email' 400 POST "$ORIGIN" 'application/json' '{"email":"not-an-email","turnstileToken":"probe"}' 'Invalid submission'
pause
probe 'missing Turnstile token' 400 POST "$ORIGIN" 'application/json' '{"email":"probe@example.invalid"}' 'Invalid submission'
pause
# On the abuse-limits revision (checked above), this reaches the configuration check and then
# Siteverify, which rejects the bogus token. A 503 here means CONFIRM_LEDGER or CONFIRM_DEDUP_KEY
# is missing.
probe 'bogus Turnstile token (config present)' 400 POST "$ORIGIN" 'application/json' '{"email":"probe@example.invalid","name":"Probe","tankName":"Probe","turnstileToken":"ttg-live-verify-invalid-token"}' 'Security check failed'

grep -qi '^x-content-type-options: nosniff' "$OUT/headers.txt" || { failures=$((failures + 1)); echo "| nosniff header | present | missing | | FAIL |" | tee -a "$SUMMARY"; }
grep -qi '^cache-control: no-store' "$OUT/headers.txt" || { failures=$((failures + 1)); echo "| no-store header | present | missing | | FAIL |" | tee -a "$SUMMARY"; }

# Rate limiting: after a full window, six quick invalid requests should meet at least one 429.
sleep 61
limited=0
for i in 1 2 3 4 5 6 7; do
  s=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Origin: $ORIGIN" -H 'Content-Type: application/json' --data '{"email":"x"}' "$URL")
  [ "$s" = 429 ] && limited=1
done
echo | tee -a "$SUMMARY"
if [ "$limited" = 1 ]; then echo "Rate limit: a 429 was returned within 7 rapid requests." | tee -a "$SUMMARY"
else echo "Rate limit: no 429 within 7 rapid requests (the limiter is per Cloudflare location and eventually consistent; recheck before treating as a failure)." | tee -a "$SUMMARY"; fi

echo | tee -a "$SUMMARY"
echo "Failures: $failures" | tee -a "$SUMMARY"
[ "$failures" = 0 ]
