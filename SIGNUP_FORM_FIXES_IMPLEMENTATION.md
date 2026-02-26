# Voxanne AI Sign-Up Form: Implementation Guide for Fixes
**Date:** February 26, 2026
**Target:** Fix critical accessibility and recovery UX issues
**Estimated Effort:** 90 minutes total

---

## Fix #1: Add aria-live to Error Banner (CRITICAL)
**Impact:** Screen readers now announce errors automatically
**WCAG:** 4.1.3 Status Messages (AA)
**Time:** 5 minutes

### Current Code (Lines 164-168)
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
    {error}
  </div>
)}
```

### Fixed Code
```tsx
{error && (
  <div
    role="alert"
    aria-live="assertive"
    className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6"
  >
    {error}
  </div>
)}
```

### What Changed
- Added `role="alert"` — tells screen reader this is an alert
- Added `aria-live="assertive"` — announces immediately (not polite)

### Testing
```
With NVDA (Windows screen reader):
1. Fill form with weak password
2. Submit
3. Expected: "Alert: Password is too weak — use 8+ characters..."
4. (Currently: no announcement)

With JAWS (Windows screen reader):
1. Same as NVDA
2. Expected: Immediate announcement of error

With VoiceOver (Mac):
1. Same flow
2. Expected: "Alert, Password is too weak..."
```

### Browser Compatibility
- ✅ Chrome 86+
- ✅ Firefox 55+
- ✅ Safari 10.1+
- ✅ Edge 79+
- ⚠️ IE11: Not supported (expected)

---

## Fix #2: Add aria-label to Password Toggle (CRITICAL)
**Impact:** Screen readers understand what the button does
**WCAG:** 4.1.2 Name, Role, Value (A)
**Time:** 5 minutes

### Current Code (Lines 265-272)
```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian/40 hover:text-obsidian/60 transition-colors"
  disabled={loading}
>
  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
```

### Fixed Code
```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  aria-label={showPassword ? "Hide password" : "Show password"}
  aria-pressed={showPassword}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian/40 hover:text-obsidian/60 transition-colors"
  disabled={loading}
>
  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
```

### What Changed
- Added `aria-label="Show password"` — tells screen reader button's purpose
- Added `aria-pressed={showPassword}` — indicates toggle state (pressed/not pressed)

### Testing
```
With NVDA:
1. Tab to password field
2. Tab to password toggle button
3. Expected: "Toggle button, Show password, not pressed"
4. (After clicking) "Toggle button, Hide password, pressed"

With VoiceOver:
1. Same flow
2. Expected: "Show password, toggle button"
3. (After clicking) "Hide password, toggle button, selected"
```

### Visual Feedback Addition (Optional)
While we're here, add a focus ring to make the button more discoverable:

```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  aria-label={showPassword ? "Hide password" : "Show password"}
  aria-pressed={showPassword}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian/40 hover:text-obsidian/60 focus:text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-600/30 rounded-md transition-colors p-1"
  disabled={loading}
>
  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
```

---

## Fix #3: Show Rate Limit in Error Banner (CRITICAL)
**Impact:** Users see lockout reason in error area, not just button
**UX:** Better on mobile (error visible before fold)
**Time:** 10 minutes

### Current Code (Lines 164-168)
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
    {error}
  </div>
)}
```

### Issue
Rate limit is shown in button (line 308-309), but error banner is empty when locked out:
```tsx
: lockedOut ? (
  `Too many attempts — retry in ${timerLabel}`  // ← Only shown here
) : (
```

### Fixed Code
Replace error banner section (lines 164-168) with:

