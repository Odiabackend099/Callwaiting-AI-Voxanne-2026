---
name: dashboard-design-system
description: Clinical Trust Design System for the Voxanne AI dashboard. Enforces the approved monochromatic blue palette across all dashboard pages and components. Use when creating new dashboard pages, modifying existing ones, or auditing for color violations. LIGHT MODE ONLY - no dark mode, no unapproved colors.
---

# Clinical Trust Design System

Authoritative reference for all dashboard UI colors in the Voxanne AI platform. Every dashboard page and component MUST use ONLY the colors defined below. No exceptions.

## When to Use

- Creating any new dashboard page or component
- Modifying any file under `src/app/dashboard/` or `src/components/dashboard/`
- Reviewing pull requests that touch dashboard UI
- Auditing for color violations after any UI change
- Debugging invisible text or wrong-colored elements

## Approved Color Palette

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Deep Obsidian** | `#020412` | `text-obsidian` | All headings, body text, primary labels |
| **Surgical Blue 600** | `#1D4ED8` | `text-surgical-600`, `bg-surgical-600` | Primary buttons, active nav links, primary accents |
| **Surgical Blue 500** | `#3B82F6` | `text-surgical-500`, `bg-surgical-500` | Icons, secondary accents, spinners |
| **Surgical Blue 200** | `#BFDBFE` | `border-surgical-200` | ALL borders, dividers, separators |
| **Surgical Blue 100** | `#E0F2FE` | `bg-surgical-100` | Skeleton loaders, subtle backgrounds |
| **Surgical Blue 50** | `#F0F9FF` | `bg-surgical-50` | Card hover states, section backgrounds, badges |
| **White** | `#FFFFFF` | `bg-white` | Card backgrounds, main content areas |
| **Red** | Standard | `text-red-*`, `bg-red-*` | ONLY for danger, delete, error, failed states |

## Banned Colors

These MUST NEVER appear in dashboard files:

- `dark:` prefix (any class) - Dark mode is permanently banned
- `emerald-*` - Use `surgical-*` instead
- `rose-*` - Use `surgical-*` or `red-*` (errors only)
- `amber-*` - Use `surgical-*` instead
- `cyan-*` - Use `surgical-*` instead
- `purple-*` - Use `surgical-*` instead
- `indigo-*` - Use `surgical-600` instead
- `orange-*` - Use `surgical-*` instead
- `gray-*` - Use `obsidian` (text) or `surgical-*` (bg/border)
- `slate-*` - Use `obsidian` (text) or `surgical-*` (bg/border)
- `green-*` - Use `surgical-*` instead
- `blue-*` (raw Tailwind) - Use `surgical-*` tokens instead
- `yellow-*` - Use `surgical-*` instead

## Text Color Rules

| Old Pattern | Replacement |
|-------------|-------------|
| `text-gray-900`, `text-slate-900`, `text-black` | `text-obsidian` |
| `text-gray-800`, `text-slate-800` | `text-obsidian` |
| `text-gray-700`, `text-slate-700` | `text-obsidian/70` |
| `text-gray-600`, `text-slate-600` | `text-obsidian/60` |
| `text-gray-500`, `text-slate-500` | `text-obsidian/60` |
| `text-gray-400`, `text-slate-400` | `text-obsidian/40` |
| `text-gray-300`, `text-slate-300` | `text-obsidian/30` |

## Background Color Rules

| Old Pattern | Replacement |
|-------------|-------------|
| `bg-gray-50`, `bg-slate-50` | `bg-surgical-50` |
| `bg-gray-100`, `bg-slate-100` | `bg-surgical-50` |
| `bg-slate-200` | `bg-surgical-100` |
| `bg-slate-800`, `bg-slate-900`, `bg-slate-950` | `bg-white` or `bg-surgical-50` |
| `bg-emerald-600` (buttons) | `bg-surgical-600` |
| `hover:bg-emerald-700` | `hover:bg-surgical-700` |
| `bg-indigo-600` | `bg-surgical-600` |

## Border Color Rules

| Old Pattern | Replacement |
|-------------|-------------|
| `border-gray-*`, `border-slate-*` | `border-surgical-200` |
| `border-emerald-*` | `border-surgical-200` |
| `divide-gray-*`, `divide-slate-*` | `divide-surgical-200` |

## Focus/Ring Rules

| Old Pattern | Replacement |
|-------------|-------------|
| `focus:ring-emerald-*` | `focus:ring-surgical-500` |
| `focus:ring-blue-*` | `focus:ring-surgical-500` |
| `focus:ring-indigo-*` | `focus:ring-surgical-500` |

