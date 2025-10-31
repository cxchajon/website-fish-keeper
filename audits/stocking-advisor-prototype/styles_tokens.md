# Styles & Design Tokens

## CSS Includes
- `/css/style.css?v=2024-06-05a` (≈59.2 KB)
- `/assets/css/utilities.css?v=2025-11-07` (≈1.9 KB)
- `/css/site.css?v=1.4.9` (≈8.5 KB)
- `/css/ui.css?v=2024-09-15` (≈10.2 KB)
- `/prototype/css/stocking-prototype.css` (≈22.9 KB)
- `/prototype/assets/css/proto-popovers.css?v=proto_rm_2025_10_25` (≈5.0 KB)
- `/prototype/assets/css/filtration.css?v=proto_rm_2025_10_25` (≈0.05 KB)
- `/prototype/assets/css/prototype.css?v=proto_rm_2025_10_25` (≈1.4 KB)
- `/prototype/css/proto-fixes.css` (≈2.2 KB)
- Inline `<style>` blocks in the document head tailor prototype variables, card spacing, and popover visuals.

## Color Tokens (inline `:root` overrides)
- `--fg: #eef3ff` — primary foreground text.
- `--muted: rgba(235, 239, 251, 0.86)` — muted copy.
- `--panel: rgba(255, 255, 255, 0.08)` — card background glassmorphism.
- `--border: rgba(255, 255, 255, 0.14)` — panel borders.
- `--chip: rgba(255, 255, 255, 0.12)` — pill backgrounds.
- Status colors: `--ok: #12c278`, `--warn: #f4b400`, `--bad: #ff645c`.
- Meters/background: `--bar-bg: rgba(255,255,255,0.12)`, `--ghost: rgba(255,255,255,0.25)`, `--shadow: rgba(18,30,56,0.18)`.
- Popover backgrounds: `--popover-bg: rgba(6, 12, 24, 0.96)`.
- Links default to `#a3c8ff`.

## Background & Themes
- Body background combines two radial gradients (blue/teal glows) with a dark linear gradient (`rgba(10,16,32,0.94)` to `rgba(4,8,18,0.98)`), establishing a dark-mode aesthetic.
- `.prototype-stock-page` uses `position: relative; isolation: isolate;` to stack overlays cleanly.

## Radii & Spacing
- Cards: `border-radius: 18px` with `padding: 20px 20px 22px`.
- Popovers (`.proto-info-tooltip`): `border-radius: 10px`, `padding: 12px 14px`.
- Heads-up notes: `border-radius: 12px`.
- Buttons and selects share `border-radius: 12px` (tank select) or `10px` (popovers), with `outline-offset` adjustments for focus states.

## Shadows & Blur
- Cards: `box-shadow: 0 18px 36px -24px var(--shadow)` with `backdrop-filter: blur(8px)` for frosted glass effect.
- Popovers: `box-shadow: 0 18px 36px rgba(4, 10, 30, 0.4)` and 1px translucent border.
- Info buttons adopt glow focus outlines `rgba(20,203,168,0.7)` when active; environmental info toggles swap to teal backgrounds when expanded.

## Controls & Typography
- Cards use uppercase labels with `letter-spacing: 0.08em`.
- Hero heading uses `font-size: clamp(2.4rem, 3vw, 2.9rem)` with `font-weight: 800`.
- Control wrappers align with flex utilities from prototype CSS (e.g., `.control-field`, `.proto-input-group`).

## Z-Layers & Overlays
- `.proto-info-tooltip` set to `z-index: 1100` for inline hints.
- Modal backdrop `.modal-backdrop` uses `z-index: 9999`, with `backdrop-filter: blur(2px)`.
- Prototype popover overlay class `proto-info-overlay` toggled with `is-active` to lock scroll (body gets `.proto-popover-overlay-open`).
- Tooltips/overlays rely on `position: fixed` with clamp-based placement to stay above cards.

## Dark-Mode Behavior
- Entire prototype leverages dark palette; no alternate light theme present.
- Focus rings and toggled states rely on high-contrast teals and whites to meet accessibility in the dark surface.

## Card & Meter Styling Notes
- `.tank-size-card` inline styles tighten form-row spacing and animate chevron rotation when the select opens.
- `.proto-turnover` input group renders as a compact inline meter with readonly numeric value and suffix `×/h`.
- Environmental bars hide (`display: none`) until info mode adds `info-open` class, reducing clutter.

## Responsive Tweaks
- Media queries adjust hero padding for widths ≥1024px and reduce `font-size` for `.hero .lead` on smaller viewports.
- Tooltip transitions respect `prefers-reduced-motion` by removing transitions when set.