```tsx
{(error || lockedOut) && (
  <div
    role="alert"
    aria-live="assertive"
    className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6"
  >
    {lockedOut ? (
      <div className="space-y-2">
        <p className="font-medium">Too many attempts</p>
        <p className="text-sm">Please try again in {timerLabel}.</p>
        <div className="pt-2 space-y-1 text-xs">
          <p>
            💡 You can{' '}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="underline font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              try Google sign-up
            </button>
            {' '}while you wait.
          </p>
          <p>
            <Link
              href="mailto:support@voxanne.ai?subject=Locked out of signup"
              className="underline font-medium text-red-600 hover:text-red-700"
            >
              Contact support →
            </Link>
          </p>
        </div>
      </div>
    ) : (
      error
    )}
  </div>
)}
```

### What Changed
- Added rate limit error to banner (not just button)
- Added "Try Google sign-up" option (not disabled during lockout)
- Added "Contact support" link with pre-filled subject
- Better visual hierarchy with font weights

### Testing Checklist
```
Mobile (375px):
[ ] Error banner appears
[ ] "Too many attempts" visible (not below fold)
[ ] Timer visible: "14:56"
[ ] "Try Google sign-up" button visible
[ ] "Contact support" link visible
[ ] No text overflow

Desktop:
[ ] Same as mobile
[ ] Error banner doesn't push form down excessively
[ ] Timer updates every second

Accessibility:
[ ] NVDA announces: "Alert: Too many attempts. Please try again in..."
[ ] VoiceOver announces same
[ ] Tab order: can tab to "Try Google" and "Contact support"
[ ] Links work (Google redirects, email opens)
```

---

## Fix #4: Add "Sign In Instead" Link to Duplicate Email (HIGH)
**Impact:** Users don't have to scroll down to find sign-in link
**Conversion:** May prevent ~5-10% form abandonment
**Time:** 10 minutes

### Current Code (Lines 75-82)
```tsx
if (!res.ok) {
  if (res.status === 409) {
    // Tailor the message if the account was created via a social provider.
    const providers = result.provider ?? [];
    if (providers.includes('google')) {
      setError('This email is linked to a Google account. Use "Continue with Google" to sign in.');
    } else {
      setError('An account with this email already exists. Please sign in instead.');
    }
  } else {
```

### Problem
Error message mentions "Please sign in instead" but there's no clickable link.
User must scroll down to find the "Sign In" link at line 325.

### Fixed Code
```tsx
if (!res.ok) {
  if (res.status === 409) {
    const providers = result.provider ?? [];
    if (providers.includes('google')) {
      setError(
        <>
          This email is linked to a Google account.{' '}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="underline font-medium text-red-600 hover:text-red-700"
          >
            Sign in with Google →
          </button>
        </>
      );
    } else {
      setError(
        <>
          An account with this email already exists.{' '}
          <Link
            href={`/login?email=${encodeURIComponent(email)}`}
            className="underline font-medium text-red-600 hover:text-red-700"
          >
            Sign in instead →
          </Link>
        </>
      );
    }
  } else {
```

### What Changed
- Duplicate email + Google: Button in error that triggers Google OAuth immediately
- Duplicate email + email: Link in error that goes to login with email pre-filled
- Both options visible without scrolling

### Required Change to `/src/app/login/page.tsx`
Support email pre-fill via query parameter:

```tsx
function LoginContent() {
  const [email, setEmail] = useState(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return params.get('email') || '';
  });
  const [password, setPassword] = useState("");
  // ... rest of component
```

### Testing Checklist
```
Desktop:
[ ] Duplicate email error shows with "Sign in instead →" link
[ ] Link is red and underlined
[ ] Clicking link goes to /login
[ ] Email field on login is pre-filled
[ ] User can immediately sign in

Mobile:
[ ] Same as desktop
[ ] Link text doesn't wrap awkwardly
[ ] Clickable area sufficient (24px minimum)

Google OAuth:
[ ] Error shows with "Sign in with Google →" button
[ ] Button matches styling of "Sign in instead →" link
[ ] Clicking triggers Google OAuth immediately
[ ] No scroll needed to see button
```

---

## Fix #5: Add aria-invalid to Form Fields (HIGH)
**Impact:** Screen readers know which field caused error
**WCAG:** 3.3.1 Error Identification (AA)
**Time:** 15 minutes

