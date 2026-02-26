# Sign-Up Failure Mode Audit — Quick Reference Checklist

**Status:** ✅ Audit Complete
**Date:** February 25, 2026
**Total Failure Modes Identified:** 15
**Critical Fixes:** 4
**Recommended Implementation Time:** 2-3 weeks

---

## One-Page Summary

The sign-up flow can break in **15 ways** — most are edge cases, but **4 are critical** where users get stuck. The good news: most fixes are simple, quick wins.

**Priority fixes (do first):**
1. 🔴 Network timeouts trigger rate limit (unfair)
2. 🔴 Account created but sign-in fails (unclear state)
3. 🔴 IP rate limit blocks entire office (too aggressive)
4. 🔴 Duplicate email error is confusing (missing recovery links)

---

## 15 Failure Modes Checklist

### Critical (🔴) — Users Get Stuck

- [ ] **#1 Network Timeout** — Network error counted as auth failure, user rate-limited unfairly
  - **Fix:** Distinguish network errors, don't count toward rate limit
  - **Effort:** Low | **Impact:** High

- [ ] **#2 Account Created, Sign-In Failed** — Account created but sign-in fails, unclear state
  - **Fix:** Log to Sentry, show "Account created! Signing in..." + redirect to login
  - **Effort:** Medium | **Impact:** High

- [ ] **#3 IP Rate Limit Blocks Office** — 1 person's mistakes locks entire office (IP-based limit)
  - **Fix:** Switch to email-based + IP-based (defense in depth)
  - **Effort:** Medium | **Impact:** Critical

- [ ] **#4 Duplicate Email Error Confusing** — Error says "sign in" but doesn't link to sign-in
  - **Fix:** Show recovery options (sign in, password reset) as buttons
  - **Effort:** Low | **Impact:** Medium

### High (🟠) — Better UX Needed

- [ ] **#5 Form Clears on Error** — User loses form values if rate-limited
  - **Fix:** Auto-save to localStorage
  - **Effort:** Low | **Impact:** Low

- [ ] **#6 Rate Limit Timeout Mismatch** — Backend 60s, frontend 15 min (confusing)
  - **Fix:** Sync both to 60 seconds
  - **Effort:** Low | **Impact:** Low

- [ ] **#7 Password Strength Confusing** — "Fair" sounds weak but is acceptable
  - **Fix:** Change to "Good", add requirement checklist, show ✓ icons
  - **Effort:** Low | **Impact:** Medium

- [ ] **#8 Step 2 Sign-In Error No Context** — Unclear why sign-in failed
  - **Fix:** Log to Sentry, show contextual error message
  - **Effort:** Medium | **Impact:** Low

### Medium (🟡) — Polish & Edge Cases

- [ ] **#9 Email Case Sensitivity** — "Alice@EXAMPLE.COM" vs "alice@example.com" mismatch
  - **Fix:** Normalize email to lowercase everywhere
  - **Effort:** Low | **Impact:** Low

- [ ] **#10 No Loading Feedback** — Slow network = user thinks submit didn't work
  - **Fix:** Add progress box, darker button on loading
  - **Effort:** Low | **Impact:** Low

- [ ] **#11 Password Reset Hidden** — User doesn't know they can reset password
  - **Fix:** Add "Forgot password?" link, show in 409 error
  - **Effort:** Low | **Impact:** Low

- [ ] **#12 Mobile Error Cutoff** — Error message cut off on small screens
  - **Fix:** Responsive padding, scroll-into-view, wrap text
  - **Effort:** Low | **Impact:** Low

### Low (🟢) — Accessibility & Polish

- [ ] **#13 Screen Readers Miss Errors** — Error messages not announced
  - **Fix:** Add `role="alert"` + `aria-live="polite"`
  - **Effort:** Low | **Impact:** Niche

- [ ] **#14 Browser Autocomplete Issues** — Autocomplete doesn't trigger strength meter
  - **Fix:** Use `autoComplete` attributes, let browser do its thing
  - **Effort:** None | **Impact:** None (browsers handle this)

- [ ] **#15 No Success Message** — Page redirects instantly, unclear if it worked
  - **Fix:** Show "✅ Account created!" for 2 seconds before redirect
  - **Effort:** Low | **Impact:** Low

---

## Implementation Roadmap

### Week 1: Critical Fixes (All 4)
**Effort:** 2-3 developer days | **Blocker Removal:** High

