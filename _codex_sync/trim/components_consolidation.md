# Tooltip & Info Component Consolidation

- `js/ui/tooltip.js` already exposes a generalized tooltip/dialog controller used by Gear UI and Stocking advisor overlays. 【js/ui/tooltip.js†L1-L320】
- `js/params.js` ships a parallel tooltip system (`tt-trigger`, `tt--open`) with overlapping responsibilities (ARIA role management, ESC handling, dynamic positioning). Maintaining both increases payload and risk of divergent behavior. 【js/params.js†L1-L160】
- `assets/css/theme.css` and `assets/css/media.css` each define tooltip visuals separately, while Stocking page adds `.ui-tip` rules inline. 【assets/css/theme.css†L30-L120】【assets/css/media.css†L1-L120】【stocking-advisor.html†L1330-L1410】

## Proposed consolidation steps
1. Extend `js/ui/tooltip.js` to support the Cycling Coach requirements (dynamic creation from `data-tt`, persistent positioning).
2. Replace the bespoke logic in `js/params.js` with calls into the shared tooltip utility; delete redundant constants and event wiring.
3. Centralize tooltip styling in a shared partial (e.g., `assets/css/utilities.css`) imported by pages that need it.
4. Audit DOM markup to align on a single set of data attributes (`data-tooltip-*`) and remove `.tt`/`.ui-tip` legacy classes once JS is unified.

Expected impact: one tooltip library instead of three variants, easier accessibility validation, and reduced JS/CSS duplication.
