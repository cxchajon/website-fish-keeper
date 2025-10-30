# PR Summary

## What changed
- Introduced the v2 prototype species dataset with merged aggression, bioload, and parameter models.
- Added adapter, compatibility scoring, and dynamic aggression utilities so the prototype consumes the new data while keeping filtration patches intact.
- Updated the prototype compute proxy and UI glue to surface v2 metadata in chips, including compatibility tiers, predation risks, and aggression tokens.
- Added prototype-only tests and filtration regression guard plus removed leftover diagnostic UI elements.

## Screenshots
> Screenshots for the requested scenarios (desktop & mobile: Cardinal @ pH 7.0, Tiger Barb 12 vs 5, Female Betta solo vs sorority, Male Betta ×2, Bioload meter progression) could not be captured in this environment. Please trigger the scenarios locally after serving `prototype/stocking-prototype.html` to verify the new badges and chips render as described.

## Validation
- `node proto/guards/no_live_touch.js` (no output; confirms only proto/prototype paths are staged).
- `git diff --name-only 994eb2af1ecf32a62fb1d779d6894015bc4f4fb0..HEAD | grep -v '^proto' | grep -v '^prototype'` (no paths reported).
- `node --test proto/tests/*.test.js` (see `proto/out/summary.txt` & `proto/out/junit.xml`).
