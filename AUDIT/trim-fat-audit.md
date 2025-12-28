# Trim-the-Fat Audit (2025-12-28)

## Repo stats
- File counts (by extension): .js 1676, .ts 716, .mjs 577, .cjs 515, .json 382, .md 379, .map 333, (no ext) 249, .mts 176, .html 53, .css 37, .csv 32, .yml 32, .txt 28, images (.png/.jpg/.jpeg/.svg/.webp) 81 total.
- Notable generated/vendor weight: `workers/node_modules` contains 90MB+ binaries (workerd, esbuild) and libvips; `.git/objects/pack` holds ~172MB packfile.

## Largest items
Top 20 by size:
1. `.git/objects/pack/pack-00a4c77d58b8d156449bce06faae163d36cbe8d4.pack` — 172.14 MB
2. `workers/node_modules/workerd/bin/workerd` — 97.36 MB
3. `workers/node_modules/@cloudflare/workerd-linux-64/bin/workerd` — 97.36 MB
4. `workers/node_modules/.bin/workerd` — 97.36 MB
5. `workers/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.42` — 15.48 MB
6. `blogs/blackbeard/img/IMG_9612.png` — 11.95 MB
7. `assets/blogs/betta-community-tank/originals/top-down-betta-floating-plants-community.jpg` — 11.83 MB
8. `blogs/blackbeard/img/IMG_9610.png` — 9.32 MB
9. `blogs/shared/img/Water change.PNG` — 9.25 MB
10. `workers/node_modules/esbuild/bin/esbuild` — 8.68 MB
11. `workers/node_modules/@esbuild/linux-x64/bin/esbuild` — 8.68 MB
12. `workers/node_modules/.bin/esbuild` — 8.68 MB
13. `blogs/shared/img/Nitrite to nitrate.png` — 8.15 MB
14. `blogs/blackbeard/img/IMG_9611.png` — 7.66 MB
15. `blogs/shared/img/Nitrate.png` — 7.36 MB
16. `assets/images/Best-Holiday-Aquarium-Gift.png` — 6.77 MB
17. `assets/img/ads/Planted-daily-tank-journal-ad.PNG` — 6.22 MB
18. `blogs/shared/img/nitrogen-cycle-diagram.PNG` — 6.11 MB
19. `assets/images/low-bioload-fish-and-invertebrates-reference-grid.PNG` — 5.86 MB
20. `workers/node_modules/wrangler/wrangler-dist/cli.js` — 5.52 MB

## High-confidence unused (SAFE TO DELETE NOW)
- Zero-byte placeholder images duplicated across blogs (now removed). No references found; MD5 duplicates.

## Medium-confidence unused (VERIFY FIRST)
- Unreferenced brand/utility art: `assets/doodles/*.svg`, `assets/icons/youtube-replay.svg`, `assets/icons/youtube-rewind.svg`.
- Manifest/logo mismatch: actual files `assets/img/logos/web-app-manifest-192x192.png` and `assets/img/logos/web-app-manifest-512x512.png` are referenced but filenames contain the “×” character (times symbol) rather than `x` and were not detected in text searches. Verify whether production uses differently named assets or if manifest links are broken.
- Large blog diagram assets with no filename matches in the repo body text: `blogs/shared/img/Water change.PNG` and `blogs/shared/img/Nitrite to nitrate.png` (also appear in “Largest items”)—validate if loaded via CMS or external embed before removal.
- PWA icon drift: `assets/img/Logo-Master-512×512.PNG` not referenced anywhere; confirm if superseded by `/assets/img/logos/logo-1200x630.png` or apple-touch icons before removal.
- CSS/JS likely stale or duplicated based on filename-only search gaps (needs link map validation): `css/journal-dashboard.overrides.css`, `css/stocking-advisor.css`, `css/ui.css`, `css/site.css`, `css/main.bundle.css`, `dist/css/site.min.css`, `dist/css/style.min.css`, `assets/css/ads.css`, `assets/css/dashboard.css`, `assets/css/journal-dashboard.css`, `experiments/proto-home.css`, `src/styles/gear.css`, `tools/dashboard/src/styles.css`, plus long list of JS utilities under `js/logic/*` and `assets/js/*` not referenced by HTML. Cross-check against dynamic imports/build pipelines before any deletion.
- Prototype/staging artifacts: `store-prototype.html`, `dist/prototype/`, and `proto_edits/` (manual experiments) appear disconnected from main nav; confirm hosting/redirect dependencies first.
- Gear redirect stubs: references in audits to `/gear.html` and `/stocking.html` persist, but `_redirects` currently lacks those entries and files are absent. Verify CDN/edge rules or add redirects before removing related docs.

