#!/usr/bin/env bash
set -euo pipefail
TITLE="$(git log -1 --pretty=%s || true)"
BODY="$(git log -1 --pretty=%b || true)"
if echo "$TITLE $BODY" | grep -Eqi "prototype-only|proto"; then
  CHANGED=$(git diff --cached --name-only)
  ALLOWED_REGEX='^(prototype-home\.html|experiments/.*|deploy-audits/.*|\.github/.*)$'
  BAD=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [[ "$f" =~ $ALLOWED_REGEX ]] || BAD=1
  done <<< "$CHANGED"
  if [ $BAD -ne 0 ]; then
    echo "✖ Prototype-only commit includes disallowed file changes."
    echo "$CHANGED"
    exit 1
  fi
fi
echo "✓ Guard OK"
