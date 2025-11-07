# Sticky Advisor Page - Test Logic Report

**Branch:** `claude/test-sticky-advisor-page-011CUuFwhJh7JWCiXvVha68o`
**Date:** 2025-11-07
**Tester:** Claude (Automated Analysis)
**Page:** `/stocking-advisor.html`

---

## Executive Summary

This report analyzes the stocking advisor page for sticky positioning logic. **Currently, no sticky positioning is implemented.** All cards use `position: relative` or default positioning. This report evaluates whether sticky behavior should be added and provides test scenarios for implementation.

---

## Current State Analysis

### Page Structure

The stocking advisor page consists of the following main sections (in scroll order):

1. **Hero Section** (`.hero`)
   - Title: "Stocking Advisor"
   - Tagline and description
   - Status: Static, no sticky behavior

2. **Tank Size Card** (`#tank-size-card`)
   - Contains tank size selector
   - Filter product selection
   - Custom filter inputs
   - Turnover calculation display
   - Status: `position: relative`, no sticky behavior

3. **Current Stock Card** (`#stock-list-card`)
   - Shows selected species
   - Displays stock warnings
   - Status: `position: relative`, no sticky behavior

4. **Environmental Recommendations Card** (`#env-card`)
   - Shows water parameter ranges (temp, pH, hardness)
   - Bioload capacity meter
   - Expandable environmental legend
   - Status: `position: relative`, no sticky behavior

5. **Plan Your Stock Section** (`.panel`)
   - Species selector
   - Quantity input
   - "Add to Stock" button
   - Status: Static positioning

6. **Educational Content**
   - FAQ sections
   - Informational text
   - Status: Static positioning

### CSS Positioning Evidence

```css
/* From stocking-advisor.html inline styles */
#stocking-page #env-card {
  overflow: visible;
  position: relative;  /* NOT sticky */
}

#stocking-page #tank-size-card .card-header {
  position: relative;  /* NOT sticky */
  overflow: visible;
}

/* From css/style.css */
/* Explicitly prevents sticky/fixed positioning for nav */
position: static !important;   /* ensure non-sticky, non-fixed */
```

### JavaScript Scroll Behavior

**Analysis of `/js/stocking.js`:**
- Contains scroll capture logic: `captureStockScrollAnchor()` (lines 151-164)
- Captures `scrollY` and element position for scroll restoration
- Used for maintaining scroll position after DOM updates
- **No scroll listeners for sticky behavior**
- **No IntersectionObserver for sticky effects**

```javascript
function captureStockScrollAnchor() {
  if (typeof window === 'undefined') {
    return null;
  }
  const root = document.getElementById('stock-list');
  if (!root) {
    return null;
  }
  const rect = root.getBoundingClientRect();
  return {
    top: rect.top,
    scrollY: window.scrollY,  // Captures scroll position
  };
}
```

**Purpose:** This is for scroll *restoration*, not sticky positioning.

---

## Sticky Positioning Candidates

### 1. Environmental Recommendations Card (PRIMARY CANDIDATE)

**Rationale:**
- Contains critical reference information (water parameters, bioload %)
- Users frequently need to reference this while scrolling to "Plan Your Stock"
- The card appears BEFORE the planning section
- Making it sticky would keep parameters visible while adding species

**User Flow Impact:**
```
User scrolls down → Reaches "Plan Your Stock" section
└─ Without sticky: Must scroll up to check env. recommendations
└─ With sticky: Env. card follows user, parameters stay visible
```

**Implementation Considerations:**
- Should stick when scrolling past the card
- Should unstick before footer to avoid overlap
- Mobile: May need to collapse/compact when sticky
- Desktop: Could stick to top with reduced height

### 2. Tank Size Card (SECONDARY CANDIDATE)

**Rationale:**
- Contains fundamental parameters (tank size, filtration)
- Less frequently referenced during species selection
- Already at top of page (short scroll to access)

**Recommendation:** LOW priority for sticky behavior

### 3. "Plan Your Stock" Section (ALTERNATIVE APPROACH)