### Current Code
Form fields (lines 210-248) have no error indication:

```tsx
<Input
  id="email"
  type="email"
  placeholder="you@clinic.com"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
  disabled={loading}
/>
```

### Problem
When error shows "Password is too weak", user doesn't know which field is invalid.
Screen reader user: No announcement of which field has error.

### Fixed Code - Step 1: Create Helper Function
Add at the top of the component (after imports):

```tsx
// Determine which field caused the error
const getErrorFieldType = (error: string | null): 'password' | 'email' | 'name' | null => {
  if (!error) return null;
  if (error.toLowerCase().includes('password')) return 'password';
  if (error.toLowerCase().includes('email')) return 'email';
  if (error.toLowerCase().includes('name')) return 'name';
  return null;
};

const errorField = getErrorFieldType(error);
```

### Fixed Code - Step 2: Update Form Fields
Update each field with `aria-invalid` and `aria-describedby`:

```tsx
{/* Email field */}
<div className="space-y-1.5">
  <label htmlFor="email" className="text-sm font-medium text-obsidian">
    Work email
  </label>
  <Input
    id="email"
    type="email"
    placeholder="you@clinic.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    aria-invalid={errorField === 'email'}
    aria-describedby={errorField === 'email' ? 'error-message' : undefined}
    className={errorField === 'email' ? 'border-red-500 ring-2 ring-red-200' : ''}
    required
    disabled={loading}
  />
</div>

{/* Password field */}
<div className="space-y-1.5">
  <label htmlFor="password" className="text-sm font-medium text-obsidian">
    Password
  </label>
  <div className="relative">
    <Input
      id="password"
      type={showPassword ? 'text' : 'password'}
      placeholder="At least 8 characters"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      aria-invalid={errorField === 'password'}
      aria-describedby={errorField === 'password' ? 'error-message' : undefined}
      className={errorField === 'password' ? 'border-red-500 ring-2 ring-red-200' : ''}
      required
      disabled={loading}
    />
    {/* toggle button ... */}
  </div>
  {/* strength meter ... */}
</div>
```

### Fixed Code - Step 3: Update Error Banner
Add `id="error-message"` to error banner:

```tsx
{(error || lockedOut) && (
  <div
    id="error-message"
    role="alert"
    aria-live="assertive"
    className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6"
  >
    {/* ... error content ... */}
  </div>
)}
```

### Testing Checklist
```
Accessibility - NVDA:
[ ] Fill password "abc"
[ ] Submit
[ ] NVDA announces: "Password field, invalid, has error message: Password is too weak..."
[ ] Password field focused automatically (or user can tab to it)
[ ] aria-invalid="true" is spoken

Accessibility - VoiceOver:
[ ] Same flow
[ ] VoiceOver announces: "Password, text field, invalid, Password is too weak..."

Visual - Desktop:
[ ] Invalid field has red border
[ ] Invalid field has red ring (2px)
[ ] Error banner still shows above form
[ ] Text remains readable with red ring

Visual - Mobile:
[ ] Red border/ring visible
[ ] No layout shift
[ ] Touch targets still ≥ 44px
```

---

## Fix #6: Add Error Icon to Banner (MEDIUM)
**Impact:** Errors scan faster (icon draws attention)
**Time:** 10 minutes

### Current Code (Lines 164-168)
```tsx
<div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
  {error}
</div>
```

### Fixed Code
```tsx
<div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
  <div className="flex gap-3">
    <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
    <div>
      {error}
    </div>
  </div>
</div>
```

### Required Import
Add to top of file:
```tsx
import { AlertCircle } from 'lucide-react'; // Already imported
```

### Why This Works
1. Icon draws eye immediately (before reading text)
2. Colorblind users see icon in addition to color
3. Scans like professional SaaS (Stripe, Vercel, GitHub)
4. No layout impact (flex with gap-3)

