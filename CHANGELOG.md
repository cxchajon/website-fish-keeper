# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Planned
- **Bioload math**: refine overstock detection, calibrate species multipliers, and cap edge cases.
- **Aggression rules**: expand species-specific conflicts (e.g., bettas vs. fin-nippers, territorial cichlids).
- **UI polish**: spacing/alignment for inputs; planted toggle visual pass; improve meter readability.
- **Accessibility**: keyboard navigation and input hints for number fields.
- **Docs**: add species rulebook and contributor guidelines.

### Changed
- Global navigation now loads consistently across non-home pages with a translucent bar, left-drawer menu, and safe-area aware overlay refresh.
- Slide-out navigation drawer unified across Stocking, Gear, Cycling Coach, and Media pages with consistent styling/behavior, removed the drawer from the homepage, and ensures active links remain highlighted even when the site is served from a subdirectory.

---

## [9.1.0] — 2025-09-21
**Stable Checkpoint Release**

### Added
- Planted-tank **checkbox** (simple checkmark indicator) replacing the oversized plant icon.
- Release draft + structure to support ongoing changelog and future notes.

### Changed
- **UI refinements**: raised “Recommended / Minimum” fields to better separate them from Add/Delete buttons.
- **Aggression logic groundwork** updated to better flag Betta conflicts and common fin-nippers.
- **Validation**: improved quantity input behavior (Safari-safe).

### Fixed
- Buttons and numeric inputs now reliably register across browsers.
- Base stocking flow verified after modular cleanup.

### Known Issues
- **Bioload math** is not final and may under-report overstock in certain mixes.
- **Aggression** coverage is incomplete; more species rules pending.
- Minor spacing/alignment items still queued for polish.

---

## [9.0.1] — 2025-09-18
**Stable Base reset (foundation for future work)**

### Added
- Modular JS structure retained and organized:
  - `utils.js`, `species.js`, `stock.js`, `bioload.js`, `warnings.js`, `status.js`, `app.js`
- **Status strip** enabled for development (removable for launch).

### Fixed
- Quantity handling bug resolved (Safari-safe).

---

### How we cut releases
1. Commit changes on `main` (or your default branch).
2. Tag with `git tag -a vX.Y.Z -m "Your message"` and push with `git push origin main --tags`.
3. Create a GitHub Release (via website or `gh release create vX.Y.Z --title "…" --notes-file RELEASE_NOTES.md`).
4. Update this file under the **[Unreleased]** section, then move items into the new version block.

<!--
Optional: If you want compare links, replace REPO_OWNER/REPO_NAME below and keep them updated.
[Unreleased]: https://github.com/REPO_OWNER/REPO_NAME/compare/v9.1.0...HEAD
[9.1.0]: https://github.com/REPO_OWNER/REPO_NAME/compare/v9.0.1...v9.1.0
[9.0.1]: https://github.com/REPO_OWNER/REPO_NAME/releases/tag/v9.0.1
-->
