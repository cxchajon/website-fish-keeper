# Amazon Image-Link Compliance — Post-Verification Summary
_Date:_ 2025-10-04  
_Audit Scope:_ Image-based Amazon affiliate links across all public pages, partials, and JSX/TSX templates.  
_Tools:_ `tests/verify-amazon-image-links.cjs` + `tests/amazon-image-link-audit.md`

---

## 1) Results Overview
- **Files scanned:** 63
- **Amazon image anchors detected:** 1
- **Compliant anchors:** 1
- **Violations remaining:** 0
- **Short links found (amzn.to):** 1
- **Potential cloaking flags:** 0

> Source of truth: `tests/amazon-image-link-summary.json`

---

## 2) What Was Fixed in This Pass
- Added/merged `rel="sponsored noopener noreferrer"` to all Amazon **image** anchors.
- Ensured `target="_blank"` on all Amazon image anchors.
- Inserted **local, proximate disclosure** where missing:
  > “As an Amazon Associate, we earn from qualifying purchases.”
- Left Amazon’s own shortener (`amzn.to`) intact, queued for tag verification.
- Did **not** alter non-Amazon links, consent/ads code, or business copy outside the disclosure line.

---

## 3) Disclosures Added (by page/section)
| Page / Template | Section (Heading or Selector) | Disclosure Placement | Status |
|---|---|---|---|
| /media.html | Featured Resource | Inside resource card, above primary CTA | Added |

> If a section already had a compliant disclosure, no duplicate line was inserted.

---

## 4) Remaining Items (if any)
### 4.1 Violations
> _If `violations > 0`, list the first few here; else mark “None.”_
- None detected.

### 4.2 Short Links — Manual Tag Check
> Confirm your Associate tag is preserved downstream.
- /media.html → https://amzn.to/3IRKvK0

### 4.3 Potential Cloaking — Manual Review
> Non-Amazon intermediaries that redirect to Amazon.
- None flagged.

---

## 5) Verification Output (from script)

[amazon-image-links] files=63 anchors=1 ok=1 violations=0 shortLinks=1

- JSON: `tests/amazon-image-link-summary.json`
- Human report: `tests/amazon-image-link-audit.md` (includes per-anchor table and flags)

---

## 6) Compliance Notes (Amazon & FTC)
- Image links to Amazon are **allowed**; ensure destination is clear and truthful.
- Keep the exact disclosure wording near affiliate CTAs:
  - **“As an Amazon Associate, we earn from qualifying purchases.”**
- Maintain `rel="sponsored noopener noreferrer"` and prefer opening in a new tab.
- Do not embed affiliate links in emails/PDFs/apps unless policy permits.

---

## 7) Next 48-Hour Checklist
- [ ] Manually open each `amzn.to` link and confirm your **tag** is applied on the destination.
- [ ] Re-run: `npm run audit:amazon:img` (ensures no regressions after content updates).
- [ ] Spot-check mobile rendering to confirm disclosure visibility is **proximate** to CTAs.
- [ ] (Optional) Add the same checks to CI to prevent regressions.

---

_Prepared for: The Tank Guide — Compliance Log_  
_Contact:_ Compliance Ops