### Testing
```
Visual Scan:
[ ] Eye goes to icon first (visual hierarchy)
[ ] Icon color matches error text (red-600)
[ ] Icon doesn't cover text
[ ] Mobile wrapping works correctly

Accessibility:
[ ] NVDA ignores icon (aria-hidden by default)
[ ] Text content still read
[ ] No redundant announcements

Browser:
[ ] Chrome: Icon visible, proper alignment
[ ] Firefox: Same as Chrome
[ ] Safari: Same as Chrome
[ ] Mobile Safari: Same as Chrome
```

---

## Fix #7: Add Strength Meter ARIA progressbar (MEDIUM)
**Impact:** Screen readers understand strength progression
**Time:** 15 minutes

### Current Code (Lines 274-288)
```tsx
{strength && (
  <div className="mt-1.5 space-y-1">
    <div className="flex gap-1 h-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`flex-1 rounded-full transition-colors duration-200 ${
            strength.score >= i ? strength.color : 'bg-neutral-200'
          }`}
        />
      ))}
    </div>
    <p className="text-xs text-obsidian/50">{strength.label}</p>
  </div>
)}
```

### Problem
Sighted user: Sees 4 colored bars representing strength
Screen reader user: Hears "Weak", "Fair", "Strong", "Very strong" but no progression sense

### Fixed Code
```tsx
{strength && (
  <div className="mt-1.5 space-y-1">
    <div
      className="flex gap-1 h-1"
      role="progressbar"
      aria-valuenow={strength.score}
      aria-valuemin={1}
      aria-valuemax={4}
      aria-label="Password strength"
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`flex-1 rounded-full transition-colors duration-200 ${
            strength.score >= i ? strength.color : 'bg-neutral-200'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
    <p className="text-xs text-obsidian/50" aria-label={`Password strength: ${strength.label}`}>
      {strength.label}
    </p>
  </div>
)}
```

### What Changed
1. Outer div: `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax`
2. Individual bars: `aria-hidden="true"` (they're decorative)
3. Label: Updated with context

### Screen Reader Result
**Before:**
- NVDA: "Fair" (just the text)

**After:**
- NVDA: "Password strength, progress bar, 2 of 4"
- User understands: "This is a strength meter, currently 50% full"

### Testing
```
NVDA - Windows:
[ ] Tab to password field
[ ] Type "abc": "Weak, progress bar, 1 of 4"
[ ] Type "abcdef": "Fair, progress bar, 2 of 4"
[ ] Type "Abcdef123!": "Very strong, progress bar, 4 of 4"

VoiceOver - Mac:
[ ] Similar progression
[ ] Each keystroke updates announcement

Visual:
[ ] Bars fill from left to right
[ ] Colors change (red → amber → blue → green)
[ ] Text label updates
[ ] No layout shift
```

---

## Fix #8: Add Contact Support CTA (MEDIUM)
**Impact:** Users know how to get help when locked out
**Time:** 5 minutes

### Current Situation (after Fix #3)
```tsx
{lockedOut && (
  // Shows "Too many attempts" with "Try Google" button
)}
```

### To Add
Already included in Fix #3's implementation:
```tsx
<p>
  <Link
    href="mailto:support@voxanne.ai?subject=Locked out of signup"
    className="underline font-medium text-red-600 hover:text-red-700"
  >
    Contact support →
  </Link>
</p>
```

### What It Does
1. User clicks "Contact support"
2. Opens default email client with:
   - To: support@voxanne.ai
   - Subject: "Locked out of signup"
   - Body: (empty, user fills in)
3. User sends email
4. Support team responds with manual unlock

### Optional Enhancement: Add Form Context
```tsx
<Link
  href={`mailto:support@voxanne.ai?subject=Locked out of signup&body=Email: ${encodeURIComponent(email)}\n\nI'm locked out of the signup form. Please help me reset my account.`}
  className="underline font-medium text-red-600 hover:text-red-700"
>
  Contact support →
