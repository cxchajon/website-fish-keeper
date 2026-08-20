# PERFORMANCE OPTIMIZATION AUDIT RESULTS

**Site:** thetankguide.com
**Date:** 2025-11-23
**Version:** v1.5
**Auditor:** Claude Code Performance Analysis

---

## QUICK STATS

| Metric | Value |
|--------|-------|
| Total HTML files | 36 |
| Total CSS size | 829 KB |
| Total JS size (first-party) | 914 KB |
| Total images | 60 (121.6 MB) |
| Third-party scripts | 5 vendors |
| Pages with ads | 12 |
| Files missing version params | 26 |

---

## SAFE TO IMPLEMENT IMMEDIATELY (P0)

These changes are low-risk and can be deployed without extensive testing.

### 1. Add Version Parameters to 26 Unversioned Assets

**Impact:** Proper cache invalidation, prevents stale content
**Risk:** None
**Estimated Savings:** Better cache efficiency

**Critical files needing `?v=2025-11-23`:**

**CSS Files:**
- `/css/app.bundle.css` (259 KB) - CRITICAL
- `/css/blogs.css` (26 KB)
- `/assets/css/media.css` (20.6 KB)
- `./css/gear.v2.css` (27.9 KB)

**JavaScript Files:**
- `/assets/js/consent-mode.js`
- `/assets/js/ttg-cmp-consent-bridge.js`
- `/js/home-modal.js`
- `/js/ad-slot-view-tracking.js`
- `/js/stocking-advisor/info-popover-legacy.js`
- `/js/stocking-advisor/info-tooltip.js`
- `/js/stocking-advisor/init.js`
- `/js/logic/compute.js`
- `/js/logic/conflicts.js`
- `/js/stocking-advisor/filtration/controller.js`
- `/js/stocking-advisor/info-popovers.js`
- `/js/stocking-advisor/ui-meters.js`
- `/js/ui/tooltip.js`
- `/assets/js/gear.v2.js` (101 KB)
- `/assets/js/gear.v2.data.js` (67 KB)

---

### 2. Add `loading="lazy"` to 39 Below-Fold Images

**Impact:** Faster initial page load, reduced bandwidth
**Risk:** None
**Files to update:**

- `blogs/blackbeard/index.html` (lines 206, 236) - IMG_9610.png, IMG_9605.jpeg
- `media.html` (line 357) - storefront.webp
- Various blog images in `/blogs/shared/img/`

---

### 3. Add Width/Height to 36 Images Missing Dimensions

**Impact:** Prevent Cumulative Layout Shift (CLS)
**Risk:** None
**Files affected:**

- `media.html` (line 266)
- `blogs/blackbeard/index.html` (lines 206, 236)
- Most images in blog directories

---

### 4. Remove Debug console.log() Statements

**Impact:** Cleaner production code, slight size reduction
**Risk:** None
**Estimated Savings:** 5-10 KB

**Files with debug logging:**

| File | Lines | Content |
|------|-------|---------|
| `/js/stocking.js` | 836, 841-843, 902 | Filter dropdown debug logs |
| `/js/stocking.js` | 829, 897 | console.groupCollapsed debug blocks |
| `/js/utils.js` | Various | Legacy tank warnings |
| `/js/fish-data.js` | Various | Marine entries/schema warnings |

**Keep:** `console.error()` calls for legitimate error handling

---

### 5. Add Preconnect for Frequently-Used Domains

**Impact:** Faster third-party resource loading
**Risk:** None

**Add to pages with affiliate/video links:**
```html
<link rel="preconnect" href="https://amzn.to">
<link rel="preconnect" href="https://www.youtube.com">
<link rel="preconnect" href="https://www.amazon.com">
```

**Pages to update:** gear/index.html, about.html, media.html, blogs with Amazon links

---

### 6. Add `font-display: swap` to All Google Fonts

**Impact:** Prevent Flash of Invisible Text (FOIT)
**Risk:** None

**File needing update:**
- `/pages/university.html` (line 44) - Missing `&display=swap` parameter

---

### 7. Add Debouncing to Scroll/Resize Event Handlers

**Impact:** Smoother scrolling, prevent layout thrashing
**Risk:** Low (may need testing)

**Files to update:**
- `/js/stocking-advisor/info-popover-legacy.js` (lines 207-208)
- `/js/stocking-advisor/info-popovers.js` (lines 337-338)

**Implementation:** Add 16ms debounce or use `requestAnimationFrame`

---

### 8. Add `{ passive: true }` to All Scroll Listeners

**Impact:** Better scroll performance
**Risk:** None (unless handler calls preventDefault)

