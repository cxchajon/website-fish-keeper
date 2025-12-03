# CSP Security Audit Report

**Generated:** 2025-11-23
**Site:** thetankguide.com
**Audit Type:** Content Security Policy Vulnerability Assessment

---

## Executive Summary

This audit identifies critical CSP vulnerabilities and provides a comprehensive migration plan to achieve a secure, nonce-based CSP without breaking existing functionality.

---

## Current State Analysis

### Inline Code Inventory

| Type | Count | Files Affected |
|------|-------|----------------|
| **GTM Initialization Script** | 32 | All main HTML pages |
| **Google CMP Bootstrap Script** | 31 | All main HTML pages |
| **TTG CMP Consent Bridge Script** | 31 | All main HTML pages |
| **JSON-LD Structured Data** | 32 | All main HTML pages |
| **Inline `<style>` Tags** | 22 | Page-specific styles |
| **Event Handlers (onload/onerror)** | 15 | Font loading, image fallbacks |
| **External Scripts** | 186 | Across 34 files |

### External Script Sources Used

- `https://www.googletagmanager.com` - GTM
- `https://www.google-analytics.com` - GA4
- `https://pagead2.googlesyndication.com` - AdSense
- `https://fundingchoicesmessages.google.com` - Google CMP
- `https://static.cloudflareinsights.com` - Cloudflare Analytics
- `https://widget.cloudinary.com` - Cloudinary Upload Widget
- `https://www.gstatic.com` - Google Static Resources
- `https://fonts.googleapis.com` - Google Fonts

---

## Critical Vulnerabilities Identified

### CRITICAL: 'unsafe-inline' in script-src

**Risk Level:** HIGH
**Impact:** Allows execution of any inline JavaScript, enabling XSS attacks

**Current Usage:**
```
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com ...
```

**Exploitable Via:**
- DOM-based XSS injecting `<script>` tags
- Reflected XSS with inline script payloads
- Stored XSS in user-generated content

### CRITICAL: 'unsafe-inline' in style-src

**Risk Level:** MEDIUM
**Impact:** Allows CSS injection which can lead to data exfiltration

**Current Usage:**
```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

**Exploitable Via:**
- CSS-based data exfiltration attacks
- UI redressing attacks

### HIGH: Known JSONP Bypass Endpoints

**Risk Level:** HIGH
**Impact:** Allowed domains contain JSONP endpoints that can bypass CSP

**Vulnerable Domains:**
- `www.googletagmanager.com` - JSONP endpoints available
- `www.google-analytics.com` - JSONP endpoints available
- `pagead2.googlesyndication.com` - JSONP endpoints available
- `googleads.g.doubleclick.net` - JSONP endpoints available

**Note:** While these domains are required for legitimate functionality, their presence combined with 'unsafe-inline' creates a significant attack surface.

---

## Inline Scripts Requiring Migration

### 1. GTM Initialization Script (32 files)

**Location:** `<head>` section of all main pages
**Current Code:**
```html
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KTRVCMQN');</script>
```

**Risk:** P1 - High (breaks analytics if misconfigured)
**Solution:** Externalize to `/js/gtm-init.js` or add nonce

### 2. Google CMP Bootstrap Script (31 files)

**Location:** `<head>` section
**Current Code:**
```html
<script>
  (function() {
    function signalGooglefcPresent() {
      if (!window.frames['googlefcPresent']) {
        if (document.body) {
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'display:none';
          iframe.name = 'googlefcPresent';
          document.body.appendChild(iframe);
        } else {
          setTimeout(signalGooglefcPresent, 0);
        }
      }
    }
    signalGooglefcPresent();
  })();
