# Scene File Update Guide - Manifest System Migration

**Purpose:** Quick reference for converting hardcoded coordinates to manifest-based lookups

---

## Quick Conversion Examples

### HighlightBox Component

**BEFORE:**
```tsx
<HighlightBox
  x={760}
  y={332}
  width={400}
  height={48}
  startFrame={40}
  label="Email Field"
  color="#1D4ED8"
/>
```

**AFTER:**
```tsx
<HighlightBox
  elementName="email-input"
  screenshotName="00_signin_page.png"
  startFrame={40}
  label="Email Field"
  color="#1D4ED8"
/>
```

**What Changed:**
- ❌ Removed: `x`, `y`, `width`, `height`
- ✅ Added: `elementName`, `screenshotName`

---

### ClickSimulation Component

**BEFORE:**
```tsx
<ClickSimulation
  fromX={960}
  fromY={444}
  toX={960}
  toY={532}
  startFrame={180}
  showRipple={true}
/>
```

**AFTER:**
```tsx
<ClickSimulation
  fromElementName="password-input"
  toElementName="sign-in-button"
  screenshotName="00_signin_page.png"
  startFrame={180}
  showRipple={true}
/>
```

**What Changed:**
- ❌ Removed: `fromX`, `fromY`, `toX`, `toY`
- ✅ Added: `fromElementName`, `toElementName`, `screenshotName`

**Note:** Automatically uses `centerX`/`centerY` for precise cursor positioning

---

### FormFillSimulation Component

**BEFORE:**
```tsx
<FormFillSimulation
  x={760}
  y={420}
  width={400}
  height={48}
  text="********"
  startFrame={120}
  masked={true}
  label="Password"
/>
```

**AFTER:**
```tsx
<FormFillSimulation
  elementName="password-input"
  screenshotName="00_signin_page.png"
  text="********"
  startFrame={120}
  masked={true}
  label="Password"
/>
```

**What Changed:**
- ❌ Removed: `x`, `y`, `width`, `height`
- ✅ Added: `elementName`, `screenshotName`

---

## Element Name Reference

### Sign-In Page (`00_signin_page.png`)

| Element Name | Description | Component Use |
|-------------|-------------|---------------|
| `email-input` | Email input field | HighlightBox, FormFillSimulation |
| `password-input` | Password input field | HighlightBox, FormFillSimulation |
| `sign-in-button` | Sign-in button | HighlightBox, ClickSimulation |
| `logo` | Voxanne logo | HighlightBox |

**Usage Example:**
```tsx
<FormFillSimulation
  elementName="email-input"
  screenshotName="00_signin_page.png"
  text="voxanne@demo.com"
  startFrame={40}
/>
```

---

### Homepage Top (`00_homepage_top.png`)

| Element Name | Description | Component Use |
|-------------|-------------|---------------|
| `hero-heading` | Main headline | HighlightBox |
| `hero-subheading` | Tagline text | HighlightBox |
| `cta-button-primary` | "Get Started" button | HighlightBox, ClickSimulation |
| `cta-button-secondary` | "Watch Demo" button | HighlightBox, ClickSimulation |
| `navigation-bar` | Top navigation | HighlightBox |

**Usage Example:**
```tsx
<ClickSimulation
  fromElementName="hero-subheading"
  toElementName="cta-button-primary"
  screenshotName="00_homepage_top.png"
  startFrame={80}
/>
```

---

### Homepage Scrolled (`00_homepage_scrolled.png`)

**Note:** Same element names as `00_homepage_top.png` but with different coordinates (scrolled viewport)

| Element Name | Description | Coordinate Offset |
|-------------|-------------|-------------------|
| `hero-heading` | Main headline | Y: -550 (off-screen) |
| `hero-subheading` | Tagline text | Y: -400 (off-screen) |
| `cta-button-primary` | "Get Started" button | Y: -280 (off-screen) |
| `cta-button-secondary` | "Watch Demo" button | Y: -280 (off-screen) |
| `navigation-bar` | Top navigation | Y: -800 (hidden) |

**Usage Example:**
```tsx
<HighlightBox
  elementName="navigation-bar"
  screenshotName="00_homepage_scrolled.png"
  startFrame={120}
  label="Navigation"
/>
```

---

### Dashboard After Login (`00_dashboard_after_login.png`)

| Element Name | Description | Component Use |
|-------------|-------------|---------------|
| `dashboard-header` | "Dashboard" title | HighlightBox |
| `recent-activity-section` | Recent activity area | HighlightBox |

**Usage Example:**
```tsx
<HighlightBox
  elementName="recent-activity-section"
  screenshotName="00_dashboard_after_login.png"
  startFrame={90}
  label="Recent Activity"
/>
```

---

## Scene-by-Scene Update Checklist

### Scene 0A: Homepage Scroll (`Scene0A_HomepageScroll.tsx`)

**Manifests Used:**
- `00_homepage_top.png` (before scroll)
- `00_homepage_scrolled.png` (after scroll)

**Elements to Update:**
- [ ] Hero heading highlight → `elementName="hero-heading"`
- [ ] Hero subheading highlight → `elementName="hero-subheading"`
- [ ] CTA button clicks → `elementName="cta-button-primary"`, `"cta-button-secondary"`

---

### Scene 0B: Sign In (`Scene0B_SignIn.tsx`)

**Manifests Used:**
- `00_signin_page.png`