**Rationale:**
- Action panel for adding species
- Could stick to bottom of viewport as a "quick add" bar

**Implementation Considerations:**
- Bottom-sticky approach (like chat widgets)
- Would require compact/collapsed state
- May interfere with mobile keyboards

**Recommendation:** MEDIUM priority, different UX pattern

---

## Test Scenarios

### Scenario 1: Environmental Card - Desktop Sticky Behavior

**Setup:**
1. Navigate to `/stocking-advisor.html`
2. Select a tank size (e.g., 20 gallons)
3. Add 2-3 species to populate env. recommendations
4. Scroll down past the Environmental Recommendations card

**Expected Behavior (if implemented):**
- ✓ Env. card should stick to top of viewport when scrolled past
- ✓ Card should remain visible while "Plan Your Stock" is in view
- ✓ Card should unstick before reaching footer
- ✓ Sticky state should have visual indicator (shadow, border, etc.)
- ✓ Z-index should ensure card appears above other content
- ✓ Scroll performance should remain smooth (60fps)

**Current Behavior:**
- ✗ Card scrolls out of view normally
- ✗ No sticky behavior implemented

**Test Code:**
```javascript
test('env-card sticks on scroll (desktop)', async ({ page }) => {
  await page.goto('/stocking-advisor.html');

  // Setup: add species to populate card
  await page.selectOption('#tank-size', '20');
  await page.selectOption('#plan-species', 'neon-tetra');
  await page.fill('#plan-qty', '6');
  await page.click('#plan-add');

  const envCard = page.locator('#env-card');

  // Get initial position
  const initialRect = await envCard.boundingBox();

  // Scroll down 500px
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(100);

  // Check if sticky
  const stickyRect = await envCard.boundingBox();

  // If sticky, y position should be at top (e.g., < 20px from top)
  expect(stickyRect.y).toBeLessThan(20);

  // Check for sticky class or attribute
  await expect(envCard).toHaveClass(/is-sticky|sticky/);
});
```

### Scenario 2: Environmental Card - Mobile Sticky Behavior

**Setup:**
1. Set viewport to mobile (375x667)
2. Navigate to page
3. Add species
4. Scroll down

**Expected Behavior (if implemented):**
- ✓ Card should compact when sticky (show only key metrics)
- ✓ Should not cover too much vertical space
- ✓ Tap to expand full details
- ✓ Should unstick if user scrolls back up past it

**Current Behavior:**
- ✗ No sticky behavior
- ✗ No compact mode

**Test Code:**
```javascript
test.use({ ...devices['iPhone 12'] });

test('env-card sticky compact mode (mobile)', async ({ page }) => {
  await page.goto('/stocking-advisor.html');

  // Add species
  await page.selectOption('#tank-size', '10');
  await page.selectOption('#plan-species', 'betta');
  await page.fill('#plan-qty', '1');
  await page.click('#plan-add');

  const envCard = page.locator('#env-card');

  // Scroll to trigger sticky
  await page.evaluate(() => window.scrollBy(0, 400));

  // Check for compact class
  await expect(envCard).toHaveClass(/is-sticky|compact/);

  // Check height is reduced
  const height = await envCard.evaluate(el => el.offsetHeight);
  expect(height).toBeLessThan(200); // Compact should be < 200px
});
```

### Scenario 3: Info Toggle Interaction While Sticky

**Setup:**
1. Make env. card sticky (scroll down)
2. Click info icon to expand environmental legend
3. Observe behavior

**Expected Behavior:**
- ✓ Info panel should open above sticky card
- ✓ Overlay/backdrop should appear
- ✓ Sticky card should remain visible behind modal
- ✓ Closing modal should return to sticky state

**Current Behavior:**
- Info toggle works normally (tested in stocking-env-header.spec.ts)
- No sticky interaction to test

