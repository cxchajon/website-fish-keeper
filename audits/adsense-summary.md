# AdSense Site-Wide Audit Summary

**Audit Date:** 2025-11-11
**Repository:** website-fish-keeper
**Publisher ID:** ca-pub-9905718149811880

---

## Executive Summary

This comprehensive audit scanned **37 HTML files** across the repository to inventory every AdSense unit, detect duplicates and placeholders, and calculate how many new slot IDs are required.

### Key Findings

| Metric | Count |
|--------|-------|
| **Total AdSense Units Found** | 9 |
| **Active Units** | 7 |
| **Commented Out Units** | 2 |
| **Unique Slot IDs in Use** | 1 |
| **Placeholder Clients** | 1 |
| **Placeholder Slots** | 1 |
| **Duplicate Slot IDs** | 1 (used 6 times) |
| **🎯 NEW SLOT IDs NEEDED** | **6** |

---

## Critical Issues

### 🔴 Issue #1: Massive Slot ID Duplication

**Slot ID `9522042154` is reused across 6 different pages!**

This violates AdSense best practices. Each ad unit should have a unique slot ID for proper tracking, reporting, and optimization.

**Affected Pages:**
1. `feature-your-tank.html` (line 518)
2. `about.html` (line 361)
3. `media.html` (line 1169)
4. `media-prototype.html` (line 633)
5. `media-prototype.html` (line 892)
6. `media-prototype.html` (line 995)

### 🔴 Issue #2: Placeholder Ad Unit on Live Page

**Location:** `media-prototype.html` (line 849)
**Client:** `ca-pub-PLACEHOLDER`
**Slot:** `PLACEHOLDER`
**Status:** Active (not commented out)

This unit will not serve ads and may cause console errors.

### ⚠️ Issue #3: noindex Pages with Ad Units

The following pages have `noindex,nofollow` in their robots meta tag but contain ad units:

- `media-prototype.html` (4 units total)

**Note:** This is acceptable for prototype/testing pages, but these units won't generate impressions from organic search traffic.

### ℹ️ Issue #4: Commented Out Units with Placeholder Values

**Location:** `cycling-coach/index.html` (lines 1077 and 1130)
**Client:** `YOUR-ADSENSE-CLIENT-ID`
**Slot:** `TBD_SLOT_ID`

These are correctly commented out and ready to be activated once proper slot IDs are assigned.

---

## Inventory by Page

### Active Ad Units

| Page | Line | Heading/Section | Client | Slot | Format | Commented? | Notes |
|------|------|----------------|---------|------|--------|------------|-------|
| `feature-your-tank.html` | 518-523 | (no context) | ca-pub-9905718149811880 | **9522042154** | auto | ❌ No | ⚠️ DUPLICATE |
| `about.html` | 361-366 | (no context) | ca-pub-9905718149811880 | **9522042154** | auto | ❌ No | ⚠️ DUPLICATE |
| `media.html` | 1169-1174 | seo-intro | ca-pub-9905718149811880 | **9522042154** | auto | ❌ No | ⚠️ DUPLICATE |
| `media-prototype.html` | 633-638 | hero | ca-pub-9905718149811880 | **9522042154** | auto | ❌ No | ⚠️ DUPLICATE + noindex page |
| `media-prototype.html` | 849-854 | (no context) | **ca-pub-PLACEHOLDER** | **PLACEHOLDER** | auto | ❌ No | 🔴 PLACEHOLDER + noindex page |
| `media-prototype.html` | 892-897 | (no context) | ca-pub-9905718149811880 | **9522042154** | auto | ❌ No | ⚠️ DUPLICATE + noindex page |
| `media-prototype.html` | 995-1000 | seo-intro | ca-pub-9905718149811880 | **9522042154** | auto | ❌ No | ⚠️ DUPLICATE + noindex page |

### Commented Out Units

| Page | Line | Heading/Section | Client | Slot | Format | Commented? | Notes |
|------|------|----------------|---------|------|--------|------------|-------|
| `cycling-coach/index.html` | 1077-1082 | (no context) | YOUR-ADSENSE-CLIENT-ID | TBD_SLOT_ID | auto | ✅ Yes | Ready for activation |
| `cycling-coach/index.html` | 1130-1135 | new-tank-syndrome | YOUR-ADSENSE-CLIENT-ID | TBD_SLOT_ID | auto | ✅ Yes | Ready for activation |

---

## Recommended Actions

### Phase 1: Create New Ad Slots (High Priority)

You need to create **6 new unique slot IDs** in your AdSense account to replace the duplicates.

**Suggested naming convention:**
- `TTG_FeatureYourTank` → replace on feature-your-tank.html:518
- `TTG_About` → replace on about.html:361
- `TTG_MediaHub` → replace on media.html:1169
- `TTG_MediaProtoTop` → replace on media-prototype.html:633
- `TTG_MediaProtoMid` → replace on media-prototype.html:892
- `TTG_MediaProtoBottom` → replace on media-prototype.html:995

### Phase 2: Fix Placeholder Unit (High Priority)

**File:** `media-prototype.html` (line 849)

**Action:** Replace placeholder values with real AdSense credentials:
```html
<!-- BEFORE -->
data-ad-client="ca-pub-PLACEHOLDER"
data-ad-slot="PLACEHOLDER"

<!-- AFTER -->
data-ad-client="ca-pub-9905718149811880"
data-ad-slot="[NEW_UNIQUE_SLOT_ID]"
```

