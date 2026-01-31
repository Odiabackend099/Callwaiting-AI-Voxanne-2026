# Light Mode Enforcer Skill

## Purpose
Verify that dark mode has been PERMANENTLY removed from the Voxanne AI dashboard.
Run this skill after ANY dashboard UI changes to prevent dark mode regression.

## When to Use
- After any dashboard UI changes
- After any layout.tsx modifications
- After any component changes in src/components/dashboard/
- Before any deployment
- When user reports dark mode appearing

## Verification Checks

### CHECK 1: ThemeContext.tsx must NOT exist
```bash
test ! -f src/contexts/ThemeContext.tsx && echo "PASS" || echo "FAIL: ThemeContext.tsx still exists - DELETE IT"
```

### CHECK 2: ThemeToggle.tsx must NOT exist
```bash
test ! -f src/components/dashboard/ThemeToggle.tsx && echo "PASS" || echo "FAIL: ThemeToggle.tsx still exists - DELETE IT"
```

### CHECK 3: No ThemeProvider imports in src/
```bash
grep -r "ThemeProvider" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".next"
# Expected: 0 results. If any found, remove the import and wrapper.
```

### CHECK 4: No ThemeContext imports in src/
```bash
grep -r "ThemeContext" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".next"
# Expected: 0 results. If any found, remove the import.
```

### CHECK 5: No ThemeToggle imports in src/
```bash
grep -r "ThemeToggle" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".next"
# Expected: 0 results. If any found, remove the import and component usage.
```

### CHECK 6: LeftSidebar has ZERO dark: classes
```bash
grep -c "dark:" src/components/dashboard/LeftSidebar.tsx
# Expected: 0. If > 0, remove all dark: prefixed utility classes.
```

### CHECK 7: OrgErrorBoundary uses Clinical Trust light colors
```bash
grep "slate-950" src/components/OrgErrorBoundary.tsx
# Expected: 0 results. Should use bg-clinical-bg, text-obsidian instead.
```

### CHECK 8: globals.css has color-scheme: light only
```bash
grep "color-scheme: light only" src/app/globals.css
# Expected: At least 1 result.
```

### CHECK 9: tailwind.config.js has NO darkMode config
```bash
grep "darkMode" tailwind.config.js
# Expected: 0 results (only the warning comment is acceptable).
```

### CHECK 10: Dashboard page has NO 10-second polling
```bash
grep "refreshInterval: 10000" src/app/dashboard/page.tsx
# Expected: 0 results. Should be refreshInterval: 0.
```

### CHECK 11: loading.tsx uses light background
```bash
grep "bg-clinical-bg" src/app/loading.tsx
# Expected: At least 1 result.
```

### CHECK 12: layout.tsx has bg-clinical-bg
```bash
grep "bg-clinical-bg" src/app/dashboard/layout.tsx
# Expected: At least 1 result.
```

## Clinical Trust Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-clinical-bg` | #F0F9FF | Main app background |
| `bg-clinical-surface` | #FFFFFF | Card backgrounds |
| `border-surgical-200` | #BFDBFE | Borders |
| `text-obsidian` | #020412 | Primary text |
| `text-surgical-600` | #1D4ED8 | Primary buttons, active states |
| `text-surgical-500` | #3B82F6 | Icons, accents |

## If Any Check Fails

1. Fix the specific issue identified by the failing check
2. Re-run ALL checks to ensure no regressions
3. Run `npm run build` to verify TypeScript compilation
4. Verify visually that all dashboard pages show light mode

## Root Cause Prevention

The dark mode was caused by `ThemeContext.tsx` which:
- Detected OS dark mode via `window.matchMedia('(prefers-color-scheme: dark)')`
- Added `dark` class to `<html>` element
- Triggered ALL Tailwind `dark:` utility classes across the entire app

Prevention measures:
1. `globals.css` forces `color-scheme: light only` at document level
2. `tailwind.config.js` has no `darkMode` config
3. ThemeContext and ThemeToggle files are deleted
4. This skill provides automated verification