```
Day 1:
  [ ] Fix #1: Network timeout detection (1 hour)
  [ ] Fix #4: Better 409 error messages (1 hour)
  [ ] Test: Network failure scenarios

Day 2:
  [ ] Fix #3: Switch to email + IP rate limiting (3 hours)
  [ ] Fix #2: Better sign-in error messaging (1 hour)
  [ ] Test: Rate limiting with multiple IPs

Day 3:
  [ ] Integration test all 4 fixes
  [ ] Deploy to staging
  [ ] Manual QA
```

### Week 2: High-Impact Fixes (4)
**Effort:** 2-3 developer days | **UX Improvement:** Medium

```
Day 1:
  [ ] Fix #6: Sync rate limit timeouts (30 min)
  [ ] Fix #5: Form persistence to localStorage (1 hour)

Day 2:
  [ ] Fix #7: Improve password strength UI (2 hours)
  [ ] Fix #10: Add loading state feedback (1 hour)

Day 3:
  [ ] Fix #8: Step 2 error logging to Sentry (30 min)
  [ ] Integration test
  [ ] Deploy to staging
```

### Week 3: Polish & Edge Cases (7)
**Effort:** 2 developer days | **UX Polish:** Medium

```
Day 1:
  [ ] Fix #9: Email normalization (30 min)
  [ ] Fix #11: Add password reset links (30 min)
  [ ] Fix #12: Mobile error responsiveness (1 hour)

Day 2:
  [ ] Fix #13: Add accessibility attributes (1 hour)
  [ ] Fix #15: Add success message (30 min)
  [ ] Fix #14: Test with password managers (30 min)
  [ ] Final integration test
  [ ] Deploy to production
```

---

## Testing Checklist

### Happy Path ✅
```
□ Fill form → Click submit → Create account → Sign in → Dashboard
```

### Error Scenarios 🔴
```
Network:
  □ Network down during submit → See "Network error" (not "Unexpected")
  □ Network timeout (>10s) → See clear timeout message
  □ Network recovers mid-request → Retry works

Rate Limiting:
  □ 6 signup attempts → Locked for 60s (not 15 min)
  □ 429 response from backend → Shows "Retry in X minutes"
  □ Shared IP (office WiFi) → Only strict limit (5 per email/hour)

Duplicate Email:
  □ Try existing email → See "Already have account"
  □ Click "Sign In" button → Go to /login with email prefilled
  □ Click "Reset Password" button → Go to /forgot-password with email prefilled

Session Failures:
  □ Account created, sign-in fails → See "Account created! Signing in..."
  □ After 2s → Redirect to /login with email prefilled
```

### Mobile Testing 📱
```
Device: iPhone 12 (390px width)
□ Error messages not cut off
□ Password strength checklist visible
□ Form fits without horizontal scroll
□ Loading indicator centered
□ All buttons tappable (44px+ height)

Device: Android (360px width)
□ Same as iPhone tests
```

### Accessibility Testing ♿
```
Screen Reader (VoiceOver on Mac):
  □ Error message announced immediately
  □ Form labels associated with inputs
  □ Tab order logical (top to bottom)
  □ Focus visible on all interactive elements

Keyboard-only:
  □ Can fill entire form with keyboard
  □ Can submit form with Enter key
  □ Focus moves predictably
```

---

## Success Metrics

**Track these after deployment:**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Sign-up error rate | <2% | Sentry dashboard |
| Form retry rate | <1 per 10 signups | Analytics |
| Mobile completion | >85% | Google Analytics |
| Avg signup time | <5 min | Timestamps in logs |
| Rate limit false positives | <5/week | IP whitelist queries |
| Error message clarity | 80% one-read understanding | User testing survey |

---

## Risk Assessment

### Low Risk ✅
- All changes backward compatible
- No database schema changes
- No new npm dependencies
- Can revert with git checkout

### Testing Coverage
- Unit tests: Not required (mostly form logic)
- Integration tests: Manual testing sufficient
- E2E tests: Consider for critical paths (network, rate limit, 409)

### Monitoring
After deployment, watch for:
- 📊 Error rates spike (sign Sentry dashboard)
- 🚨 Rate-limiting complaints (check support tickets)
- 🔴 JavaScript errors (Sentry alerts)
- 📱 Mobile complaints (analytics + support)

---

## Code Files to Modify

| File | Fixes | Lines | Status |
|------|-------|-------|--------|
| `src/app/(auth)/sign-up/page.tsx` | #1,2,4,5,6,7,8,9,10,11,12,15 | ~450 | Frontend |
| `src/app/api/auth/signup/route.ts` | #1,3,4 | ~80 | Backend API |
| `src/hooks/useAuthRateLimit.ts` | #6 | ~85 | Hook |

---

## Cost-Benefit Analysis

