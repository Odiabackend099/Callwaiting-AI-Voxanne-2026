# Voxanne AI Sign-Up Form: Testing & QA Guide
**Date:** February 26, 2026
**Scope:** Comprehensive testing for mobile, accessibility, and error recovery
**Estimated Time:** 4-6 hours for thorough testing

---

## Part 1: Mobile Testing (iOS & Android)

### Test Device Setup

#### iOS Testing
**Recommended Device:** iPhone 12/13 (375px width) or use Safari DevTools
**Browser Versions:**
- Safari 15.4+
- Chrome 86+

**Enable Accessibility Inspect:**
1. Settings → Accessibility → Spoken Content (VoiceOver)
2. Settings → Accessibility → Captions + SDH
3. Settings → Accessibility → Reduce Motion (if testing animation)

#### Android Testing
**Recommended Device:** Pixel 4a (390px width) or Android emulator
**Browser Versions:**
- Chrome 86+
- Firefox 86+
- Samsung Internet 14+

**Enable Accessibility:**
1. Settings → Accessibility → TalkBack (screen reader)
2. Settings → Accessibility → Captions
3. Settings → Accessibility → Remove animations

---

### Mobile Viewport Tests

#### Test 1: Layout at 375px (iPhone SE width)

**Setup:**
1. Open Chrome DevTools (F12 or Cmd+Opt+I)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Set to "iPhone SE" or manually set 375x667

**Checklist:**
```
Form Layout:
[ ] Logo centered or left-aligned (check overflow)
[ ] "Back to Home" link visible in top right
[ ] Form title fits in one line
[ ] Form subtitle wraps correctly (no text cut off)

Error Banner:
[ ] Error message visible above form
[ ] Red banner spans full width (minus padding)
[ ] Error text wraps nicely (not clipped)
[ ] Multiple-line errors (e.g., Google OAuth) don't overflow

Form Fields:
[ ] Each field takes full width (minus padding)
[ ] First/Last name side-by-side layout (check gap)
[ ] Labels visible above fields
[ ] Placeholder text visible
[ ] Input height: 40px minimum

Password Strength Meter:
[ ] 4 bars visible side-by-side
[ ] "Very strong" label readable
[ ] Meter updates on typing

Buttons:
[ ] Google OAuth button: Full width, text visible
[ ] Divider line: Centered with text
[ ] Create Account button: Full width, text visible
[ ] Submit button height: 48px (≥ 44px touch target)

Bottom Text:
[ ] Terms and Privacy links visible
[ ] "Already have account? Sign In" visible
[ ] All links clickable (no wrapping issues)

Scroll Behavior:
[ ] No horizontal scroll needed
[ ] Form scrolls vertically smoothly
[ ] Keyboard doesn't hide submit button
```

**Example Layout Diagram (375px):**
```
┌─────────────────────────────┐
│ [Logo]    [Back to Home]    │ h:auto
├─────────────────────────────┤
│ Create your account         │ p:8px
│ Get your AI receptionist..  │
│                             │
│ [Error banner if present]   │ mb:6
│                             │
│ [Google OAuth Button]       │ mb:4 h:48px
│                             │
│ or sign up with email       │ my:5
│                             │
│ [First Name] [Last Name]    │ gap:3 h:40px each
│ [Email]                     │ h:40px
│ [Password + Show/Hide]      │ h:40px
│ [Strength bars]             │ h:1px
│                             │
│ [Create Account Button]     │ h:48px
│ "Creating Account..." or    │
│ "Too many attempts..."      │
│                             │
│ By creating an account...   │ text:xs
│ Already have account?       │ text:sm
│                             │
│ (padding-bottom for scroll) │
└─────────────────────────────┘
```

---

#### Test 2: Landscape Orientation (375x667 → 667x375)

**Setup:**
1. Device Toolbar → Rotate phone (or Cmd+Opt+U)
2. Width: 667px, Height: 375px

