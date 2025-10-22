# Prototype Gradient Audit Summary

- **Page:** `/prototype-home.html`
- **Stylesheets (DOM order):**
  1. `css/style.css?v=1.1.9`
  2. `css/overrides-prototype.css?v=1.0.1`
- **Overrides CSS last?** Yes — `css/overrides-prototype.css` now loads after all other stylesheet links.
- **Inline `<style>` blocks:** 2 (head `:root` variables + body CTA adjustments).
- **Key findings:**
  - White and near-white background paints remain in base CSS (`background: rgba(255,255,255,…)`), so panels still render as light cards.
  - `.card`, `.tool-card`, `.panel`, `.feature-card`, `.box`, `.tile` all require forced transparency and shadow overrides.
  - Residual pseudo-elements targeting `.tool-card::before`/`::after` may repaint over the gradient if re-enabled.
  - Box-shadows use bright inset components, reinforcing the “white card” perception.
  - Gradient originates from `body.page-background`, but `background-attachment: fixed` clashes with iOS Safari and causes seams.
  - No service worker or CSP block detected; CSS URLs already carry cache-busting params.
  - HEAD requests are blocked by Envoy (403), so cache headers could not be confirmed.

## Root Cause Hypotheses (ranked)
1. Panel components (card/panel/tool-card) still paint white via background, ::before overlay, or box-shadow halo.
2. Overrides file not loaded last OR overridden by more specific selectors.
3. Inline styles (style="background:#fff") beating external CSS due to specificity.
4. CSP blocks inline `<style>`, so prior inline fixes had no effect.
5. CDN or Service Worker caching old CSS.

## Verification Commands
- `curl -sSD - "https://thetankguide.com/prototype-home.html?nocache=1&t=$(date +%s)"`

## Element-Level Checklist for DevTools
- `.card`, `.panel`, `.tool-card`: check computed styles for background, box-shadow, ::before/::after
- Look for white-to-transparent gradients on ::before (::after) creating the “split”
- Check any canvas/SVG/image layers used as backgrounds

## iOS-Specific Notes
- Prefer `-webkit-backdrop-filter` and avoid `background-attachment: fixed` on short iOS versions; fall back gracefully.