| Fix | Effort | Benefit | Ratio | Priority |
|-----|--------|---------|-------|----------|
| #1 Network timeout | Low | Critical | ⭐⭐⭐ | P0 |
| #3 Email rate limiting | Medium | Critical | ⭐⭐⭐ | P0 |
| #2 Step 2 failure | Medium | High | ⭐⭐ | P1 |
| #4 409 error UX | Low | High | ⭐⭐ | P1 |
| #7 Password strength | Low | Medium | ⭐ | P2 |
| #6 Timeout sync | Low | Medium | ⭐ | P2 |
| #8 Sign-in logging | Medium | Low | ○ | P3 |
| #5 Form persistence | Low | Low | ○ | P3 |
| #9-15 Polish/a11y | Low | Low | ○ | P3 |

---

## Dependency Check

✅ **No new dependencies needed**
- Uses built-in Fetch API
- Uses built-in localStorage
- Uses existing Supabase client
- Uses existing Sentry integration (already set up)

---

## Backward Compatibility

✅ **100% backward compatible**
- All changes are additive
- No breaking API changes
- No schema migrations needed
- Users on old client version won't break

---

## Rollback Plan

If issues arise:
```bash
# Complete rollback to previous version
git revert HEAD

# Or selective rollback of specific file
git checkout HEAD~1 -- src/app/(auth)/sign-up/page.tsx

# Restart the server
npm run dev
```

**Estimated rollback time:** <5 minutes

---

## Questions to Answer Before Implementation

1. **Sentry Integration:** Is Sentry already set up? (For error logging)
   - Status: Check in `src/lib/sentry.ts` or package.json

2. **Rate Limiting Backend:** Is email-based rate limiting acceptable?
   - Consider: GDPR implications (storing email x timestamp)
   - Current: IP-based only (coarse but no PII)

3. **Redirect On Success:** Should we show success message?
   - Current: Redirects immediately
   - Proposed: Show for 2 seconds
   - Risk: Users might close tab during redirect

4. **Form Persistence:** Is localStorage safe for email?
   - Current: None (form clears on refresh)
   - Proposed: Save firstName, lastName, email (not password)
   - Risk: Low (no sensitive data)

5. **Password Reset Integration:** Does `/forgot-password` route exist?
   - Status: Verify existence before adding links

---

## Sign-Off Checklist

Before deploying to production:

- [ ] All 4 critical fixes implemented & tested
- [ ] No new npm dependencies added
- [ ] No database migrations needed
- [ ] Sentry integration verified (if adding logs)
- [ ] Mobile testing completed (iOS + Android)
- [ ] Accessibility testing completed (screen reader)
- [ ] Rate limiting tested with multiple IPs
- [ ] Error scenarios tested (network, 409, 429, 500)
- [ ] Staging deployment successful
- [ ] Monitoring alerts configured
- [ ] Team notified of changes
- [ ] Rollback plan ready
- [ ] Performance impact assessed (<10ms added latency)

---

## Post-Deployment

**Week 1 Monitoring:**
- Daily: Check Sentry for new errors
- Daily: Monitor error rate in analytics
- Daily: Check support tickets for auth issues
- Weekly: Review rate-limiting stats

**Month 1 Analysis:**
- User completion rates (target: >85% on mobile)
- Error rate (target: <2%)
- Average signup time (target: <5 min)
- No unexpected side effects

**Quarter 1 Review:**
- Consider advanced features (SSO, MFA)
- Gather user feedback on password strength requirements
- Analyze failed signup patterns
- Plan next-phase improvements

---

## Contact & Support

**Questions during implementation:**
- Review `SIGNUP_FAILURE_MODES_AUDIT.md` for detailed explanation of each fix
- Check `SIGNUP_FAILURE_MODES_FIXES.md` for copy-paste code examples

**Deployed & need to debug?**
- Check Sentry dashboard for error patterns
- Run `npm run test:auth` for integration tests
- Check browser DevTools Network tab for response codes

**Found a new failure mode?**
- Document in GitHub issue with steps to reproduce
- Check if covered by existing fixes
- Plan as enhancement for next sprint

---

## Document Links

1. **SIGNUP_FAILURE_MODES_AUDIT.md** — Full analysis of all 15 failure modes (detailed)
2. **SIGNUP_FAILURE_MODES_FIXES.md** — Copy-paste code for each fix (implementation)
3. **SIGNUP_AUDIT_QUICK_REFERENCE.md** — This document (at-a-glance checklist)

---

**Created:** February 25, 2026
**Last Updated:** February 25, 2026
**Status:** Ready for Implementation