</script>
```

**Risk:** P1 - High (breaks consent management)
**Solution:** Externalize to `/js/google-cmp-bootstrap.js` or add nonce

### 3. TTG CMP Consent Bridge Script (31 files)

**Location:** Before `</body>`
**Approximate Size:** ~50 lines
**Risk:** P1 - High (breaks consent sync)
**Solution:** Externalize to `/js/ttg-cmp-consent-bridge.js` or add nonce

### 4. GA4 Consent Initialization (includes/ga4.html)

**Location:** Included via SSI
**Current Code:** Multiple inline scripts for dataLayer, consent defaults, gtag config
**Risk:** P1 - High (breaks analytics)
**Solution:** Externalize to `/js/ga4-init.js` or add nonce

### 5. JSON-LD Structured Data (32 files)

**Location:** `<head>` section
**Note:** JSON-LD with `type="application/ld+json"` does NOT require 'unsafe-inline'
**Risk:** None - these are safe as-is
**Solution:** No action needed

---

## Inline Styles Requiring Migration

### Files with Inline `<style>` Tags

1. `about.html` - Page-specific layout styles (~150 lines)
2. `assistant.html` - Assistant interface styles
3. `blogs/betta-fish-in-a-community-tank.html` - Blog post styles
4. `blogs/blackbeard/index.html` - Blog post styles
5. `blogs/nitrogen-cycle/index.html` - Blog post styles (2 blocks)
6. `blogs/purigen/index.html` - Blog post styles
7. `contact-feedback.html` - Form styles
8. `cookie-settings.html` - Cookie settings UI styles
9. `copyright-dmca.html` - Legal page styles
10. `feature-your-tank.html` - Feature form styles
11. `gear/index.html` - Gear guide styles
12. `journal-dashboard.html` - Dashboard styles
13. `journal.html` - Journal list styles
14. `journal/2025-10.html` - Journal entry styles
15. `journal/2025-11.html` - Journal entry styles
16. `media.html` - Media hub styles
17. `pages/community-video-picks.html` - Video picks styles
18. `privacy-legal.html` - Legal page styles
19. `terms.html` - Terms page styles
20. `trust-security.html` - Trust page styles

**Solution Options:**
1. **Preferred:** Move all to `/css/pages/*.css` and import via `main.bundle.css`
2. **Alternative:** Add nonces to inline style tags
3. **Quick Fix:** Use `style-src 'self' 'unsafe-inline'` (NOT recommended)

---

## Event Handlers Requiring Migration

### onload Handlers (Font Loading)

**Pattern:** `onload="this.media='all'"`
**Files:** 8+ files
**Purpose:** Async font loading optimization

**Current:**
```html
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
      media="print"
      onload="this.media='all'">
```

**Solution - External Script:**
```javascript
// /js/font-loader.js
document.querySelectorAll('link[data-font-loader]').forEach(link => {
  link.onload = function() { this.media = 'all'; };
});
```

**Updated HTML:**
```html
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
      media="print"
      data-font-loader>
```

### onerror Handlers (Image Fallbacks)

**Pattern:** `onerror="this.onerror=null;this.src='...';"`
**Files:** `blogs/index.html`, `blogs/blackbeard/index.html`
**Purpose:** Fallback image on load failure

**Solution - External Script:**
```javascript
// /js/image-fallback.js
document.querySelectorAll('img[data-fallback]').forEach(img => {
  img.onerror = function() {
    this.onerror = null;
    this.src = this.dataset.fallback;
  };
});
```

---

## Recommended Secure CSP

### Option A: Nonce-Based CSP (Recommended)

Requires server-side nonce generation per request.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://static.cloudflareinsights.com https://www.gstatic.com https://widget.cloudinary.com https://ep1.adtrafficquality.google;
  script-src-elem 'self' 'nonce-{RANDOM}' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://static.cloudflareinsights.com https://www.gstatic.com https://widget.cloudinary.com https://ep1.adtrafficquality.google;
  style-src 'self' 'nonce-{RANDOM}' https://fonts.googleapis.com;
  style-src-elem 'self' 'nonce-{RANDOM}' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://region1.analytics.google.com https://stats.g.doubleclick.net https://*.googlesyndication.com https://googleads.g.doubleclick.net https://www.googletagmanager.com https://static.cloudflareinsights.com https://cloudflareinsights.com https://formspree.io https://api.cloudinary.com https://res.cloudinary.com https://widget.cloudinary.com https://ep1.adtrafficquality.google https://fundingchoicesmessages.google.com;
  frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://bid.g.doubleclick.net https://td.doubleclick.net https://fundingchoicesmessages.google.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://widget.cloudinary.com;
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self' https://formspree.io;
  object-src 'none';
  upgrade-insecure-requests;
```

### Option B: Externalized Scripts CSP (No Nonces Required)

Move ALL inline scripts to external files.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://static.cloudflareinsights.com https://www.gstatic.com https://widget.cloudinary.com https://ep1.adtrafficquality.google;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://region1.analytics.google.com https://stats.g.doubleclick.net https://*.googlesyndication.com https://googleads.g.doubleclick.net https://www.googletagmanager.com https://static.cloudflareinsights.com https://cloudflareinsights.com https://formspree.io https://api.cloudinary.com https://res.cloudinary.com https://widget.cloudinary.com https://ep1.adtrafficquality.google https://fundingchoicesmessages.google.com;
  frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://bid.g.doubleclick.net https://td.doubleclick.net https://fundingchoicesmessages.google.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://widget.cloudinary.com;
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self' https://formspree.io;
  object-src 'none';
  upgrade-insecure-requests;
```

**Note:** This retains `'unsafe-inline'` for styles only, which is lower risk than scripts. Can be removed later with style hash migration.

### Option C: Strict-Dynamic CSP (Modern Browsers)

Uses CSP Level 3 `'strict-dynamic'` directive.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'strict-dynamic' 'nonce-{RANDOM}' https:;
  style-src 'self' 'nonce-{RANDOM}' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*;
  frame-src https://*;
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self' https://formspree.io;
  object-src 'none';
  upgrade-insecure-requests;
```

**Note:** `'strict-dynamic'` allows scripts loaded by trusted (nonced) scripts to execute. Simplifies management but requires nonce support.

---

## Migration Plan

### Phase 1: Code Externalization (Estimated: 1-2 days of development)

#### Step 1.1: Create External Script Files

Create these new JavaScript files:

**`/js/gtm-init.js`**
```javascript
// Google Tag Manager initialization
(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),
      dl=l!='dataLayer'?'&l='+l:'';
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KTRVCMQN');
```

**`/js/google-cmp-bootstrap.js`**
```javascript
// Google CMP (Funding Choices) bootstrap
(function() {
  function signalGooglefcPresent() {
    if (!window.frames['googlefcPresent']) {
      if (document.body) {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'display:none';
        iframe.name = 'googlefcPresent';
        document.body.appendChild(iframe);
      } else {
        setTimeout(signalGooglefcPresent, 0);
      }
    }
  }
  signalGooglefcPresent();
})();
```

**`/js/ga4-init.js`**
```javascript
// GA4 initialization with consent defaults
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

// Set privacy-first consent defaults
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});

// Apply stored consent if exists
(function() {
  var STORE_KEY = 'ttgConsentV2';
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var stored = JSON.parse(raw);
      if (stored.ts && (Date.now() - stored.ts) > 365 * 24 * 3600 * 1000) {
        return;
      }
      gtag('consent', 'update', {
        ad_storage: stored.ad_storage || 'denied',
        analytics_storage: stored.analytics_storage || 'denied',
        ad_user_data: stored.ad_user_data || 'denied',
        ad_personalization: stored.ad_personalization || 'denied'
      });
    }
  } catch (e) {}
})();

// Initialize GA4
gtag('js', new Date());
gtag('config', 'G-PTHZ5NZFVJ');
```

**`/js/font-loader.js`**
```javascript
// Async font loading handler
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('link[data-font-loader]').forEach(function(link) {
    link.onload = function() {
      this.media = 'all';
    };
    // Trigger load if already cached
    if (link.sheet) {
      link.media = 'all';
    }
  });
});
```

**`/js/image-fallback.js`**
```javascript
// Image fallback handler
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('img[data-fallback]').forEach(function(img) {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.dataset.fallback;
    };
  });
});
```

#### Step 1.2: Update HTML Files

Replace inline scripts with external references in all 32 affected files.

**Before:**
```html
<head>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-KTRVCMQN');</script>
  <!-- End Google Tag Manager -->
  ...
</head>
```

**After:**
```html
<head>
  <!-- Google Tag Manager -->
  <script src="/js/gtm-init.js"></script>
  <!-- End Google Tag Manager -->
  ...
</head>
```

#### Step 1.3: Migrate Inline Styles

Two approaches:

**A. Create page-specific CSS files:**
```
/css/pages/about.css
/css/pages/contact-feedback.css
/css/pages/cookie-settings.css
...
```

Import in main bundle or link directly:
```html
<link rel="stylesheet" href="/css/pages/about.css?v=1.0.0">
```

**B. Add to existing bundle:**
Consolidate common styles into `main.bundle.css` and only keep truly page-specific critical CSS inline (with nonces).

### Phase 2: CSP Update (Estimated: 1 day)

#### Step 2.1: Update Cloudflare Transform Rules

**Rule Name:** Secure CSP Headers
**Expression:** `(http.host eq "thetankguide.com")`
**Action:** Modify Response Header
**Header Name:** Content-Security-Policy
**Value:** [Use Option B CSP from above]

#### Step 2.2: Update Hardening Files

Update these files with the new CSP:
- `hardening/_headers`
- `hardening/vercel.json`
- `hardening/netlify.toml`
- `hardening/nginx.conf`

### Phase 3: Testing (Estimated: 1-2 days)

#### Testing Checklist

**Functional Testing:**
- [ ] GTM firing correctly on all pages
- [ ] GA4 tracking working (check Real-Time in GA)
- [ ] AdSense ads loading on all pages
- [ ] Funding Choices CMP appearing for EU users
- [ ] Cloudflare Analytics reporting
- [ ] Cloudinary upload widget working (feature-your-tank.html)
- [ ] YouTube embeds playing (media.html)
- [ ] Formspree forms submitting

**CSP Violation Testing:**
- [ ] Open browser DevTools Console
- [ ] Check for CSP violation errors
- [ ] Test in Chrome, Firefox, Safari, Edge
- [ ] Test on mobile devices

**Automated Testing:**
```bash
# Check for CSP violations in response headers
curl -I https://thetankguide.com/ | grep -i "content-security-policy"

# Test CSP with online validator
# https://csp-evaluator.withgoogle.com/
```

### Phase 4: Monitoring (Ongoing)

#### CSP Reporting Setup

Add report-uri directive to CSP:
```
report-uri https://your-csp-report-endpoint.com/csp-report;
report-to csp-endpoint;
```

#### Monitor for:
- CSP violation reports
- Third-party script breakage
- New script sources needed
- Performance impact

---

## Risk Assessment

### High Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| GTM Initialization | Breaks all analytics/tracking | Test extensively before deployment |
| Google CMP Bootstrap | Breaks consent management | Verify CMP appears correctly |
| AdSense Loading | Revenue impact | Test ad loading on multiple pages |
| GA4 Consent Init | Analytics data loss | Verify consent states work |

### Medium Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| Font Loading | FOUT/FOIT issues | Test font rendering |
| Image Fallbacks | Broken image indicators | Verify fallback images load |
| Inline Styles | Layout shifts | Test all pages for visual regressions |

### Low Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| JSON-LD | None - no execution | No action needed |
| External Scripts | Already compliant | Just verify they still work |

---

## Cloudflare Configuration Guide

### Global CSP Transform Rule

**Rule Name:** Global Secure CSP Headers
**When:** `(http.host eq "thetankguide.com")`
**Then:** Set Response Header

**Header Name:** `Content-Security-Policy`
**Header Value:**
```
default-src 'self'; script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://static.cloudflareinsights.com https://www.gstatic.com https://widget.cloudinary.com https://ep1.adtrafficquality.google; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://region1.analytics.google.com https://stats.g.doubleclick.net https://*.googlesyndication.com https://googleads.g.doubleclick.net https://www.googletagmanager.com https://static.cloudflareinsights.com https://cloudflareinsights.com https://formspree.io https://api.cloudinary.com https://res.cloudinary.com https://widget.cloudinary.com https://ep1.adtrafficquality.google https://fundingchoicesmessages.google.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://bid.g.doubleclick.net https://td.doubleclick.net https://fundingchoicesmessages.google.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://widget.cloudinary.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://formspree.io; object-src 'none'; upgrade-insecure-requests
```

### Media Page CSP Override (Existing)

Keep the existing `/media.html` override rule for YouTube embed support.

---

## Implementation Checklist

### Pre-Migration

- [ ] Back up all HTML files
- [ ] Document current analytics baseline (sessions, events)
- [ ] Set up CSP violation reporting endpoint
- [ ] Create feature branch for changes

### Phase 1: Externalize Scripts

- [ ] Create `/js/gtm-init.js`
- [ ] Create `/js/google-cmp-bootstrap.js`
- [ ] Create `/js/ga4-init.js`
- [ ] Create `/js/font-loader.js`
- [ ] Create `/js/image-fallback.js`
- [ ] Update all 32 HTML files to use external scripts
- [ ] Update `includes/ga4.html` to use external script
- [ ] Update event handlers to use data attributes
- [ ] Test all pages locally

### Phase 2: Migrate Styles (Optional)

- [ ] Audit all inline `<style>` blocks
- [ ] Move critical styles to external CSS
- [ ] Update HTML to reference new CSS files
- [ ] Test for layout regressions

### Phase 3: Update CSP

- [ ] Update `hardening/_headers`
- [ ] Update `hardening/vercel.json`
- [ ] Update `hardening/netlify.toml`
- [ ] Update `hardening/nginx.conf`
- [ ] Deploy to staging environment

### Phase 4: Testing

- [ ] Test GTM firing
- [ ] Test GA4 tracking
- [ ] Test AdSense ads
- [ ] Test Funding Choices CMP
- [ ] Test Cloudflare Analytics
- [ ] Test Cloudinary widget
- [ ] Test YouTube embeds
- [ ] Test Formspree forms
- [ ] Check console for CSP violations
- [ ] Cross-browser testing

### Phase 5: Production Deployment

- [ ] Update Cloudflare Transform Rules with new CSP
- [ ] Deploy code changes
- [ ] Monitor CSP violation reports
- [ ] Monitor analytics for data loss
- [ ] Monitor ad revenue

### Post-Migration

- [ ] Document final CSP configuration
- [ ] Set up ongoing CSP monitoring
- [ ] Schedule quarterly CSP review
- [ ] Update security documentation

---

## Security Notes

### Critical Warnings

- **NEVER** use `'unsafe-inline'` in production script-src after migration
- **NEVER** use `'unsafe-eval'` unless absolutely required
- **ALWAYS** test thoroughly before production deployment
- **ALWAYS** monitor CSP violations after deployment

### Best Practices

1. Use nonces for any remaining inline scripts (generated per-request)
2. Use hashes for static inline scripts that rarely change
3. Regularly audit CSP for new bypass techniques
4. Keep third-party script allowlist as minimal as possible
5. Use `report-uri` to monitor violations
6. Review CSP quarterly for new requirements

### Future Improvements

1. **Remove `'unsafe-inline'` from style-src:** Use CSS hashes or nonces
2. **Implement CSP reporting:** Set up report-uri endpoint
3. **Add Subresource Integrity (SRI):** For third-party scripts
4. **Consider Trusted Types:** For DOM XSS protection

---

## Files to Create/Modify

### New Files to Create

```
/js/gtm-init.js
/js/google-cmp-bootstrap.js
/js/ga4-init.js
/js/font-loader.js
/js/image-fallback.js
```

### Files to Modify

```
All 32 HTML files with GTM
All 31 HTML files with CMP bootstrap
All 31 HTML files with consent bridge
includes/ga4.html
hardening/_headers
hardening/vercel.json
hardening/netlify.toml
hardening/nginx.conf
```

---

## Conclusion

This audit identifies significant CSP vulnerabilities that require immediate attention. The presence of `'unsafe-inline'` in script-src creates substantial XSS risk that attackers can exploit.

**Recommended Approach:** Option B (Externalized Scripts)

This approach:
- Removes `'unsafe-inline'` from script-src entirely
- Requires no server-side nonce generation
- Maintains compatibility with static site hosting
- Allows gradual migration of inline styles

**Timeline:** With focused effort, this migration can be completed within 3-5 days of development time, followed by thorough testing.

**Priority:** HIGH - Address within next sprint cycle

---

*Report generated by CSP Security Audit Tool*
*For questions, contact security team*
