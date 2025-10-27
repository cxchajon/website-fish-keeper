# Prototype Changelog

## 2025-02-14
- Introduced a popover portal layer so inline info dialogs render above surrounding cards and maintain accessibility. Touched `prototype/stocking-prototype.html`, `prototype/assets/css/popover-portal.css`, `prototype/assets/js/popover-portal.js`, and `prototype/js/stocking-prototype.js`.

## 2025-02-21
- Corrected prototype bioload math so filtration efficiency now reduces load instead of inflating it. Normalized the computation order, added regression tests for GPH monotonicity and planted reductions, and recorded TAP output under `prototype/audit_out/test_output.txt`.