## Semantic Status Colors

Use ONLY these patterns for status indicators:

| State | Classes |
|-------|---------|
| **Success / Completed** | `bg-surgical-50 text-surgical-600 border-surgical-200` |
| **Active / Processing** | `bg-surgical-50 text-surgical-500 border-surgical-200` |
| **Warning / Pending** | `bg-surgical-50 text-obsidian/70 border-surgical-200` |
| **Error / Failed / Danger** | `bg-red-50 text-red-700 border-red-200` |
| **Neutral / Default** | `bg-surgical-50 text-obsidian/60 border-surgical-200` |

## Component Patterns

### Primary Button
```html
<button class="bg-surgical-600 hover:bg-surgical-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-colors">
```

### Secondary Button
```html
<button class="border border-surgical-200 text-obsidian/60 hover:bg-surgical-50 px-4 py-2 rounded-lg transition-colors">
```

### Danger Button (delete/destroy only)
```html
<button class="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
```

### Card
```html
<div class="bg-white rounded-xl shadow-sm border border-surgical-200">
```

### Section Header
```html
<h3 class="text-[10px] font-bold text-obsidian/40 uppercase tracking-widest">SECTION NAME</h3>
```

### Active Tab
```html
<button class="border-b-2 border-surgical-600 text-surgical-600 font-medium">
```

### Inactive Tab
```html
<button class="text-obsidian/60 hover:text-obsidian border-b-2 border-transparent">
```

### Badge (success)
```html
<span class="bg-surgical-50 text-surgical-600 border border-surgical-200 px-2 py-0.5 rounded-full text-xs font-medium">
```

### Badge (error)
```html
<span class="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium">
```

### Input Field
```html
<input class="w-full px-4 py-2.5 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 bg-white text-obsidian outline-none" />
```

### Loading Spinner
```html
<div class="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
```

### Modal Overlay
```html
<div class="fixed inset-0 bg-obsidian/60 backdrop-blur-sm flex items-center justify-center z-50">
```

### Modal Container
```html
<div class="bg-white rounded-2xl shadow-2xl border border-surgical-200 max-w-lg w-full">
```

## Verification Checklist

Run these checks after any dashboard UI changes:

### 1. No dark: classes in dashboard files
```bash
grep -r "dark:" src/app/dashboard/ src/components/dashboard/ --include="*.tsx" | grep -v node_modules
# Expected: 0 results
```

### 2. No banned colors in dashboard files
```bash
grep -rE "(emerald|rose|amber|cyan|purple|indigo|orange)" src/app/dashboard/ src/components/dashboard/ --include="*.tsx" | grep -v node_modules
# Expected: 0 results
```

### 3. No raw gray/slate in dashboard files
```bash
grep -rE "(text-gray-|bg-gray-|border-gray-|text-slate-|bg-slate-|border-slate-)" src/app/dashboard/ src/components/dashboard/ --include="*.tsx" | grep -v node_modules
# Expected: 0 results
```

### 4. No darkMode in tailwind config
```bash
grep "darkMode" tailwind.config.ts
# Expected: 0 results
```

### 5. Build must pass
```bash
npm run build
# Expected: 0 errors
```

## Files Covered

All files under these directories must comply:
- `src/app/dashboard/**/*.tsx`
- `src/components/dashboard/**/*.tsx`
- `tailwind.config.ts` (foundation)
- `src/app/globals.css` (CSS variables)

## Key Files Reference

| File | Purpose |
|------|---------|
| `tailwind.config.ts` | Defines `obsidian`, `surgical-*`, `clinical-*` tokens |
| `src/app/globals.css` | CSS variables for shadcn/ui, glass utilities |
| `src/app/dashboard/layout.tsx` | Dashboard wrapper (`bg-clinical-bg`) |
| `src/components/dashboard/LeftSidebar.tsx` | Navigation sidebar |
| `src/components/dashboard/CommandPalette.tsx` | Cmd+K command palette |
| `src/components/dashboard/PremiumCard.tsx` | Reusable card wrapper |
| `src/components/dashboard/PreFlightChecklist.tsx` | System health checks |
| `src/components/dashboard/ClinicalPulse.tsx` | Analytics metrics |

## If Violations Are Found

1. Replace the banned color with its approved equivalent from the tables above
2. Remove ALL `dark:` prefixed classes (delete them entirely)
3. Re-run all 5 verification checks
4. Run `npm run build` to confirm TypeScript compilation
5. Visually verify the page renders correctly with visible text and proper accents