**Test Code:**
```javascript
test('info toggle works while env-card is sticky', async ({ page }) => {
  await page.goto('/stocking-advisor.html');

  // Populate and scroll
  await page.selectOption('#tank-size', '20');
  await page.selectOption('#plan-species', 'neon-tetra');
  await page.fill('#plan-qty', '6');
  await page.click('#plan-add');
  await page.evaluate(() => window.scrollBy(0, 500));

  const envCard = page.locator('#env-card');
  const infoBtn = page.locator('#env-info-btn');
  const legend = page.locator('#env-more-tips');

  // Verify sticky
  await expect(envCard).toHaveClass(/is-sticky/);

  // Click info
  await infoBtn.click();
  await expect(legend).toBeVisible();

  // Card should still be sticky
  await expect(envCard).toHaveClass(/is-sticky/);

  // Close
  await infoBtn.click();
  await expect(legend).toBeHidden();
});
```

### Scenario 4: Scroll Performance Test

**Setup:**
1. Add multiple species (10+)
2. Rapidly scroll up and down
3. Monitor frame rate

**Expected Behavior:**
- ✓ Scroll should maintain 60fps
- ✓ No janky/stuttery movement
- ✓ Sticky transitions should be smooth
- ✓ No layout thrashing

**Test Code:**
```javascript
test('sticky scroll performance', async ({ page }) => {
  await page.goto('/stocking-advisor.html');

  // Add many species
  for (let i = 0; i < 10; i++) {
    await page.selectOption('#plan-species', 'neon-tetra');
    await page.fill('#plan-qty', '1');
    await page.click('#plan-add');
  }

  // Start performance monitoring
  await page.evaluate(() => {
    window.perfMarks = [];
    window.addEventListener('scroll', () => {
      window.perfMarks.push(performance.now());
    });
  });

  // Rapid scroll
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 100));
    await page.waitForTimeout(16); // ~60fps
  }

  // Check for dropped frames
  const marks = await page.evaluate(() => window.perfMarks);
  const intervals = marks.slice(1).map((m, i) => m - marks[i]);
  const droppedFrames = intervals.filter(int => int > 33).length; // >33ms = dropped frame

  expect(droppedFrames).toBeLessThan(2); // Allow max 2 dropped frames
});
```

### Scenario 5: Accessibility - Keyboard Navigation with Sticky Card

**Setup:**
1. Make card sticky
2. Use Tab to navigate through page
3. Verify focus management

**Expected Behavior:**
- ✓ Tab order should remain logical
- ✓ Sticky card controls should be reachable
- ✓ Focus should not get trapped
- ✓ Skip links should account for sticky header

**Test Code:**
```javascript
test('keyboard nav with sticky card', async ({ page }) => {
  await page.goto('/stocking-advisor.html');

  // Setup sticky state
  await page.selectOption('#tank-size', '20');
  await page.selectOption('#plan-species', 'neon-tetra');
  await page.fill('#plan-qty', '6');
  await page.click('#plan-add');
  await page.evaluate(() => window.scrollBy(0, 500));

  // Tab through page
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // Focus should be on interactive element
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(focused);

  // Verify sticky card controls are in tab order
  const envInfoBtn = page.locator('#env-info-btn');
  await envInfoBtn.focus();
  await expect(envInfoBtn).toBeFocused();
});
```

### Scenario 6: Unstick on Footer Proximity

**Setup:**
1. Scroll to bottom of page
2. Observe when card unsticks

**Expected Behavior:**
- ✓ Card should unstick before overlapping footer
- ✓ Smooth transition from sticky to static
- ✓ Should re-stick when scrolling back up

**Test Code:**
```javascript
test('env-card unsticks before footer', async ({ page }) => {
  await page.goto('/stocking-advisor.html');

  // Setup
  await page.selectOption('#tank-size', '20');
  await page.selectOption('#plan-species', 'neon-tetra');
  await page.fill('#plan-qty', '6');
  await page.click('#plan-add');

  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);

  const envCard = page.locator('#env-card');
  const footer = page.locator('#site-footer');

  // Get positions
  const cardRect = await envCard.boundingBox();
  const footerRect = await footer.boundingBox();

  // Card should not overlap footer
  expect(cardRect.y + cardRect.height).toBeLessThanOrEqual(footerRect.y);

  // Should not have sticky class at bottom
  const hasSticky = await envCard.evaluate(el =>
    el.classList.contains('is-sticky')
  );
  expect(hasSticky).toBe(false);
});
```

