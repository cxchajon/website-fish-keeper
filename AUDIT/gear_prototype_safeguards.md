# Gear Prototype Safeguards

## Guardrail Additions
- Added `/.guard/prototype-allowlist.txt` with the permitted paths for this lock period and documented the break-glass flow in `/.guard/OVERRIDE.md`.
- Wired Husky hooks to `scripts/guard-prototype.sh`, which now calls a shared Node checker to block commits (`pre-commit`) and pushes (`pre-push`) that touch files outside the allowlist.
- Introduced `.github/workflows/prototype-guardrail.yml` so every PR runs the same allowlist check, posts a comment with offending paths, and fails fast until the diff is clean.
- Updated CODEOWNERS to allow `/prototype/gear/**` changes by the web team while requiring OWNER approval everywhere else.
- Ensured the production build strips `/prototype/**` from `dist/` outputs to keep deploy packages clean.
- Tagged the prototype surface with `window.__TTG_ENV__ = 'prototype'`, added a sandbox `console.warn`, and segmented GA4 traffic via `environment: 'prototype'`.

## Validation
- Confirmed the allowlist permits prototype edits by staging `prototype/gear/index.html` and running `node scripts/prototype-allowlist-check.mjs --mode=staged --hook test` (pass).【6a326f†L1-L3】
- Verified the guard rejects non-prototype files by staging `README.md` and rerunning the checker, which blocked the operation and reported the offending path.【caed07†L1-L11】
- Manually inspected `prototype/gear/index.html` to ensure the prototype banner and `noindex,nofollow` meta remain in place and that the sandbox warning script loads before analytics.【F:prototype/gear/index.html†L1-L120】
- Checked `scripts/build-prod.mjs` to confirm the production build removes any `dist/prototype` artifacts and logs the exclusion for auditability.【F:scripts/build-prod.mjs†L1-L62】
- Reviewed `.github/workflows/prototype-guardrail.yml` to ensure CI enforces the allowlist and posts helpful guidance when it fails.【F:.github/workflows/prototype-guardrail.yml†L1-L79】
