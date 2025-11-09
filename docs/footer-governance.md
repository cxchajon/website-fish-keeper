# Footer governance

The Tank Guide footer is now centrally managed to guarantee a single source of truth across the site. This document explains what is locked, how to request changes, and the QA required for any approved updates.

## Canonical assets

The following files make up the footer surface and are protected by the hash lock:

- `/footer.html`
- `/assets/sprite.socials.svg`
- `/js/footer-loader.js`
- `/css/site.css`

Only `/footer.html` may contain markup for the global footer. All pages load it dynamically via `<div id="site-footer" data-footer-src="/footer.html?v=1.5.2"></div>` and the canonical loader script at `/js/footer-loader.js?v=1.5.2`.

## Guard rails

- `.footer.lock.json` stores SHA256 hashes for the canonical footer assets.
- Pre-commit and pre-push hooks (installed via `npm install`/`npm run prepare`) re-run `node scripts/footer-lock/verify.mjs`. The hook fails with:
  > Footer is LOCKED. Do not modify without explicit approval. To proceed, set APPROVED_FOOTER_CHANGE=1.
- `APPROVED_FOOTER_CHANGE=1` bypasses the hook and CI checks. Only set it after explicit approval.
- GitHub Actions workflow **footer-lock** enforces the same verification plus `node scripts/footer-lock/lint.mjs`. On pull requests, add the `footer-approved` label to allow intentional footer updates; without the label, the job fails.
- Repository lint: `npm run footer:lint` (also executed in the pre-commit hook) ensures every HTML page contains exactly one footer placeholder, uses `/js/footer-loader.js?v=1.5.2`, sets `data-footer-src` correctly, and blocks new class names containing `social`.

## Requesting changes

1. Secure explicit approval (written sign-off) for the update.
2. Export `APPROVED_FOOTER_CHANGE=1` locally to bypass hooks.
3. Modify the canonical files and re-run `npm run footer:lock:update` to refresh `.footer.lock.json`.
4. Open a PR and add the `footer-approved` label so CI passes.
5. Remove the environment variable after the work is complete.

## QA checklist for approved footer updates

- [ ] Validate `/footer.html` structure:
  - Social icon strip contains six anchors in the order Instagram → TikTok → Facebook → X → YouTube → Amazon with correct `href`, `target="_blank"`, `rel="noopener noreferrer"`, and accessible `aria-label`s.
  - Legal nav order: Privacy & Legal → Terms of Use → Trust & Security → Cookie Settings → Do Not Sell or Share My Personal Information → Contact & Feedback → Store → Copyright & DMCA.
  - Amazon CTA text remains “Shop our books on Amazon »”.
  - Powered by line links: FishKeepingLifeCo → Google business share URL, The Tank Guide → Google search result.
  - No `<meta name="robots">` or inline `<style>` blocks.
- [ ] Confirm `/assets/sprite.socials.svg` icons use `fill`/`stroke="currentColor"` and expose ids: `ig`, `tk`, `fb`, `x`, `yt`, `am`.
- [ ] Ensure `/js/footer-loader.js` continues to replace the placeholder via `outerHTML` and fetches `/footer.html?v=1.5.2` (or the approved version).
- [ ] Verify `/css/site.css` contains the canonical footer styles (48×48 tap targets, base color `#fff`, hover/focus color ~`#1e90ff`).
- [ ] Run `npm run footer:lint`.
- [ ] Spot check key pages locally (homepage, legal pages, store, blog entries) to ensure the loader requests `/footer.html?v=1.5.2` with a 200 response and the rendered footer matches the canonical markup.

Keep this document updated whenever the process or asset list changes.
