#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/prototype-allowlist-check.mjs"

mode="${1:-pre-commit}"

if [[ "$mode" == "pre-commit" ]]; then
  node "$CHECK_SCRIPT" --mode=staged --hook pre-commit
  exit 0
fi

if [[ "$mode" == "pre-push" ]]; then
  remote="${2:-origin}"
  # Read refs from stdin (format: local_ref local_sha remote_ref remote_sha)
  mapfile -t pushed_refs
  if [[ "${#pushed_refs[@]}" -eq 0 ]]; then
    exit 0
  fi

  commits=()
  for ref_line in "${pushed_refs[@]}"; do
    # shellcheck disable=SC2086
    read -r local_ref local_sha remote_ref remote_sha <<<"$ref_line"
    if [[ -z "${local_sha:-}" ]]; then
      continue
    fi
    if [[ -z "${remote_sha:-}" || "$remote_sha" == "0000000000000000000000000000000000000000" ]]; then
      mapfile -t new_commits < <(git rev-list "$local_sha" --not --remotes="$remote" || true)
    else
      mapfile -t new_commits < <(git rev-list "${remote_sha}..${local_sha}" || true)
    fi
    commits+=("${new_commits[@]}")
  done

  if [[ "${#commits[@]}" -eq 0 ]]; then
    exit 0
  fi

  mapfile -t unique_commits < <(printf '%s\n' "${commits[@]}" | awk '!seen[$0]++' || true)
  if [[ "${#unique_commits[@]}" -eq 0 ]]; then
    exit 0
  fi

  args=()
  for commit in "${unique_commits[@]}"; do
    [[ -z "$commit" ]] && continue
    args+=(--commit "$commit")
  done

  if [[ "${#args[@]}" -eq 0 ]]; then
    exit 0
  fi

  node "$CHECK_SCRIPT" --mode=commits --hook pre-push "${args[@]}"
  exit 0
fi

# Fallback for manual executions (defaults to staged comparison)
node "$CHECK_SCRIPT" --mode=staged --hook "$mode"