**Checklist:**
```
Layout Changes:
[ ] Form still fits without horizontal scroll
[ ] Grid layout adjusts gracefully
[ ] Buttons don't become tiny
[ ] Error message still visible

Form Fields:
[ ] First/Last name side-by-side fits
[ ] Email field full width
[ ] Password field full width
[ ] Labels still visible

Keyboard Interaction:
[ ] Virtual keyboard pops up
[ ] Submit button stays clickable
[ ] Form scrolls up (doesn't hide button)
[ ] Can still access all fields

Accessibility:
[ ] Focus ring still visible after keyboard pops
[ ] Can tab through all elements in order
[ ] No elements hidden by keyboard
```

---

#### Test 3: Large Mobile (iPhone Max - 430px)

**Setup:**
1. Device Toolbar → iPhone 14 Pro Max (430x932)

**Checklist:**
```
Additional Width:
[ ] Buttons don't become oversized
[ ] Form maintains visual hierarchy
[ ] No extraneous white space
[ ] Text doesn't get uncomfortably long

Font Sizes:
[ ] Labels: 14px (readable at arm's length)
[ ] Input text: 16px (no iOS zoom-on-focus)
[ ] Button text: 16px semibold (visible from distance)

Spacing:
[ ] Padding feels appropriate (not too cramped)
[ ] Gap between form sections clear
[ ] Bottom padding allows scroll room
```

---

#### Test 4: Touch Target Sizes

**Standard:** All interactive elements ≥ 44x44px

**Checklist:**
```
Buttons:
[ ] Google OAuth: h-12 (48px) - PASS ✅
[ ] Create Account: h-12 (48px) - PASS ✅
[ ] Password show/hide: Verify hit area
    - Button itself: 20px icon + padding
    - With padding: Should be 40-48px - CHECK

Links:
[ ] "Back to Home": min 44x44px - CHECK
[ ] "Sign In": embedded in text, hard to tap - FLAG ⚠️
[ ] "Terms", "Privacy": embedded in text - FLAG ⚠️
[ ] Solution: Increase line-height or padding

Form Fields:
[ ] Input height: 40px (< 44px minimum) - FLAG ⚠️
[ ] With padding (py-2): Total ~44px - CHECK

Recommendations:
[ ] Increase input height to h-12 (48px)
[ ] Wrap embedded links in larger touch targets
[ ] Increase password toggle hit area with padding
```

---

### Mobile Error Scenarios

#### Scenario A: Weak Password Error (Mobile)

**Steps:**
1. Fill form: Jane Smith, jane@clinic.com, "password123"
2. Submit
3. Error appears

**Expected Mobile UX:**
```
┌──────────────────────────────┐
│ [Logo]  [Back]               │
├──────────────────────────────┤
│ Create your account          │
│                              │
│ [Error banner visible]       │ ← CRITICAL: Must be visible
│ ⚠️ Password is too weak...   │
│                              │
│ [Google OAuth Button]        │
│ or sign up with email        │
│                              │
│ [First Name]  [Last Name]    │
│ jane          smith          │ ← Fields retained
│ [Email]                      │
│ jane@clinic.com              │
│ [Password]                   │
│ password123                  │ ← Password still visible (masked)
│ [Strength: Fair - blue]      │
│                              │
│ [Create Account Button]      │
│ (button remains disabled     │
│  until password strength ≥2) │
└──────────────────────────────┘
```

**Test Points:**
- [ ] Error banner visible without scrolling up
- [ ] Form fields retained (not cleared)
- [ ] Password visible as dots/asterisks
- [ ] Can edit password and re-submit
- [ ] Strength meter updates in real-time
- [ ] Button re-enables when strength sufficient

---

#### Scenario B: Rate Limit Lock (Mobile)

**Steps:**
1. Fill form with valid data
2. Submit 5 times with intentional failures
3. 5th failure: Rate limit triggered

