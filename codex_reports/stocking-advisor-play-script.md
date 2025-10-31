# Stocking Advisor Migration Play Script (Regenerated 2025-10-31)

This runbook captures the exact sequence to stage and validate the Stocking Advisor prototype before promoting it to live.

## 1. Local Prep
1. `npm install` (if dependencies changed).
2. `npm run build-prototype` to rebuild `/prototype` assets.
3. `npm run build-prod` to refresh live bundles (ensures shared CSS/JS in sync).
4. Verify the timestamped backup under `backups/live-stocking/20251031T182721Z` exists before modifying live files.

## 2. Sync Prototype → Working Copy
1. Copy `prototype/stocking-prototype.html` into a scratch area (`proto_port/stocking.html`) for diffing.
2. Use `node scripts/copy-proto-assets.mjs stocking` to mirror CSS/JS assets when ready to port.
3. Run `npm run lint:css` (if available) after merging prototype styles into `/css`.

## 3. Targeted QA Commands
1. `npm run test:stocking` (covers compute + warning logic).
2. `npm run test:playwright -- stocking` (desktop + mobile smoke flows).
3. `node scripts/run_infoicon_audit.py --page stocking` to confirm tooltip bindings.

## 4. Manual Validation (pre-deploy)
1. Open `http://localhost:4173/stocking.html` in Chrome + Safari responsive mode.
2. Confirm Estimated Turnover popover toggles exactly once per click; test ESC + outside click.
3. Step through FAQ keyboard navigation (Tab, Space/Enter) ensuring focus order matches the prototype script.
4. Inspect `<head>` for single canonical + meta set; validate JSON-LD via Google Rich Results.
5. Capture required hero/popup/FAQ screenshots for staging evidence.

## 5. Staging Promotion
1. Push branch `work` → staging remote (`origin work`).
2. Notify #fish-qa with link to staging Netlify deploy preview.
3. Attach migration report + evidence in the QA ticket before requesting approval.

> Keep this file up-to-date after every major prototype iteration.