---

## Technical Implementation Recommendations

### CSS Approach

```css
/* Sticky Environmental Card */
#env-card.is-sticky {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--panel);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-bottom: 2px solid var(--border);
}

/* Compact mode for sticky state */
#env-card.is-sticky.is-compact {
  max-height: 120px;
  overflow: hidden;
}

/* Mobile compact mode */
@media (max-width: 640px) {
  #env-card.is-sticky {
    max-height: 100px;
  }

  #env-card.is-sticky .env-bars {
    display: none; /* Hide details, show only summary */
  }

  #env-card.is-sticky .env-compact-summary {
    display: block;
  }
}

/* Unstick trigger zone (near footer) */
body.near-footer #env-card.is-sticky {
  position: relative;
  top: auto;
}
```

### JavaScript Approach (IntersectionObserver)

```javascript
// Recommended: Use IntersectionObserver for performance

const envCard = document.querySelector('#env-card');
const stickyTrigger = envCard; // Element that triggers sticky
const footer = document.querySelector('#site-footer');

// Observer for sticky trigger
const stickyObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        envCard.classList.remove('is-sticky');
      } else {
        envCard.classList.add('is-sticky');
      }
    });
  },
  {
    threshold: 0,
    rootMargin: '-1px 0px 0px 0px' // Trigger just before leaving viewport
  }
);

// Observer for footer proximity (unstick)
const footerObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.body.classList.add('near-footer');
      } else {
        document.body.classList.remove('near-footer');
      }
    });
  },
  {
    threshold: 0,
    rootMargin: '200px 0px 0px 0px' // Trigger 200px before footer
  }
);

stickyObserver.observe(stickyTrigger);
footerObserver.observe(footer);
```

### Alternative: CSS-Only Sticky (Simpler)

```css
#env-card {
  position: sticky;
  top: 0;
  z-index: 100;
}

/* No JavaScript needed, but less control over behavior */
```

---

## Browser Compatibility

### Position: Sticky Support

| Browser | Min Version | Notes |
|---------|-------------|-------|
| Chrome | 56+ | ✓ Full support |
| Firefox | 59+ | ✓ Full support |
| Safari | 13+ | ✓ Full support (iOS 13+) |
| Edge | 16+ | ✓ Full support |

**Fallback Strategy:**
- Browsers without sticky support will see normal scrolling behavior
- Use `@supports (position: sticky)` to conditionally apply styles
- Provide visual indicator only when supported

```css
@supports (position: sticky) {
  #env-card {
    position: sticky;
    top: 0;
  }
}
```

---

## Accessibility Considerations

### ARIA Attributes

```html
<!-- When sticky -->
<section
  class="card ttg-card tank-env-card env-card is-sticky"
  id="env-card"
  data-role="env-card"
  aria-live="polite"
  aria-label="Environmental Recommendations (pinned)"
>
```

### Focus Management

- Ensure sticky card controls remain in logical tab order
- Skip link should account for sticky header height
- Screen readers should announce sticky state change

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  #env-card {
    /* Disable sticky for users who prefer reduced motion */
    position: relative !important;
  }
}
```

---

## Performance Metrics

### Expected Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Scroll FPS | 60fps | < 30fps fail |
| Layout Shift (CLS) | < 0.1 | > 0.25 fail |
| Sticky Transition | < 100ms | > 200ms noticeable |
| Memory Impact | < 5MB | > 10MB concern |

### Monitoring

```javascript
// Performance Observer for layout shift
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.hadRecentInput) continue;
    console.log('Layout Shift:', entry.value);
  }
});