</Link>
```

---

## Fix #9: Form Shake Animation (NICE-TO-HAVE)
**Impact:** Users immediately notice errors
**Time:** 30 minutes
**Requires:** Framer Motion library

### Step 1: Install Framer Motion
```bash
npm install framer-motion
```

### Step 2: Import Motion Div
Add to imports:
```tsx
import { motion } from 'framer-motion';
```

### Step 3: Wrap Error Banner
Replace error banner div:

```tsx
{(error || lockedOut) && (
  <motion.div
    animate={error || lockedOut ? { x: [-10, 10, -5, 0] } : {}}
    transition={{ duration: 0.3 }}
    role="alert"
    aria-live="assertive"
    id="error-message"
    className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6"
  >
    {/* error content */}
  </motion.div>
)}
```

### Testing
```
Visual:
[ ] Form appears normal initially
[ ] On error: banner shakes 3 times (left, right, center)
[ ] Shake duration: ~300ms (not too fast/slow)
[ ] Feels natural, not jarring
[ ] Test with multiple errors (same bounce)

Mobile:
[ ] Shake is visible on mobile
[ ] Doesn't cause layout jank
[ ] Improves visibility (good for mobile where errors might be missed)

Accessibility:
[ ] Motion respects prefers-reduced-motion
  - Add: transition={{ duration: 0.3, ...(prefersReducedMotion && { duration: 0 }) }}
[ ] Screen readers: No change (aria-live still works)
```

---

## Fix #10: Email Persistence (NICE-TO-HAVE)
**Impact:** Users don't retype email if form fails
**Time:** 20 minutes

### Step 1: Update Initial State
Replace line 35:
```tsx
const [email, setEmail] = useState('');
```

With:
```tsx
const [email, setEmail] = useState(() => {
  if (typeof window === 'undefined') return ''; // SSR safety
  try {
    return localStorage.getItem('signup_email_draft') || '';
  } catch {
    return ''; // localStorage unavailable (private browsing)
  }
});
```

### Step 2: Add Effect to Save Email
Add after useState declarations (around line 42):

```tsx
useEffect(() => {
  try {
    if (email) {
      localStorage.setItem('signup_email_draft', email);
    } else {
      localStorage.removeItem('signup_email_draft');
    }
  } catch {
    // localStorage unavailable (private browsing)
  }
}, [email]);
```

### Step 3: Clear on Success
After signup success (around line 107):

```tsx
reset(); // Clear rate-limit counter on success
localStorage.removeItem('signup_email_draft'); // Also clear email draft
router.push('/dashboard/onboarding');
```

### Testing
```
User Journey:
1. User enters "jane@example.com"
2. User enters weak password
3. Submit fails, error shown
4. User refreshes page (F5)
5. Expected: Email field still contains "jane@example.com"
6. User improves password
7. Submit succeeds
8. Expected: Email cleared from localStorage