**Elements to Update:**
- [ ] Email input form fill → `elementName="email-input"`
- [ ] Password input form fill → `elementName="password-input"`
- [ ] Sign-in button click → `elementName="sign-in-button"`

---

### Scene 2: Dashboard Overview (`Scene2_DashboardOverview.tsx`)

**Manifests Used:**
- `00_dashboard_after_login.png`

**Elements to Update:**
- [ ] Dashboard header highlight → `elementName="dashboard-header"`
- [ ] Recent activity section highlight → `elementName="recent-activity-section"`

---

## Common Patterns

### Pattern 1: Sequential Form Fill

**Scenario:** Fill email, then password, then click sign-in

```tsx
{/* Email field - frames 40-90 */}
<FormFillSimulation
  elementName="email-input"
  screenshotName="00_signin_page.png"
  text="voxanne@demo.com"
  startFrame={40}
  charRate={2}
/>

{/* Password field - frames 120-170 */}
<FormFillSimulation
  elementName="password-input"
  screenshotName="00_signin_page.png"
  text="********"
  startFrame={120}
  masked={true}
  charRate={2}
/>

{/* Click sign-in button - frame 180 */}
<ClickSimulation
  fromElementName="password-input"
  toElementName="sign-in-button"
  screenshotName="00_signin_page.png"
  startFrame={180}
/>
```

---

### Pattern 2: Highlight Multiple Elements

**Scenario:** Highlight hero section components

```tsx
{/* Headline - frames 30-90 */}
<HighlightBox
  elementName="hero-heading"
  screenshotName="00_homepage_top.png"
  startFrame={30}
  duration={60}
  label="Compelling Headline"
/>

{/* Subheading - frames 60-120 */}
<HighlightBox
  elementName="hero-subheading"
  screenshotName="00_homepage_top.png"
  startFrame={60}
  duration={60}
  label="Clear Value Proposition"
/>

{/* CTA button - frames 90-150 */}
<HighlightBox
  elementName="cta-button-primary"
  screenshotName="00_homepage_top.png"
  startFrame={90}
  duration={60}
  label="Strong Call-to-Action"
/>
```

---

### Pattern 3: Cross-Screen Navigation

**Scenario:** Click "Get Started" on homepage → navigate to sign-in page

**Scene 1 (Homepage):**
```tsx
<ClickSimulation
  fromElementName="hero-subheading"
  toElementName="cta-button-primary"
  screenshotName="00_homepage_top.png"
  startFrame={180}
/>
```

**Scene 2 (Sign-In Page):**
```tsx
<HighlightBox
  elementName="email-input"
  screenshotName="00_signin_page.png"
  startFrame={10}
  label="Enter Email"
/>
```

---

## Troubleshooting

### Issue: "Element not found in manifest"

**Error Message:**
```
⚠️ HighlightBox: Element "email-field" not found in manifest "00_signin_page.png"
```

**Fix:**
1. Check element name spelling (correct: `"email-input"`, not `"email-field"`)
2. Verify element exists in manifest: Open `public/manifests/00_signin_page.json`
3. Use exact name from manifest (case-sensitive)

---

### Issue: "Manifest not found"

**Error Message:**
```
⚠️ Manifest not found: 00_signin.png
```

**Fix:**
1. Check screenshot name spelling (correct: `"00_signin_page.png"`, not `"00_signin.png"`)
2. Verify manifest file exists: `ls public/manifests/`
3. Include `.png` extension in screenshot name

---

### Issue: Highlight appears in wrong position

**Symptom:** HighlightBox shows but is off-target

**Fix:**
1. Verify correct manifest for scene (e.g., `00_homepage_top.png` vs `00_homepage_scrolled.png`)
2. Check if UI has changed since manifest extraction
3. Re-run coordinate extraction: `npm run extract-coords`

---

## Testing Your Changes

### Step 1: Visual Inspection

```bash
# Render single scene
npm run render -- --scene=Scene0B_SignIn

# Expected: Highlights/clicks appear at correct positions
```

### Step 2: Console Check

```bash
# Look for warnings in terminal
npm run preview

# Expected: No "Element not found" or "Manifest not found" warnings
```

### Step 3: Full Video Render

```bash
# Render complete video
npm run render

# Expected: All scenes render successfully
```

---

## Performance Tips

### Tip 1: Reuse screenshotName

**Good:**
```tsx
const SCREENSHOT = "00_signin_page.png";

<HighlightBox elementName="email-input" screenshotName={SCREENSHOT} ... />
<FormFillSimulation elementName="email-input" screenshotName={SCREENSHOT} ... />
<ClickSimulation fromElementName="email-input" screenshotName={SCREENSHOT} ... />
```

**Why:** Manifest loaded once, cached for all components

---

### Tip 2: Extract constants for element names

**Good:**
```tsx
const ELEMENTS = {
  EMAIL: 'email-input',
  PASSWORD: 'password-input',
  BUTTON: 'sign-in-button',
} as const;

<FormFillSimulation elementName={ELEMENTS.EMAIL} ... />
```

**Why:** Autocomplete, refactoring safety, type checking

---

## Final Checklist Before Committing

- [ ] All hardcoded coordinates replaced with manifest lookups
- [ ] No console warnings when rendering scenes
- [ ] Visual inspection confirms correct positioning
- [ ] Scene renders without errors
- [ ] Git commit includes updated scene file only (no manifest changes)

---

**Last Updated:** 2026-02-04
**System Version:** 1.0.0
**Total Manifests:** 4 files, 16 elements