**Expected Mobile UX (After Fix #3):**
```
┌──────────────────────────────┐
│ [Logo]  [Back]               │
├──────────────────────────────┤
│ Create your account          │
│                              │
│ [Error banner]               │
│ 🔴 Too many attempts         │
│ Please try again in 14:56    │
│                              │
│ 💡 You can try signing in    │
│    with Google instead       │
│ [blue underlined link]       │
│                              │
│ Contact support →            │
│ [link opens email]           │
│                              │
│ [Google OAuth Button]        │
│ or sign up with email        │
│                              │
│ [All form fields disabled]   │
│                              │
│ [Create Account Button]      │
│ Too many attempts — retry    │
│ in 14:56                     │
└──────────────────────────────┘
```

**Test Points:**
- [ ] Error message visible without scroll
- [ ] Timer visible in error AND button
- [ ] "Try Google" link not disabled (works)
- [ ] "Contact support" link opens email
- [ ] All form fields disabled (can't edit)
- [ ] Button shows "Too many attempts..." text
- [ ] Timer counts down every second
- [ ] Text doesn't wrap awkwardly

**Text Wrapping on 375px:**
- "Too many attempts — retry in 14:56" = ~38 chars
- Font: 16px semibold
- Available: 311px (375 - 64 padding)
- Expected width: ~180px
- Result: ✅ Fits on one line

---

#### Scenario C: Duplicate Email (Mobile)

**Steps:**
1. Enter email: existing@account.com
2. Submit
3. Error appears

**Expected Mobile UX (After Fix #4):**
```
┌──────────────────────────────┐
│ [Logo]  [Back]               │
├──────────────────────────────┤
│ Create your account          │
│                              │
│ [Error banner]               │
│ An account with this email   │
│ already exists.              │
│ [Sign in instead →] (link)   │ ← Embedded link
│                              │
│ [Google OAuth Button]        │
│ or sign up with email        │
│                              │
│ [Form fields visible]        │
│ (not disabled)               │
│                              │
│ [Create Account Button]      │
│ "Create Account →"           │
│ (re-enabled)                 │
└──────────────────────────────┘
```

**Test Points:**
- [ ] Error message visible without scroll
- [ ] "Sign in instead" is clickable link (not just text)
- [ ] Link goes to /login with email pre-filled
- [ ] Form fields NOT disabled (user can try different email)
- [ ] User can retry signup with different email
- [ ] Link color is visible (blue, underlined)
- [ ] Link works on mobile tap (44px+ touch target)

---

### Mobile Keyboard Testing

#### Test 5: Form Submission with Keyboard

**Setup:**
1. Mobile device or emulator
2. Open form

**Steps:**
1. Tap first name field (keyboard appears)
2. Type "Jane" → Tab to next field
3. Type "Smith" → Tab to next field
4. Type email → Tab to next field
5. Type password → Tab past show/hide button
6. Keyboard arrow down → Focus on submit button
7. Press Enter

**Expected Behavior:**
- [ ] Keyboard pops up appropriately
- [ ] Tab moves to next field in order
- [ ] Password field show/hide toggle skippable via tab
- [ ] Submit button receives focus
- [ ] Enter key submits form
- [ ] After submit, keyboard dismisses

**Problem Areas:**
- [ ] iOS may auto-capitalize in password field (bad UX)
  - Fix: `<input autoCapitalize="off" />`
- [ ] Android may suggest passwords (security concern)
  - Fix: `<input autoComplete="off" />` (but affects accessibility)
- [ ] Tab order may be unclear
  - Test: Is show/hide toggle tab-accessible?

---

#### Test 6: Virtual Keyboard Behavior

**Setup:** Mobile device, portrait orientation

**Scenario:** User fills form, keyboard opens

**Expected:**
```
Before keyboard:
[Logo]
[Form title]
[Error banner if any]
[Google button]
[Divider]
[Form fields]
[Submit button]  ← Visible

After tapping password field:
[Form fields above keyboard]
[Keyboard takes ~50% of screen]
[Submit button]  ← Scrolls up, might be hidden
```

**Test:**
- [ ] Can scroll form up while keyboard open
- [ ] Submit button accessible while keyboard open
- [ ] Form doesn't jump/shift when keyboard appears
- [ ] No layout jank or flashing

---

## Part 2: Accessibility Testing

### Screen Reader Testing

#### Setup: NVDA (Windows)

**Download:** https://www.nvaccess.org/download/
**Browser:** Firefox (best NVDA support)

**Startup:**
1. Download and install NVDA
2. Open NVDA (will read to you)
3. Open Firefox
4. Navigate to sign-up form
5. NVDA will announce: "Firefox window, document, [page title]"

**Testing Checklist:**

```
FORM LABELS:
[ ] NVDA announces each input with its label
  Expected: "First name, edit text, Jane" (after typing)
  Not expected: "Edit text" (label missing)

ERROR MESSAGES:
[ ] When error appears, NVDA immediately announces
  Expected: "Alert: Password is too weak..."
  Not expected: No announcement (aria-live missing)

PASSWORD TOGGLE:
[ ] Tab to toggle button
[ ] NVDA announces: "Show password, toggle button"
  (Currently: just "button" - no context)

STRENGTH METER:
[ ] Typing password updates strength
[ ] NVDA announces: "Password strength, progress bar, 2 of 4"
  (Currently: just "Fair" - no progression context)

LINKS:
[ ] Sign In link: "Sign In, link"
[ ] Terms link: "Terms of Service, link"
[ ] All links have clear purpose

BUTTONS:
[ ] Google OAuth: "Continue with Google, button"
[ ] Create Account: "Create Account, button"
[ ] Submit: "Creating Account..., button, busy" (during load)

FORM VALIDATION:
[ ] Submit with invalid password
[ ] NVDA announces error on password field
[ ] Expected: "Password, edit text, invalid, has error..."
```

---

#### Setup: JAWS (Windows)

**Download:** https://www.freedomscientific.com/products/software/jaws/
**Browser:** Chrome or Firefox

**Startup:**
1. Install JAWS
2. Open JAWS
3. Open Chrome
4. Navigate to sign-up form

**Testing:**
- Similar to NVDA
- JAWS is more verbose
- Pay attention to "required" fields
- Note pronunciation of technical terms

---

#### Setup: VoiceOver (Mac/iOS)

**Mac:**
1. System Preferences → Accessibility → VoiceOver
2. Enable VoiceOver (Cmd+F5)
3. Open Safari and navigate to form

**iOS:**
1. Settings → Accessibility → VoiceOver
2. Enable toggle
3. Open Safari and navigate to form

**Testing:**
- VO announces: "Heading, Create your account"
- VO announces: "First name, edit text, required"
- VO announces errors automatically (if aria-live set)
- VO announces button states ("pressed", "not pressed")

**Testing Checklist:**
```
Navigation:
[ ] Rotor (VO + U) shows form landmarks
[ ] Can navigate by headings
[ ] Can navigate by form controls
[ ] Tab order is logical (top to bottom, left to right)

Labels:
[ ] Each input associated with label
[ ] VO announces: "[Label], [input type], [state]"

Error Handling:
[ ] Error appears
[ ] VO announces immediately: "Alert: [error text]"
[ ] Focus moves to error (or user can find it)
[ ] Screen reader users understand what to fix

Image/Icon:
[ ] AlertCircle icon doesn't announce (aria-hidden)
[ ] Error text is read (not icon)
```

---

### Keyboard-Only Testing (No Mouse/Touch)

**Why:** 10% of users navigate via keyboard (power users, accessibility needs)

**Steps:**
1. Unplug mouse/disable trackpad
2. Use only Tab, Enter, Arrow keys, Space
3. Close all browser extensions (may interfere with tab)

**Checklist:**
```
Navigation:
[ ] Tab enters first form field (focus ring visible)
[ ] Tab moves through fields left-to-right, top-to-bottom
[ ] Tab order: First Name → Last Name → Email → Password → Toggle → Submit
[ ] Tab visible (focus ring on all elements)

Password Toggle:
[ ] Tab to password toggle
[ ] Focus ring visible
[ ] Space key toggles show/hide
[ ] Password visibility changes

Links:
[ ] Tab to link
[ ] Focus ring visible
[ ] Enter key activates link

Buttons:
[ ] Tab to button
[ ] Focus ring visible
[ ] Enter or Space activates button

Error Recovery:
[ ] Error appears
[ ] Focus automatically on error banner or related field
[ ] Can tab through recovery options (links, buttons)
[ ] Can close/dismiss error with Escape (if applicable)

Dropdowns (if any):
[ ] Can open with Arrow Down
[ ] Can navigate with Arrow Up/Down
[ ] Can select with Enter
[ ] Can close with Escape
```

---

### Color Contrast Testing

**Standard:** WCAG AA = 4.5:1 for normal text, 3:1 for large text

**Tools:** https://webaim.org/resources/contrastchecker/

**Test Points:**
```
Error Banner:
[ ] Red text (#dc2626) on red background (#fef2f2)
    Ratio: Should be ≥ 4.5:1 for 14px text
    Current: red-600 on red-50
    Calculation needed: Check actual hex values

Form Labels:
[ ] Dark gray (obsidian) on white
    Ratio: Should be ≥ 4.5:1
    Expected: ~15:1 (very good)

Placeholder Text:
[ ] Light gray (obsidian/40) on white
    Ratio: Should be ≥ 3:1 for larger text
    May fail for 14px text
    Recommendation: Increase opacity or use label + placeholder

Links:
[ ] Blue text (surgical-600) on white
    Ratio: Should be ≥ 4.5:1
    Expected: Good (blue is visible)

Buttons:
[ ] White text on blue (surgical-600)
    Ratio: Should be ≥ 4.5:1
    Expected: Very good (~10:1)

Disabled Elements:
[ ] Text with opacity-60
    Ratio: May fail WCAG AA
    Consider: Darker color OR higher opacity for disabled
```

**Action Items:**
- Run color contrast checker on live site
- Flag any failures
- Adjust colors or opacity accordingly

---

### Mobile Screen Reader Testing

#### iOS VoiceOver (iPhone)

**Setup:**
1. Settings → Accessibility → VoiceOver
2. Toggle ON
3. Safari or Chrome → sign-up form

**Gestures:**
- Swipe right: Next element
- Swipe left: Previous element
- Double tap: Activate element
- Two-finger swipe up: Read all
- Two-finger swipe down: Stop reading

**Testing:**
```
[ ] Swipe right through form fields
  Expected: Each field announced with label
[ ] Fields announced in order (no skipping)
[ ] Error banner announced when it appears
[ ] Submit button: Double-tap submits form
[ ] After submit: "Creating Account..." announced
[ ] Error message: Read automatically (aria-live)
```

#### Android TalkBack (Android)

**Setup:**
1. Settings → Accessibility → TalkBack
2. Toggle ON
3. Chrome or Firefox → sign-up form

**Gestures:**
- Swipe right: Next element
- Swipe left: Previous element
- Double tap: Activate
- Swipe down then right: Read all (continuous reading)

**Testing:** Same as iOS VoiceOver

---

## Part 3: Error Scenarios & Recovery

### Scenario 1: Weak Password

**Goal:** User learns password requirements clearly

**Steps:**
1. Fill form: Jane Smith, jane@clinic.com
2. Password: "password123" (score: 2 "Fair")
3. Click "Create Account"
4. Expected error: "Password is too weak..."
5. User fixes password: "P@ssw0rd123!" (score: 4 "Very strong")
6. Click "Create Account"
7. Expected: Success

**Verification:**
- [ ] Error message specific: Says "use 8+ characters, mix of..."
- [ ] Form retained: Email still there, password still there
- [ ] Strength meter updated: Shows "Very strong" (green, full bars)
- [ ] Submit button re-enabled: Can click again
- [ ] No confusion: User knows exactly what to fix

**Test Data:**
```
Password              Score  Color   Label
────────────────────────────────────────
"abc"                 0     Red     Too short
"abcdefgh"            1     Red     Weak
"abcdef12"            2     Amber   Fair
"Abcdefgh"            3     Blue    Strong
"Abcdefgh123!@"       4     Green   Very strong
```

---

### Scenario 2: Duplicate Email

**Goal:** User redirected to sign in without friction

**Steps:**
1. Signup as jane@clinic.com (first time)
2. Success → redirected to onboarding
3. Go back and try signup again with jane@clinic.com
4. Expected error: "Account already exists. Sign in instead."
5. Click "Sign in instead" link (or button for Google)
6. Redirected to /login with email pre-filled
7. Enter password and sign in

**Verification (Non-Google):**
- [ ] Error message clear: "already exists"
- [ ] "Sign in instead" is clickable (not just text)
- [ ] Link goes to /login?email=jane%40clinic.com
- [ ] Email field on login is pre-filled
- [ ] User can immediately sign in

**Verification (Google-linked):**
- [ ] Error: "email is linked to Google account"
- [ ] "Try signing in with Google" button visible
- [ ] Clicking button triggers Google OAuth immediately
- [ ] No need to find and click separate Google button

---

### Scenario 3: Rate Limit (5+ Failures)

**Goal:** User understands why they're locked out and what to do

**Steps:**
1. Enter weak password
2. Submit 5 times (intentional failures)
3. 5th submit: Rate limit triggered
4. Expected: Error message + timer + recovery options
5. User can either:
   - Wait 14:56 and try again
   - Try Google OAuth (not rate limited)
   - Contact support email

**Verification:**
- [ ] Error message visible: "Too many attempts"
- [ ] Timer visible: "14:56" and counting down
- [ ] "Try Google sign-up" option visible (not disabled)
- [ ] "Contact support" link visible with email prefill
- [ ] Timer updates every second
- [ ] After 14:56, button re-enables automatically
- [ ] User can click "Try Google" while waiting

**Edge Case - Timer Persistence:**
- [ ] User closes browser while locked out
- [ ] User returns to signup page
- [ ] Expected: Timer still active (sessionStorage)
- [ ] User can still see time remaining
- [ ] After timer expires, can sign up again

---

### Scenario 4: Network Error

**Goal:** User knows what happened and what to do

**Current State:** Generic "An unexpected error occurred. Please try again."

**Desired State:**
- Network timeout: "Connection timeout. Check internet and retry."
- Server 500: "Server error. Try again in a few minutes or contact support."
- Server 429: "Too many requests. Wait a moment and try again."

**Testing:**
1. Simulate timeout: Use Chrome DevTools Throttling
2. Fill form and submit
3. Expected: Specific error message (after fix)
4. User can click retry or contact support

---

### Scenario 5: Success Path

**Goal:** User sees confirmation before redirect

**Current:** Account created → Auto-sign in → Redirect to onboarding

**Desired Enhancement:**
- Show "Account created! Signing in..." for 1-2 seconds
- Then redirect
- User has visual confirmation of success

**Testing:**
- [ ] Form submits
- [ ] Button shows "Creating Account..." (spinner)
- [ ] Account created (backend)
- [ ] User signed in (backend)
- [ ] Success state visible for 1+ second
- [ ] Redirect to onboarding
- [ ] No "Account created! Please sign in" fallback message

---

## Part 4: Performance Testing

### Page Load Performance

**Goal:** Form loads in <3 seconds

**Setup:**
1. Chrome DevTools → Network tab
2. Set throttling: "Slow 3G"
3. Reload page
4. Check metrics

**Expected Results:**
- [ ] First Contentful Paint (FCP): <1.5s
- [ ] Largest Contentful Paint (LCP): <2.5s
- [ ] Cumulative Layout Shift (CLS): <0.1
- [ ] Time to Interactive (TTI): <3s

**Checklist:**
```
JS Bundle:
[ ] No unneeded dependencies
[ ] Tree shaking enabled
[ ] Code splitting (lazy load if needed)

CSS:
[ ] No duplicate styles
[ ] No unused selectors
[ ] No render-blocking CSS

Images:
[ ] Google logo optimized (SVG)
[ ] Integration logos optimized
[ ] No images in critical path

Fonts:
[ ] System fonts (no Google Fonts delay)
[ ] Font size set before download
```

---

### Form Interaction Performance

**Setup:**
1. Fill form on regular device
2. Open DevTools → Performance tab
3. Record while submitting

**Expected Results:**
- [ ] No janky animations (60 FPS)
- [ ] Password strength meter updates smoothly
- [ ] Error banner appears without delay
- [ ] Shake animation (if added) smooth

**Check:**
```
JavaScript:
[ ] No long tasks (>50ms)
[ ] No main thread blocking
[ ] React renders efficiently

Rendering:
[ ] No layout thrashing
[ ] No unnecessary repaints
[ ] CSS transitions smooth
```

---

## Part 5: Compliance Testing

### WCAG 2.1 Level AA Checklist

**1. Perceivable**
- [ ] **1.1.1 Non-text Content (A):** Logos have alt text
- [ ] **1.3.1 Info & Relationships (A):** Form labels associated
- [ ] **1.4.3 Contrast (AA):** Text 4.5:1, large text 3:1
- [ ] **1.4.4 Resize Text (AA):** Can zoom to 200%
- [ ] **1.4.5 Images of Text (AA):** No text as images

**2. Operable**
- [ ] **2.1.1 Keyboard (A):** All features keyboard accessible
- [ ] **2.1.2 No Keyboard Trap (A):** Tab order logical
- [ ] **2.4.3 Focus Order (A):** Focus visible
- [ ] **2.4.7 Focus Visible (AA):** Focus ring always visible
- [ ] **2.5.5 Target Size (AAA):** Touch targets 44x44px

**3. Understandable**
- [ ] **3.2.1 On Focus (A):** No unexpected changes on focus
- [ ] **3.3.1 Error Identification (A):** Errors identified clearly
- [ ] **3.3.3 Error Suggestion (AA):** Suggestions provided
- [ ] **3.3.4 Error Prevention (AA):** Confirmation for important actions

**4. Robust**
- [ ] **4.1.2 Name, Role, Value (A):** ARIA attributes correct
- [ ] **4.1.3 Status Messages (AA):** aria-live for errors

---

## Part 6: User Testing

### Remote User Testing (5 users)

**Goal:** Identify real-world usage patterns and pain points

**Recruitment:**
- 1 power user (frequent tech user)
- 1 older adult (50+)
- 1 mobile-first user
- 1 accessibility needs (vision, hearing, motor)
- 1 international user (if applicable)

**Task 1: Sign Up**
- Scenario: "Create an account as a clinic owner"
- Time limit: 5 minutes
- Success: Account created

**Task 2: Handle Error**
- Scenario: "What would you do if password was rejected?"
- Observe: Do they notice error? Do they understand why?
- Time limit: 2 minutes

**Task 3: Rate Limit Recovery**
- Scenario: "You're locked out. What do you do?"
- Observe: Do they wait? Do they try Google? Do they contact support?
- Time limit: 3 minutes

**Metrics:**
- Task completion rate
- Time on task
- Error recovery success
- Confusion points
- Accessibility issues discovered

---

## Testing Checklist Summary

### Quick QA (30 minutes)
```
[ ] Load form in Chrome (desktop)
[ ] Fill valid form → success
[ ] Fill weak password → error
[ ] Duplicate email → error + link
[ ] Rate limit → error + timer (if can trigger 5x)
[ ] Mobile viewport (375px) → layout OK
[ ] VoiceOver on Mac → error announced
[ ] Keyboard only → tab order correct
```

### Thorough QA (2-3 hours)
```
ACCESSIBILITY (1.5 hours):
[ ] NVDA test (Windows)
[ ] VoiceOver test (Mac)
[ ] Keyboard-only test
[ ] Color contrast check
[ ] Form field associations
[ ] Error handling (aria-invalid)
[ ] All link purposes clear

MOBILE (45 minutes):
[ ] iPhone 12 (375px) - all scenarios
[ ] iPhone Max (430px)
[ ] Android Pixel (390px)
[ ] Portrait + landscape
[ ] With keyboard open
[ ] Touch target sizes (44px+)

ERRORS (30 minutes):
[ ] Weak password flow
[ ] Duplicate email flow
[ ] Rate limit flow
[ ] Network error (simulated)
[ ] Form recovery (fields retained)

PERFORMANCE (15 minutes):
[ ] Page load time <3s
[ ] No janky animations
[ ] Form submission instant response
[ ] Error appearance (< 200ms)
```

### Comprehensive QA (4-6 hours)
All of above +
```
[ ] Multiple browser test (Firefox, Safari, Edge)
[ ] JAWS screen reader test
[ ] Android TalkBack test
[ ] User research sessions (5 users)
[ ] A/B test error messages
[ ] Performance profiling
[ ] Load testing (concurrent signups)
[ ] Security audit (XSS, SQL injection)
```

---

## Common Issues & Fixes

### Issue: Focus Ring Not Visible
**Symptom:** Can't see outline when tabbing
**Cause:** `outline: none` in CSS
**Fix:** Add `focus-visible:ring-2` to inputs

---

### Issue: Screen Reader Says "Button" Only
**Symptom:** NVDA announces "button" but no purpose
**Cause:** Missing aria-label or text content
**Fix:** Add `aria-label="Show password"` to button

---

### Issue: Error Message Not Announced
**Symptom:** Submit form, no audio announcement
**Cause:** Missing `role="alert"` or `aria-live="assertive"`
**Fix:** Wrap error in div with both attributes

---

### Issue: Android Keyboard Blocks Button
**Symptom:** Submit button hidden when keyboard open
**Cause:** Viewport height too small
**Fix:** Ensure form scrolls, button accessible when keyboard open

---

### Issue: Password Strength Not Updating Smoothly
**Symptom:** Strength meter lags behind typing
**Cause:** Slow password strength calculation
**Fix:** Debounce strength calculation or optimize regex

---

## Sign-Off

After completing all tests, document results:

```markdown
## Sign-Up Form QA Sign-Off
Date: [Date]
Tester: [Name]
Build: [Version/Commit]

### Accessibility Testing
- [ ] WCAG 2.1 AA compliant
- [ ] Screen reader tested (NVDA, VoiceOver)
- [ ] Keyboard navigation tested
- [ ] Color contrast verified

### Mobile Testing
- [ ] iOS 15+ tested
- [ ] Android 10+ tested
- [ ] 375px viewport verified
- [ ] Touch targets 44px+

### Error Scenarios
- [ ] Weak password: Clear error, form retained
- [ ] Duplicate email: Link to sign in provided
- [ ] Rate limit: Timer and recovery options shown
- [ ] Network error: Specific error message

### Performance
- [ ] Page load <3s
- [ ] Animations smooth (60 FPS)
- [ ] No jank or flashing

### Final Status
[ ] **APPROVED FOR PRODUCTION**
[ ] **Approved with minor issues** (document)
[ ] **Rejected** (document blockers)

Signed: _________________ Date: _______
```

---

**Total Testing Time Estimate:**
- Quick QA: 30 min
- Thorough QA: 2-3 hours
- Comprehensive: 4-6 hours

**Recommended:** Thorough QA before every release to production