Edge Cases:
[ ] Private browsing mode: No error (graceful degradation)
[ ] localStorage quota exceeded: No error
[ ] User manually clears email: localStorage updated
[ ] User signs up successfully: Email cleared
[ ] User navigates away: Email persisted (can return later)
```

---

## Fix #11: Improve Duplicate Email Recovery (BONUS)
**Impact:** Users with Google-linked email can sign in immediately
**Time:** 15 minutes

### Enhancement 1: Add "Try Google Now" Button in Error
When error shows "This email is linked to Google", add immediate action button:

```tsx
if (providers.includes('google')) {
  setError(
    <>
      This email is linked to a Google account.{' '}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        className="underline font-medium text-red-600 hover:text-red-700"
      >
        Try signing in with Google →
      </button>
    </>
  );
}
```

**Result:**
- Error appears
- User clicks "Try signing in with Google"
- Immediately redirects to Google OAuth
- No need to close form and find Google button

### Enhancement 2: Auto-Focus to Error for Screen Readers
Add focus management:

```tsx
useEffect(() => {
  if (error) {
    const errorBanner = document.getElementById('error-message');
    if (errorBanner) {
      errorBanner.focus(); // For screen reader users
    }
  }
}, [error]);
```

---

## Implementation Checklist

### Phase 1: CRITICAL (Do Today - 25 min)
- [ ] Fix #1: aria-live error banner (5 min)
- [ ] Fix #2: aria-label password toggle (5 min)
- [ ] Fix #3: Rate limit in error banner (10 min)
- [ ] Fix #4: Sign in link in error (5 min)
- **Test in browser**

### Phase 2: HIGH (Do This Week - 40 min)
- [ ] Fix #5: aria-invalid form fields (15 min)
- [ ] Fix #6: Error icons (10 min)
- [ ] Fix #7: Strength meter progressbar (15 min)
- **Test with screen reader (NVDA/VoiceOver)**

### Phase 3: MEDIUM (Do This Month - 35 min)
- [ ] Fix #8: Contact support link (5 min)
- [ ] Fix #9: Form shake animation (20 min)
- [ ] Fix #10: Email persistence (10 min)
- **User test with real users**

### Phase 4: NICE-TO-HAVE (Roadmap)
- [ ] Fix #11: Duplicate email recovery (15 min)
- [ ] Add field error styling (red borders)
- [ ] A/B test error messages
- [ ] User research on recovery flows

---

## Testing Checklist Per Fix

### Fix #1: aria-live
```
[ ] NVDA test (Windows)
  [ ] Error announced on first render
  [ ] "Alert:" prefix spoken
  [ ] Full message readable
[ ] JAWS test (Windows)
  [ ] Same as NVDA
[ ] VoiceOver test (Mac/iOS)
  [ ] Error announced
  [ ] "Alert" role spoken
[ ] Firefox
  [ ] Visual error still visible
  [ ] No broken styles
[ ] Safari
  [ ] Same as Firefox