**Files to update:**
- `/js/ui/tooltip.js` (some listeners already have it, standardize all)

---

## REVIEW BEFORE IMPLEMENTING (P1)

These changes require testing before deployment.

### 1. Minify All CSS Files

**Impact:** ~280 KB savings (33% reduction)
**Risk:** Medium - test all pages after minification

**Current vs Target:**

| File | Current | Minified | Savings |
|------|---------|----------|---------|
| app.bundle.css | 259 KB | ~182 KB | 77 KB |
| main.bundle.css | 155 KB | ~109 KB | 46 KB |
| stocking-advisor.css | 92 KB | ~65 KB | 27 KB |
| style.css | 80 KB | ~56 KB | 24 KB |
| **Total** | **829 KB** | **~550 KB** | **~280 KB** |

**Tools:** cssnano, PostCSS, or Cloudflare Auto Minify

---

### 2. Minify All JavaScript Files

**Impact:** ~180-220 KB savings (20% reduction)
**Risk:** Medium - test all interactive features

**Largest candidates:**

| File | Current | Estimated Minified | Savings |
|------|---------|-------------------|---------|
| stocking.js | 81 KB | ~57 KB | 24 KB |
| gear.v2.js | 100 KB | ~70 KB | 30 KB |
| gear.v2.data.js | 66 KB | ~46 KB | 20 KB |
| compute.legacy.js | 54 KB | ~38 KB | 16 KB |
| envRecommend.js | 41 KB | ~29 KB | 12 KB |

**Tools:** terser, esbuild, or webpack

---

### 3. Compress 27 Oversized Images (>500KB)

**Impact:** 65-75% image size reduction
**Risk:** Visual quality check needed

**Top 10 priority images:**

| File | Current | Target | Savings |
|------|---------|--------|---------|
| blogs/blackbeard/img/IMG_9612.png | 12 MB | 3-4 MB (as JPG) | 8-9 MB |
| blogs/blackbeard/img/IMG_9610.png | 9.4 MB | 2-3 MB (as JPG) | 6-7 MB |
| blogs/shared/img/Water change.PNG | 9.3 MB | 2-3 MB | 6-7 MB |
| blogs/shared/img/Nitrite to nitrate.png | 8.2 MB | 2-3 MB | 5-6 MB |
| blogs/blackbeard/img/IMG_9611.png | 7.7 MB | 2-3 MB (as JPG) | 5-6 MB |
| blogs/shared/img/Nitrate.png | 7.4 MB | 2-3 MB | 4-5 MB |
| blogs/shared/img/nitrogen-cycle-diagram.PNG | 6.2 MB | 1-2 MB | 4-5 MB |
| blogs/blackbeard/img/IMG_9605.jpeg | 5.5 MB | 1-2 MB | 3-4 MB |
| assets/media/community/IMG_9505.png | 5.2 MB | 1-2 MB (as JPG) | 3-4 MB |
| blogs/blackbeard/img/IMG_9604.jpeg | 4.9 MB | 1-2 MB | 3-4 MB |

**Total potential savings:** 50-70 MB

---

### 4. Convert PNG Photos to JPG

**Impact:** 30-50% file size reduction for photos
**Risk:** Need to update HTML references

**Files to convert:**
- `IMG_9612.png` → `IMG_9612.jpg`
- `IMG_9610.png` → `IMG_9610.jpg`
- `IMG_9611.png` → `IMG_9611.jpg`
- `IMG_9505.png` → `IMG_9505.jpg`

---

### 5. Remove Duplicate CSS Files

**Impact:** Cleaner codebase, smaller deployment
**Risk:** Low - verify which version is canonical

**Duplicates found:**
- `/css/utilities.css` (1.9 KB) vs `/assets/css/utilities.css` (1.9 KB)
- Multiple gear.css versions across directories

---

### 6. Consolidate CSS Bundles

**Impact:** Reduce HTTP requests, clearer architecture
**Risk:** Medium - requires careful testing

**Current issue:** Both `app.bundle.css` (259 KB) and `main.bundle.css` (155 KB) exist with overlapping content

**Recommendation:** Consolidate to single bundle or clearly document which pages use which

---

### 7. Remove Outdated Vendor Prefixes

**Impact:** 5-10 KB CSS reduction
**Risk:** Low for 2024+ browsers

**Prefixes to remove:**
- `-webkit-box-sizing` (use unprefixed)
- `-webkit-overflow-scrolling: touch` (deprecated)
- Most `-moz-` prefixes

**Files affected:** style.css, gear.v2.css, app.bundle.css

---

## HIGH IMPACT BUT NEEDS CAREFUL PLANNING (P2)

### 1. Implement Service Worker for PWA