Suggested name: `TTG_MediaProtoPlaceholder`

### Phase 3: Activate Commented Units (Medium Priority)

**File:** `cycling-coach/index.html` (lines 1077, 1130)

Once you've created slot IDs for these units:
1. Create 2 new ad units in AdSense (suggested names: `TTG_CyclingCoachMid`, `TTG_CyclingCoachBottom`)
2. Replace placeholder values in the HTML
3. Uncomment the `<ins>` blocks

---

## Per-Page Action Checklist

### feature-your-tank.html
- [ ] Create new ad unit `TTG_FeatureYourTank` in AdSense
- [ ] Replace slot ID on line 518
- [ ] Test page and verify ad displays

### about.html
- [ ] Create new ad unit `TTG_About` in AdSense
- [ ] Replace slot ID on line 361
- [ ] Test page and verify ad displays

### media.html
- [ ] Create new ad unit `TTG_MediaHub` in AdSense
- [ ] Replace slot ID on line 1169
- [ ] Test page and verify ad displays

### media-prototype.html (noindex page)
- [ ] Create 4 new ad units in AdSense:
  - `TTG_MediaProtoTop`
  - `TTG_MediaProtoPlaceholder`
  - `TTG_MediaProtoMid`
  - `TTG_MediaProtoBottom`
- [ ] Replace all 4 slot IDs (lines 633, 849, 892, 995)
- [ ] Fix placeholder client on line 849
- [ ] Test page and verify all ads display

### cycling-coach/index.html
- [ ] Create 2 new ad units in AdSense:
  - `TTG_CyclingCoachMid`
  - `TTG_CyclingCoachBottom`
- [ ] Replace placeholder client IDs on lines 1077 and 1130
- [ ] Replace placeholder slot IDs on lines 1077 and 1130
- [ ] Uncomment both ad units
- [ ] Test page and verify ads display

---

## Duplicate Slot ID Detail

### Slot `9522042154` (Used 6 Times)

| File | Line | Context | Wrapper |
|------|------|---------|---------|
| feature-your-tank.html | 518-523 | (no context) | .ttg-adunit |
| about.html | 361-366 | (no context) | .ttg-adunit |
| media.html | 1169-1174 | seo-intro | .ttg-adunit |
| media-prototype.html | 633-638 | hero | .ttg-adunit |
| media-prototype.html | 892-897 | (no context) | .ttg-adunit |
| media-prototype.html | 995-1000 | seo-intro | .ttg-adunit |

**Impact:** AdSense cannot distinguish between these placements for reporting and optimization purposes. All impressions, clicks, and revenue from these 6 locations are aggregated under a single slot ID.

---

## Placeholder Summary

### Placeholder Clients
- **Count:** 1
- **Location:** media-prototype.html:849
- **Value:** `ca-pub-PLACEHOLDER`

### Placeholder Slots
- **Count:** 1 (active) + 2 (commented out)
- **Active:** media-prototype.html:849 → `PLACEHOLDER`
- **Commented:**
  - cycling-coach/index.html:1077 → `TBD_SLOT_ID`
  - cycling-coach/index.html:1130 → `TBD_SLOT_ID`

---

## Additional Diagnostics

### Pages with `noindex, nofollow`

The following pages are excluded from search engine indexing:

1. `prototype-home.html` (no ad units)
2. `nav.html` (no ad units)
3. **`media-prototype.html`** ⚠️ (4 ad units present)
4. `docs/audits/prototype-home_HEAD.html` (no ad units)
5. `docs/audits/prototype-home_GEMINI_head.html` (no ad units)

**Recommendation:** This is acceptable for prototype and testing pages. However, ensure these pages are not publicly linked if they contain placeholder ad units.

### Mixed Publisher IDs

**Good news:** All active units (except the placeholder) use the same publisher ID: **ca-pub-9905718149811880**

This is correct and ensures all revenue flows to a single AdSense account.

---

## Calculation: New Slot IDs Needed

**Formula:**
`New Slots Needed = Active Units - Unique Slots + Placeholder Slots`

**Breakdown:**
- **Active Units:** 7
- **Unique Non-Placeholder Slots:** 1 (slot `9522042154`)
- **Active Placeholder Slots:** 1 (media-prototype.html:849)

**Result:**
`7 - 1 = 6` new unique slot IDs required

This ensures every active ad unit has its own unique, non-placeholder slot ID for proper tracking and optimization.

---

## Next Steps

1. **Create 6 new ad units** in your Google AdSense account using the suggested naming convention
2. **Update slot IDs** in the 6 files listed in the action checklist
3. **Fix the placeholder unit** on media-prototype.html:849
4. **(Optional)** Activate the 2 commented units on cycling-coach/index.html after creating their slot IDs
5. **Test all pages** to ensure ads display correctly
6. **Monitor AdSense dashboard** to verify each slot ID is reporting independently

---

## Audit Methodology

This audit used a Python-based scanner that:
- Searched all `.html` files for `<ins class="adsbygoogle">` tags
- Extracted `data-ad-client`, `data-ad-slot`, `data-ad-format`, and `data-full-width-responsive` attributes
- Detected commented-out units by checking for surrounding `<!-- -->` tags
- Identified nearby headings and wrapper classes for context
- Analyzed robots meta tags for noindex pages
- Calculated unique slot IDs and detected duplicates
- Generated structured JSON inventory and this human-readable summary

**Audit completed successfully with no file modifications.**

---

*End of AdSense Site-Wide Audit Summary*