```

### Fix #2: aria-label
```
[ ] Can tab to password toggle
[ ] NVDA announces "Show password" or "Hide password"
[ ] JAWS announces same
[ ] VoiceOver announces action
[ ] aria-pressed state changes (pressed/not pressed)
[ ] Icon updates visually
[ ] Button doesn't get focus ring cut off
```

### Fix #3: Rate Limit Error
```
[ ] When locked out, error banner shows (not just button)
[ ] Timer counts down (14:56 → 14:55 → ...)
[ ] "Try Google sign-up" button visible
[ ] "Contact support" link visible
[ ] All text visible on 375px mobile
[ ] Error announced to screen reader
```

### Fix #4: Sign In Link
```
[ ] Duplicate email error shows link
[ ] Link is underlined (ClickableHint)
[ ] Clicking goes to /login
[ ] Email pre-filled on login page
[ ] Google OAuth version also has button
[ ] Works on mobile (touch target ≥ 44px)
```

### Fix #5: aria-invalid
```
[ ] Invalid field has red border + ring
[ ] aria-invalid="true" set on invalid field
[ ] aria-describedby points to error message
[ ] NVDA announces "invalid"
[ ] VoiceOver announces "invalid"
[ ] Incorrect field highlighted (not all fields)
[ ] Visual doesn't break layout
```

### Fix #6: Error Icons
```
[ ] AlertCircle icon visible
[ ] Icon red (matches text color)
[ ] Icon doesn't cover text
[ ] Icon right-aligned (flex gap)
[ ] Mobile text wrapping still works
[ ] Icon accessible (aria-hidden)
```

### Fix #7: Strength Meter
```
[ ] role="progressbar" on meter
[ ] aria-valuenow updates (1-4)
[ ] NVDA announces "progress bar, X of 4"
[ ] VoiceOver announces strength
[ ] Updates on each keystroke
[ ] Visual bars still show
[ ] Colors still change
```

### Fix #8: Contact Support
```
[ ] Link visible when locked out
[ ] mailto: link works
[ ] Email client opens with pre-filled recipient
[ ] Subject line correct
[ ] User can customize email
[ ] Works on mobile (mail app opens)
```

### Fix #9: Form Shake
```
[ ] Animation smooth (no jank)
[ ] Completes in ~300ms
[ ] Shakes on error, not on success
[ ] Respects prefers-reduced-motion
[ ] Mobile performance good
[ ] Doesn't break layout
[ ] Doesn't cause scroll jumps
```

### Fix #10: Email Persistence
```
[ ] Email remembered across page refresh
[ ] Email cleared on successful signup
[ ] Works in private browsing (graceful failure)
[ ] localStorage quota exceeded handled
[ ] User can manually clear field
[ ] Field updates localStorage in real-time
```

---

## Common Mistakes to Avoid

### ❌ Don't
- Remove `className` attributes
- Change `role="alert"` to `role="status"` (wrong for errors)
- Use `aria-live="polite"` (should be "assertive" for errors)
- Forget to set `id="error-message"` on banner
- Set `aria-invalid="false"` (use `false` or omit, not string "false")

### ✅ Do
- Keep existing classes when adding ARIA attributes
- Add both `role="alert"` AND `aria-live="assertive"`
- Test with actual screen readers (not just code review)
- Set `aria-describedby` on inputs AND add matching `id` to error
- Set `aria-invalid={true/false}` with boolean, not string

---

## Deployment Strategy

### Before Merging to Main
1. **Code Review:**
   - [ ] Peer review all ARIA additions
   - [ ] Check for typos in `aria-*` attributes
   - [ ] Verify `id` attributes are unique

2. **Automated Testing:**
   - [ ] Run TypeScript compiler (catch type errors)
   - [ ] Run prettier (code formatting)
   - [ ] Run ESLint (accessibility warnings)

3. **Manual Testing:**
   - [ ] Test in Chrome, Firefox, Safari
   - [ ] Test on mobile (iOS, Android)
   - [ ] Test with NVDA (Windows screen reader)
   - [ ] Test with keyboard only (Tab, Enter, Space)

### After Merging
1. **Monitor in Production:**
   - [ ] Watch error logs for increased errors
   - [ ] Monitor signup completion rate
   - [ ] A/B test error message effectiveness

2. **Gather Feedback:**
   - [ ] User interviews (5-10 users)
   - [ ] Heatmaps of error clicks
   - [ ] Support ticket analysis

3. **Iterate:**
   - [ ] Double-click on high-impact issues
   - [ ] Repeat testing after changes

---

## Version Control Notes

### Commit Message Format
```
feat: Improve signup form accessibility and error recovery

CRITICAL:
- Add aria-live to error banner for screen reader announcements
- Add aria-label to password toggle button
- Show rate limit message in error banner (not just button)
- Add "Sign in instead" link to duplicate email error

HIGH:
- Add aria-invalid to form fields with errors
- Add error icons to error banner
- Add password strength ARIA progressbar

MEDIUM:
- Add "Contact support" link when locked out
- Add form shake animation on error
- Add email persistence to localStorage

Tests:
- Verified with NVDA screen reader
- Tested on Chrome, Firefox, Safari
- Mobile tested on iOS and Android
- All ARIA attributes validated

Closes: #[issue-number] (if applicable)
```

### Git Workflow
```bash
# Create feature branch
git checkout -b fix/signup-accessibility

# Make changes to /src/app/(auth)/sign-up/page.tsx
# Make changes to /src/app/login/page.tsx (for email pre-fill)

# Test locally
npm run dev
# Test in browser and with screen reader

# Commit
git add src/
git commit -m "feat: Improve signup form accessibility..."

# Push and create PR
git push origin fix/signup-accessibility
```

---

**Total Implementation Time:** ~90 minutes
**Testing Time:** ~30 minutes
**Total:** ~120 minutes (2 hours)

**Priority:** Start with Phase 1 (CRITICAL) this week for accessibility compliance.