observer.observe({ type: 'layout-shift', buffered: true });
```

---

## Risks & Mitigations

### Risk 1: Layout Shift on Sticky Activation

**Impact:** Content jumps when card becomes sticky
**Likelihood:** High
**Mitigation:**
- Reserve space for sticky card with placeholder
- Use `position: sticky` instead of `fixed` (preserves flow)
- Smooth transition with CSS

### Risk 2: Mobile Viewport Obstruction

**Impact:** Sticky card covers too much screen on mobile
**Likelihood:** Medium
**Mitigation:**
- Implement compact mode for mobile
- Auto-hide when scrolling down, show when scrolling up
- Collapse to single-line summary

### Risk 3: Z-index Conflicts

**Impact:** Sticky card appears behind modals/popovers
**Likelihood:** Medium (already have popovers on page)
**Mitigation:**
- Establish z-index hierarchy:
  - Modals: 9999+
  - Sticky cards: 100-200
  - Popovers: 1200
- Remove sticky class when modal is open

### Risk 4: Performance on Long Pages

**Impact:** Scroll lag with many DOM elements
**Likelihood:** Low (page is not excessively long)
**Mitigation:**
- Use CSS `position: sticky` (GPU accelerated)
- Avoid JavaScript scroll listeners if possible
- Use IntersectionObserver instead of scroll events

---

## Recommendations

### Priority 1: Environmental Card Sticky Implementation

**Recommendation:** IMPLEMENT sticky behavior for `#env-card`

**Justification:**
1. High user value - keeps critical reference info visible
2. Low implementation complexity - can use CSS-only approach
3. Common UX pattern in similar tools
4. Minimal accessibility concerns with proper implementation

**Implementation Steps:**
1. Add CSS `position: sticky` to `#env-card`
2. Add visual differentiation for sticky state (shadow, border)
3. Implement compact mode for mobile viewports
4. Test across browsers and devices
5. Monitor performance metrics
6. Gather user feedback

### Priority 2: Comprehensive Testing

**Recommendation:** Create full test suite for sticky behavior

**Tests to Implement:**
1. ✓ Desktop sticky activation/deactivation
2. ✓ Mobile compact mode
3. ✓ Footer proximity unstick
4. ✓ Info toggle interaction while sticky
5. ✓ Keyboard navigation
6. ✓ Screen reader announcements
7. ✓ Scroll performance
8. ✓ Cross-browser compatibility

### Priority 3: User Testing

**Recommendation:** A/B test sticky vs. non-sticky behavior

**Metrics to Track:**
- Time to complete stocking plan
- Number of scrolls up to reference env. card
- User satisfaction survey
- Task completion rate
- Bounce rate on page

---

## Conclusion

### Current State
- ✗ No sticky positioning implemented
- ✗ All cards use static/relative positioning
- ✓ Existing code is well-structured for adding sticky behavior

### Recommended Next Steps

1. **Implement CSS-only sticky** for `#env-card` as MVP
2. **Add compact mode** for mobile viewports (< 640px)
3. **Create test suite** using Playwright (scenarios outlined above)
4. **Monitor performance** - ensure no layout shift or scroll lag
5. **Gather user feedback** - validate UX improvement
6. **Iterate** based on metrics and feedback

### Test Coverage Status

| Test Scenario | Status | Priority |
|---------------|--------|----------|
| Desktop sticky activation | ❌ Not implemented | HIGH |
| Mobile compact mode | ❌ Not implemented | HIGH |
| Info toggle while sticky | ❌ Not implemented | MEDIUM |
| Scroll performance | ❌ Not implemented | HIGH |
| Keyboard navigation | ❌ Not implemented | HIGH |
| Footer unstick | ❌ Not implemented | MEDIUM |
| Cross-browser compat | ❌ Not implemented | MEDIUM |
| A11y screen reader | ❌ Not implemented | HIGH |

### Sign-off

This analysis provides a comprehensive foundation for implementing and testing sticky behavior on the stocking advisor page. The recommended approach (sticky Environmental Recommendations card) balances user value, technical feasibility, and accessibility requirements.

**Recommendation:** PROCEED with implementation of sticky `#env-card` with test suite.

---

**Report Generated:** 2025-11-07
**Analyst:** Claude (Automated Code Analysis)
**Branch:** `claude/test-sticky-advisor-page-011CUuFwhJh7JWCiXvVha68o`