**Impact:** Offline support, faster repeat visits
**Risk:** Complex implementation, thorough testing needed

**Current status:**
- manifest.webmanifest exists
- No service worker implemented
- Manifest only referenced in stocking-advisor.html

**Implementation steps:**
1. Create basic sw.js with caching strategy
2. Cache key pages (index.html, stocking-advisor.html)
3. Add manifest reference to all main pages
4. Test offline functionality

---

### 2. Convert Images to WebP Format

**Impact:** 25-35% additional size reduction
**Risk:** Need fallbacks for older browsers

**Current WebP usage:** Only 4 images (0.6% of total)

**Strategy:**
```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="...">
</picture>
```

---

### 3. Implement Critical CSS Inlining

**Impact:** 50-100ms FCP improvement
**Risk:** Maintenance overhead, extraction complexity

**Candidates:**
- index.html (homepage - most important)
- stocking-advisor.html (app page)

---

### 4. Bundle JavaScript Modules

**Impact:** Reduce HTTP requests, improve load waterfall
**Risk:** Medium - requires build pipeline changes

**Candidates for bundling:**
- All `/js/stocking-advisor/*` files → single bundle
- All `/js/logic/*` files → single bundle
- All `/js/ui/*` files → single bundle

---

### 5. Code-Split Large Files

**Impact:** Faster initial load for specific pages
**Risk:** Architecture changes needed

**Files to split:**
- `gear.v2.js` (100 KB) - split by section
- `app.bundle.css` (259 KB) - split by page

---

### 6. Implement Responsive Images with srcset

**Impact:** 20-40% bandwidth savings on mobile
**Risk:** Need to generate multiple image sizes

**Current srcset usage:** 0 images (0%)

---

## CORE WEB VITALS IMPACT ESTIMATE

### Current Estimated Scores

| Metric | Estimate | Target | Status |
|--------|----------|--------|--------|
| LCP | ~3.5-4.5s | <2.5s | Needs Work |
| CLS | ~0.15-0.25 | <0.1 | Needs Work |
| FID/INP | ~150-250ms | <100ms | Needs Work |
| FCP | ~2.0-3.0s | <1.8s | Needs Work |

### After Implementing P0 Fixes

| Metric | Improvement | New Estimate |
|--------|-------------|--------------|
| LCP | -0.5-1.0s | ~2.5-3.5s |
| CLS | -0.10-0.15 | ~0.05-0.10 |
| FID/INP | -50-100ms | ~100-150ms |
| FCP | -0.3-0.5s | ~1.5-2.5s |

### After Implementing P1 Fixes

| Metric | Improvement | New Estimate |
|--------|-------------|--------------|
| LCP | -1.0-1.5s | ~1.5-2.5s |
| CLS | <0.05 | ~0.02-0.05 |
| FID/INP | <100ms | ~50-100ms |
| FCP | <1.8s | ~1.2-1.8s |

---

## FILE SIZE ANALYSIS

### Page Weight Breakdown

#### Index.html (Homepage)
| Resource | Size |
|----------|------|
| HTML | 21.9 KB |
| CSS | ~155 KB |
| JS | ~50 KB |
| Images | ~100 KB |
| Third-party | ~150 KB |
| **Total** | **~480 KB** |

#### Stocking Advisor
| Resource | Size |
|----------|------|
| HTML | 54.3 KB |
| CSS | ~260 KB |
| JS | ~350 KB |
| Images | 0 |
| Third-party | ~150 KB |
| **Total** | **~815 KB** |

### Budget Recommendations

| Resource | Current | Budget | Status |
|----------|---------|--------|--------|
| HTML | <55 KB | <50 KB | OK |
| CSS | 829 KB | <100 KB | Over Budget |
| JS (first-party) | 914 KB | <200 KB | Over Budget |
| Images (above fold) | Varies | <500 KB | Check per page |
| Total page | ~1.5 MB | <1.5 MB | At Limit |

### Top 20 Largest Files

