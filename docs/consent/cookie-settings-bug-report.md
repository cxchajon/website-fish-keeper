# Cookie Settings Page Bug Report

**Date:** 2025-11-19
**Page:** `/cookie-settings.html`
**Status:** Fixed

---

## Summary

The cookie settings page at `/cookie-settings.html` has two main issues:
1. Analytics/Advertising toggles do not reflect the real consent state
2. Changes made on this page do not persist correctly or are not respected across the site

---

## Root Cause Analysis

### Issue 1: Toggles Not Reflecting Current Consent

**Primary Cause: Script Execution Timing**

The inline script at the bottom of `cookie-settings.html` checks `document.readyState` to decide whether to run `init()` immediately or wait for `DOMContentLoaded`:

```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

When `readyState` is not `'loading'` (e.g., `'interactive'`), the script calls `init()` immediately. However, `consent-mode.js` is loaded with the `defer` attribute, which means:

1. Deferred scripts execute after document parsing completes
2. But the inline script at end of body might execute before deferred scripts in some cases
3. This creates a race condition where `window.ttgConsent` might not be available when `init()` runs

**Secondary Cause: Missing Normalization**

The inline script's `loadConsent()` fallback reads raw localStorage data:

```javascript
var raw = localStorage.getItem(STORE_KEY);
return JSON.parse(raw);  // Returns raw object
```

But `consent-mode.js` normalizes the data through `normalizeConsent()` which ensures consistent field names and boolean values. The inline script does have normalization logic in `updateTogglesFromConsent()`, but the inconsistency can cause issues.

### Issue 2: Settings Not Persisting / Not Respected

**Primary Cause: Incorrect gtag Consent Update**

When `window.ttgConsent` is not available, the inline script falls back to its own `updateGtagConsent()` function:

```javascript
if (typeof window.gtag === 'function') {
  window.gtag('consent', 'default', deniedPayload);  // WRONG!
  window.gtag('consent', 'update', payload);
}
```

This incorrectly calls `gtag('consent', 'default', ...)` on every save operation. The 'default' consent should only be set once at page load, not on every user action. While Google ignores subsequent 'default' calls, this pattern is incorrect and can cause confusion.

**Secondary Cause: API Not Available**

When `window.ttgConsent.updateConsentFromToggles()` is not available due to timing issues, the save falls back to direct localStorage writes and manual gtag calls. This bypasses:
- The `emitConsentUpdate()` event dispatch
- The `applyAdConsentState()` DOM updates
- Proper integration with the consent state machine

---

## Consent System Architecture

### Storage
- **Key:** `ttgConsentV2` (localStorage)
- **Format:** JSON object with fields:
  - `ad_storage`: 'granted' | 'denied'
  - `analytics_storage`: 'granted' | 'denied'
  - `ad_user_data`: 'granted' | 'denied'
  - `ad_personalization`: 'granted' | 'denied'
  - `advertising`: boolean
  - `analytics`: boolean
  - `ts`: timestamp

### consent-mode.js API
- `window.ttgConsent.readConsent()` - Load and normalize stored consent
- `window.ttgConsent.updateConsentFromToggles(prefs)` - Save consent and update gtag
- `window.ttgConsent.defaultDenied()` - Get default denied state
- `window.__ttgUpdateConsentState__(state)` - Update consent state directly

### Flow
1. GA4 loads and configures (`/includes/ga4.html`)
2. `consent-mode.js` sets denied defaults and loads saved consent
3. Banner or settings page reads/writes consent through the API
4. gtag consent is updated via `gtag('consent', 'update', ...)`

---

## Fix Implementation

### Changes Made

#### 1. Ensure init() Always Waits for DOMContentLoaded

Changed the inline script to always wait for `DOMContentLoaded`, ensuring `consent-mode.js` has fully executed:

```javascript
// Always wait for DOMContentLoaded to ensure consent-mode.js is ready
document.addEventListener('DOMContentLoaded', init);
```

#### 2. Use Shared Consent API Exclusively

Modified the inline script to rely on `window.ttgConsent` API functions:
- Uses `window.ttgConsent.readConsent()` for loading
- Uses `window.ttgConsent.updateConsentFromToggles()` for saving
- Uses `window.ttgConsent.defaultDenied()` for default state

#### 3. Remove Duplicate Logic

Removed the fallback localStorage read/write logic that duplicated consent-mode.js functionality. The page now requires consent-mode.js to be loaded (which it always is).

#### 4. Fix gtag Update Logic

Removed the incorrect `gtag('consent', 'default', ...)` call from save operations. Updates now properly use the shared API which calls only `gtag('consent', 'update', ...)`.

#### 5. Add Safety Checks

Added a check to ensure the consent API is available before proceeding:

```javascript
if (!window.ttgConsent || typeof window.ttgConsent.readConsent !== 'function') {
  log('consent API not available, cannot initialize');
  return;
}
```

---

## Files Modified

1. **`/cookie-settings.html`**
   - Rewrote inline script to use shared consent API
   - Removed duplicate loadConsent/persistConsent logic
   - Fixed DOMContentLoaded handling
   - Removed incorrect gtag 'default' calls

---

## Testing Notes

### Scenario A — New Visitor
1. Open fresh incognito window
2. Navigate directly to `/cookie-settings.html`
3. **Expected:**
   - Analytics toggle: OFF
   - Advertising toggle: OFF
4. Toggle both ON and click "Save settings"
5. Reload the page
6. **Expected:** Both toggles remain ON

### Scenario B — Banner First, Then Settings
1. Fresh session, go to homepage
2. Use banner to "Allow All"
3. Navigate to `/cookie-settings.html`
4. **Expected:**
   - Analytics: ON
   - Advertising: ON
5. Turn Analytics OFF, leave Advertising ON, click "Save settings"
6. Reload `/cookie-settings.html`
7. **Expected:**
   - Analytics: OFF
   - Advertising: ON

### Scenario C — Respect Across Pages
1. Save combination on `/cookie-settings.html` (e.g., Analytics OFF, Advertising ON)
2. Navigate to another page with GA/AdSense
3. **Expected:** Consent Mode settings match saved values (no silent override)

### Verification Points
- [ ] Single GA4 loader (`G-PTHZ5NZFVJ`) present
- [ ] consent-mode.js does not load GA4 again
- [ ] Banner and settings page use same storage key (`ttgConsentV2`)
- [ ] gtag 'default' only called once at page load
- [ ] gtag 'update' called on every consent change

---

## Compliance Notes

- **Privacy-first defaults:** All consent denied until user explicitly grants
- **No silent opt-in:** Toggles default to OFF for new visitors
- **Consistent state:** Banner and settings page share same storage and API
- **GDPR/CCPA compliant:** User choices are respected across the site
