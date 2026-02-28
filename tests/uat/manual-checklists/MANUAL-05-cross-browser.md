# MANUAL-05: Cross-Browser Compatibility

**Tier:** 3 (Nice-to-Have — Post-Launch Polish)
**Requires:** Access to Chrome, Firefox, Safari, Mobile Chrome
**Time:** ~15 minutes
**Tester:** ____________________
**Date:** ____________________
**Result:** PASS / FAIL

---

## Pre-Conditions

- [ ] Demo account credentials available
- [ ] Application running at accessible URL
- [ ] DevTools console accessible in each browser

**Test URL:** ____________________

---

## Browser Matrix

For each browser, complete the checklist below.

### Chrome (Desktop)

**Version:** ____________________

- [ ] Login page loads, form visible
- [ ] Login succeeds, redirected to dashboard
- [ ] Dashboard renders correctly (no broken layout)
- [ ] Calls page loads with data
- [ ] Wallet page shows balance
- [ ] Agent Config page loads, textarea editable
- [ ] Console: 0 errors (warnings acceptable)
  - Error count: ____

### Firefox (Desktop)

**Version:** ____________________

- [ ] Login page loads, form visible
- [ ] Login succeeds, redirected to dashboard
- [ ] Dashboard renders correctly
- [ ] Calls page loads with data
- [ ] Wallet page shows balance
- [ ] Agent Config page loads, textarea editable
- [ ] Console: 0 errors
  - Error count: ____

### Safari (Desktop — macOS)

**Version:** ____________________

- [ ] Login page loads, form visible
- [ ] Login succeeds, redirected to dashboard
- [ ] Dashboard renders correctly
- [ ] Calls page loads with data
- [ ] Wallet page shows balance
- [ ] Agent Config page loads, textarea editable
- [ ] Console: 0 errors
  - Error count: ____

### Mobile Chrome (Android)

**Device:** ____________________
**Version:** ____________________

- [ ] Login page loads, form usable (no overlap)
- [ ] Login succeeds
- [ ] Dashboard readable without horizontal scroll
- [ ] Sidebar accessible (hamburger menu or auto-collapse)
- [ ] Calls page readable on mobile
- [ ] Top Up button tappable

### Mobile Safari (iOS)

**Device:** ____________________
**Version:** ____________________

- [ ] Login page loads, form usable
- [ ] Login succeeds
- [ ] Dashboard readable without horizontal scroll
- [ ] Sidebar accessible
- [ ] Calls page readable on mobile
- [ ] Top Up button tappable

---

## Pass Criteria

All browsers: Login + Dashboard + Calls + Wallet load without console errors.
Mobile: No horizontal scroll on key pages.

## Known Issues / Browser-Specific Bugs

```
(Record any browser-specific issues here)


```

## Screenshots

Attach screenshots of any rendering issues per browser.