| Rank | File | Size | Optimizable |
|------|------|------|-------------|
| 1 | IMG_9612.png | 12 MB | Yes - convert to JPG |
| 2 | top-down-betta-floating-plants-community.jpg | 12.4 MB | Yes - compress |
| 3 | IMG_9610.png | 9.4 MB | Yes - convert to JPG |
| 4 | Water change.PNG | 9.3 MB | Yes - compress |
| 5 | Nitrite to nitrate.png | 8.2 MB | Yes - compress |
| 6 | IMG_9611.png | 7.7 MB | Yes - convert to JPG |
| 7 | Nitrate.png | 7.4 MB | Yes - compress |
| 8 | nitrogen-cycle-diagram.PNG | 6.2 MB | Yes - compress |
| 9 | IMG_9605.jpeg | 5.5 MB | Yes - compress |
| 10 | IMG_9505.png | 5.2 MB | Yes - convert to JPG |
| 11 | app.bundle.css | 259 KB | Yes - minify |
| 12 | main.bundle.css | 155 KB | Yes - minify |
| 13 | gear.v2.js | 100 KB | Yes - minify |
| 14 | stocking-advisor.css | 92 KB | Yes - minify |
| 15 | stocking.js | 81 KB | Yes - minify |
| 16 | style.css | 80 KB | Yes - minify |
| 17 | gear.v2.data.js | 67 KB | Yes - minify |
| 18 | compute.legacy.js | 55 KB | Yes - minify/deprecate |
| 19 | journal-dashboard.js | 41 KB | Yes - minify |
| 20 | envRecommend.js | 41 KB | Yes - minify |

---

## THIRD-PARTY SCRIPT ANALYSIS

### Current Third-Party Inventory

| Service | Domain | Loading | Status |
|---------|--------|---------|--------|
| GTM | googletagmanager.com | async | OK |
| GA4 | googletagmanager.com | async | OK |
| AdSense | pagead2.googlesyndication.com | async | OK |
| Funding Choices | fundingchoicesmessages.google.com | async | OK |
| Cloudflare | static.cloudflareinsights.com | defer | OK |

### Optimization Opportunities

1. **All scripts use async/defer** - Good!
2. **Preconnects in place** for fonts and key services
3. **Missing preconnects** for affiliate domains (amzn.to, youtube.com)
4. **Consent mode** properly configured with defaults

---

## IMPLEMENTATION ROADMAP

### Week 1: Quick Wins (P0)
- [ ] Add version parameters to 26 unversioned assets
- [ ] Add `loading="lazy"` to 39 images
- [ ] Add width/height to 36 images
- [ ] Remove debug console.log statements
- [ ] Add missing preconnects
- [ ] Add font-display: swap to university.html
- [ ] Test on staging environment

**Estimated effort:** 4-6 hours
**Expected improvement:** 15-20% faster initial load

### Week 2: Optimization (P1)
- [ ] Minify all CSS files (280 KB savings)
- [ ] Minify all JS files (180 KB savings)
- [ ] Compress top 10 oversized images
- [ ] Convert PNG photos to JPG
- [ ] Test thoroughly

**Estimated effort:** 8-12 hours
**Expected improvement:** 40-50% faster page load

### Week 3+: Advanced (P2)
- [ ] Implement service worker
- [ ] Convert images to WebP
- [ ] Implement critical CSS
- [ ] Bundle JS modules
- [ ] Add responsive images

**Estimated effort:** 20-40 hours
**Expected improvement:** 60-70% faster, PWA capable

---

## SUMMARY

### Total Potential Savings

| Category | Current | After Optimization | Savings |
|----------|---------|-------------------|---------|
| Images | 121.6 MB | ~40-50 MB | 70-80 MB |
| CSS | 829 KB | ~400 KB | ~430 KB |
| JavaScript | 914 KB | ~520 KB | ~400 KB |
| **Total Assets** | **123 MB** | **~41 MB** | **~82 MB (67%)** |

### Priority Actions

1. **Immediate (Today):** Add version parameters to prevent cache issues
2. **This Week:** Add lazy loading and image dimensions for CLS fix
3. **Next Week:** Minify CSS/JS for major bandwidth savings
4. **Ongoing:** Compress and convert images as time permits

### Expected Outcomes

- **Page Load Time:** 40-60% faster
- **Core Web Vitals:** All metrics in "Good" range
- **Bandwidth:** 60-70% reduction
- **User Experience:** Smoother scrolling, no layout shifts
- **SEO Impact:** Improved rankings from better performance

---

## APPENDIX: FILE LOCATIONS

### Key Configuration Files
- Caching headers: `/_headers`
- Redirects: `/_redirects`
- PWA manifest: `/manifest.webmanifest`

### Directories Scanned
- `/css/` - 642 KB total
- `/assets/css/` - 123 KB total
- `/js/` - 534 KB total
- `/assets/js/` - 250 KB total
- `/assets/img/` - Various images
- `/blogs/*/img/` - Blog images

### Pages Analyzed
- index.html (homepage)
- stocking-advisor.html (main app)
- gear/index.html (gear guide)
- blogs/index.html (blog listing)
- journal-dashboard.html (journal app)
- And 31 additional HTML files

---

*Report generated by Claude Code Performance Audit*
*For questions or clarifications, see the detailed findings in each section above.*