## Dead/duplicate pages & prototypes
- No `gear.html` or `stocking.html` file present despite historical mentions; `_redirects` only covers `/gear/index.html` and prototype/stocking-prototype. Audit prior references (nav.js mapping, ad audits) to ensure no inbound requests break.
- Prototype directories: `proto_edits/`, `dist/prototype/`, and `store-prototype.html` appear isolated from sitemap/nav; treat as experimental.
- Duplicate images (same hash): Playwright logo assets in `node_modules/playwright-core/...` (vendor) and zero-byte blog placeholders listed above.

## CSS/JS linkage map
- Common includes across root/pages: `/css/app.bundle.css?v=2025-11-07`, `/css/style.css?v=1.0.10`, `/js/nav.js?v=1.1.0`, `/js/footer-loader.js?v=1.5.2`, consent scripts under `/assets/js/consent-mode.js` or CMP bridge. Blog pages add `/css/blog-theme.css` and `/css/blogs.css`.
- Specialized pages: `/gear/index.html` references `/gear/css/gear.v2.css` plus shared `/css/style.css` (per prior audits); `/stocking-advisor.html` historically uses `/css/stocking-advisor.css` and `/js/stocking.js` (verify current bundles).
- Distribution copies exist (`dist/css/site.min.css`, `dist/css/style.min.css`) without direct HTML references—likely build artifacts.

## Asset reference map (images/fonts/icons)
- Referenced icons (manifest/meta): `/assets/img/logos/favicon-16.png`, `/assets/img/logos/favicon-32.png`, `/assets/img/Logo-Master-180x180.PNG`, `/assets/img/Logo-Master-512x512.PNG`, `/assets/img/logos/logo-1200x630.png`.
- Potentially orphaned art: `assets/doodles/*.svg`, `assets/icons/youtube-*.svg`, `assets/img/logos/web-app-manifest-*.png` (naming mismatch), `assets/img/Logo-Master-512×512.PNG`.
- Blog media heavyweights: several 8–12 MB PNG/JPGs in `blogs/blackbeard/img/` and `blogs/shared/img/` remain; validate CDN optimization before removal.

## Redirects + sitemap/robots sanity checks
- `_redirects` includes `/gear/index.html -> /gear/`, prototype gear and stocking redirects, and miscellaneous legal/params rewrites. Missing explicit redirects for `/gear.html` and `/stocking.html` despite being noted in historical audits and nav mapping.
- `sitemap.xml` lists `/stocking-advisor.html` and `/gear/`; no legacy `/gear.html` or `/stocking.html` entries.
- `robots.txt` allows all crawlers except admin/includes; sitemap reference present.

## DO NOT TOUCH (core system)
- Shared layout/includes: `nav.html`, `footer.html`, consent/ads loaders under `assets/js/consent-mode.js`, CMP bridge, `js/nav.js`, `js/footer-loader.js`.
- Global styling bundles: `/css/app.bundle.css`, `/css/style.css`, `/css/blog-theme.css`, `/css/blogs.css`, `/assets/css/theme.css`, `/assets/css/utilities.css`.
- Analytics/ads: GTM embed, AdSense loader references, Cloudflare beacon scripts.
- Sitemap/robots: `sitemap.xml`, `robots.txt`, `_redirects`, `_headers`.

## Proposed deletion plan (Phase 1 / Phase 2)
- **Phase 1: Safe Now** — Remove zero-byte duplicate placeholders. Estimated impact: none (not referenced, 0-byte). Rollback: restore from Git if any template expects file presence.
- **Phase 2: Verify First** — Confirm usage before removal or rename: doodle/icon SVGs, manifest logo files with “×” naming, oversized blog diagrams, prototype directories (`proto_edits/`, `dist/prototype/`, `store-prototype.html`), unreferenced CSS/JS bundles (`dist/css/*.css`, `css/*bundle*.css`, `assets/js/*`, `js/logic/*`). Impact: potential missing icons/styles or broken prototype links. Verification: search CDN logs or analytics for direct hits; run local build to see if bundler imports; check manifest/assets in Lighthouse/PWA; ensure redirects for `/gear.html` `/stocking.html` exist before removing related references.

## Verification checklist (before/after)
- Before deletion: crawl site locally to capture 200/301 map; export Cloudflare/Netlify redirect tables; run `rg`/Lighthouse to confirm manifest icons resolve; check nav/footer for references to prototype assets.
- After Phase 1: run link checker and image requests to confirm no 404s; re-run sitemap validation; spot-check blog pages previously hosting placeholders.
- Before Phase 2 deletions: verify unreferenced CSS/JS not bundled by build tool (`package.json` scripts), check network panel for doodle/icon requests, confirm no runtime `fetch`/dynamic import uses filenames.

## Rollback plan
- Keep branch/tag before cleanup; revert specific files via `git checkout -- <path>` if any regression appears.
- Restore redirects by reapplying `_redirects` and re-deploying if `/gear.html` or `/stocking.html` traffic fails post-change.
