# Voxanne Brand Colors Utility Guide

## Overview

The `brand-colors.ts` utility provides a centralized, type-safe way to manage all Voxanne AI brand colors throughout the application. It includes helper functions for gradients, glows, and color schemes.

## Color Palette

The official Voxanne brand palette consists of 8 carefully selected colors:

```
┌─────────────────────────────────────────────────────┐
│ Navy Dark      #0a0e27  Trust, Authority            │
│ Blue Bright    #0015ff  Primary CTA, Energy         │
│ Blue Medium    #4169ff  Secondary Actions           │
│ Blue Light     #87ceeb  Backgrounds, Accents        │
│ Blue Subtle    #d6e9f5  Borders, Dividers           │
│ Off White      #f5f5f5  Default Backgrounds         │
│ Cream          #FAF8F5  Premium, Hero Sections      │
│ Sage           #E8F0EE  Alternative Subtle BG       │
└─────────────────────────────────────────────────────┘
```

## Basic Usage

### 1. Direct Color Access

```typescript
import { brandColors } from '@/lib/brand-colors';

// Access colors directly
const headerBackground = brandColors.navyDark;
const buttonColor = brandColors.blueBright;

// Type-safe - TypeScript will warn about invalid colors
const invalidColor = brandColors.invalidColor; // ❌ TypeScript Error
```

### 2. JSX/React Usage

```tsx
import { brandColors } from '@/lib/brand-colors';

export function Header() {
  return (
    <header style={{ backgroundColor: brandColors.navyDark }}>
      <h1 style={{ color: brandColors.offWhite }}>Welcome</h1>
    </header>
  );
}
```

### 3. Tailwind CSS with Arbitrary Values

```tsx
import { brandColors } from '@/lib/brand-colors';

export function Card() {
  return (
    <div className={`bg-[${brandColors.cream}] border-2 border-[${brandColors.blueSubtle}]`}>
      Content
    </div>
  );
}
```

## Advanced Features

### Creating Gradients

Use `createBrandGradient()` to generate smooth color transitions:

```typescript
import { createBrandGradient } from '@/lib/brand-colors';

// Basic gradient (default direction: to-br)
const gradient1 = createBrandGradient('navyDark', 'blueBright');
// Returns: "bg-gradient-to-br from-[#0a0e27] to-[#0015ff]"

// Specify direction
const gradient2 = createBrandGradient('blueBright', 'blueLight', 'to-r');
// Returns: "bg-gradient-to-r from-[#0015ff] to-[#87ceeb]"

// Available directions:
// 'to-r' (right), 'to-l' (left), 'to-b' (bottom), 'to-t' (top)
// 'to-br' (bottom-right), 'to-bl' (bottom-left), 'to-tr' (top-right), 'to-tl' (top-left)
```

#### Gradient Usage in JSX

```tsx
import { createBrandGradient } from '@/lib/brand-colors';

export function HeroSection() {
  return (
    <div className={createBrandGradient('navyDark', 'blueBright', 'to-br')}>
      <h1 className="text-white">Powered by Voxanne AI</h1>
    </div>
  );
}
```

### Creating Glow Effects

Use `createBrandGlow()` for glowing box-shadow effects:

```typescript
import { createBrandGlow } from '@/lib/brand-colors';

// Default intensity (0.3)
const glow1 = createBrandGlow('blueBright');

// Named intensity presets
const subtleGlow = createBrandGlow('blueMedium', 'subtle');       // 0.15
const defaultGlow = createBrandGlow('blueMedium', 'default');     // 0.3
const mediumGlow = createBrandGlow('blueMedium', 'medium');       // 0.5
const strongGlow = createBrandGlow('blueMedium', 'strong');       // 0.75
const intenseGlow = createBrandGlow('blueMedium', 'intense');     // 1.0

// Custom numeric intensity (0-1)
const customGlow = createBrandGlow('blueBright', 0.45);
```

#### Glow Usage in JSX

```tsx
import { createBrandGlow } from '@/lib/brand-colors';

export function CTAButton() {
  return (
    <button
      style={{
        backgroundColor: '#0015ff',
        boxShadow: createBrandGlow('blueBright', 'medium'),
      }}
      className="px-6 py-3 rounded-lg text-white font-semibold transition-all hover:shadow-lg"
    >
      Get Started
    </button>
  );
}
```

#### Glow + Tailwind Combination

```tsx
export function FeatureCard() {
  const glowEffect = createBrandGlow('blueMedium', 0.5);

  return (
    <div
      style={{ boxShadow: glowEffect }}
      className="bg-white p-6 rounded-xl border border-blue-subtle"
    >
      <h3 className="text-lg font-bold text-navy-dark">Feature Title</h3>
    </div>
  );
}
```

### Accessibility & Contrast

Use `getContrastPair()` to get recommended text colors:

```typescript
import { getContrastPair } from '@/lib/brand-colors';

const { light, dark } = getContrastPair('blueBright');
// On dark blue background, use: dark text (navyDark)

const { light: lightText, dark: darkText } = getContrastPair('cream');
// On light background, use: dark text (navyDark)
```

#### Accessibility Usage

```tsx
import { getContrastPair, brandColors } from '@/lib/brand-colors';

export function AccessibleButton({ bgColor }) {
  const contrastColors = getContrastPair(bgColor);

  return (
    <button
      style={{
        backgroundColor: brandColors[bgColor],
        color: contrastColors.dark,
      }}
    >
      Click Me
    </button>
  );
}
```

### Color Schemes

Create complete, cohesive component color schemes:

```typescript
import { createColorScheme } from '@/lib/brand-colors';

const primaryScheme = createColorScheme('blueBright');
// Returns:
// {
//   bg: '#0015ff',
//   text: '#0a0e27',
//   border: '#0015ff',
//   hover: '#0015ffdd'
// }
```

#### Color Scheme Usage

```tsx
import { createColorScheme } from '@/lib/brand-colors';

export function SemanticButton() {
  const colors = createColorScheme('blueBright');

  return (
    <button
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `2px solid ${colors.border}`,
      }}
      className="px-4 py-2 rounded transition-all hover:opacity-90"
    >
      Semantic Button
    </button>
  );
}
```

### Runtime Color Selection

Use `getColor()` for safe, runtime color selection:

```typescript
import { getColor, brandColors } from '@/lib/brand-colors';

// Safe color selection with fallback
const selectedColor = getColor(userPreference, brandColors.blueBright);

// Handles invalid names gracefully
const color = getColor('invalidColor', brandColors.navyDark);
// Returns fallback, logs warning
```

## Complete Examples

### Example 1: Interactive Button

```tsx
import { brandColors, createBrandGlow } from '@/lib/brand-colors';

export function InteractiveButton() {
  return (
    <button
      style={{
        backgroundColor: brandColors.blueBright,
        color: brandColors.offWhite,
        boxShadow: createBrandGlow('blueBright', 'default'),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = createBrandGlow('blueBright', 'strong');
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = createBrandGlow('blueBright', 'default');
      }}
      className="px-6 py-3 rounded-lg font-semibold transition-all"
    >
      Call to Action
    </button>
  );
}
```

### Example 2: Gradient Card

```tsx
import { createBrandGradient } from '@/lib/brand-colors';

export function GradientCard() {
  return (
    <div className={`${createBrandGradient('navyDark', 'blueBright')} p-8 rounded-xl text-white`}>
      <h2 className="text-2xl font-bold mb-4">Feature Highlight</h2>
      <p>This card uses the brand gradient for visual impact.</p>
    </div>
  );
}
```

### Example 3: Multi-Color Gradient

```tsx
import { brandColors } from '@/lib/brand-colors';

export function RainbowGradient() {
  return (
    <div
      style={{
        background: `linear-gradient(to right,
          ${brandColors.navyDark},
          ${brandColors.blueBright},
          ${brandColors.blueMedium},
          ${brandColors.blueLight})`,
      }}
      className="h-32 rounded-lg"
    />
  );
}
```

### Example 4: Theme Switcher

```tsx
import { brandColors, BrandColorName } from '@/lib/brand-colors';

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<BrandColorName>('blueBright');

  return (
    <div>
      <div className="flex gap-2">
        {Object.keys(brandColors).map((colorName) => (
          <button
            key={colorName}
            onClick={() => setTheme(colorName as BrandColorName)}
            style={{ backgroundColor: brandColors[colorName as BrandColorName] }}
            className="w-8 h-8 rounded-full"
          />
        ))}
      </div>
      <p style={{ color: brandColors[theme] }}>Selected: {theme}</p>
    </div>
  );
}
```

## Type Safety

All functions are fully typed for maximum TypeScript safety:

```typescript
import {
  BrandColorName,
  GradientDirection,
  BrandColorValue,
} from '@/lib/brand-colors';

// Only valid color names accepted
function applyColor(color: BrandColorName) {
  // ...
}

applyColor('blueBright'); // ✅ Valid
applyColor('invalidColor'); // ❌ TypeScript Error

// Gradient directions are validated
const gradient = createBrandGradient('navyDark', 'blueBright', 'to-br'); // ✅
const badGradient = createBrandGradient('navyDark', 'blueBright', 'invalid'); // ❌
```

## CSS Variables (Optional)

For CSS-in-JS or stylesheets, generate CSS variables:

```typescript
import { getCSSVariables } from '@/lib/brand-colors';

// In your global.css:
// :root {
//   getCSSVariables()
// }

// Usage in CSS:
// .element { color: var(--color-navyDark); }
```

## Animation Colors

Pre-defined color combinations for animations:

```typescript
import { animationColors } from '@/lib/brand-colors';

// Use in Framer Motion or CSS animations
const variants = {
  initial: { color: animationColors.navyToBlueBright[0] },
  animate: { color: animationColors.navyToBlueBright[1] },
};

// Status indicators
const statusColor = animationColors.status.success; // '#10b981'
```

## Best Practices

### ✅ DO

- Use `brandColors` for all Voxanne brand colors
- Leverage helper functions for gradients and glows
- Use TypeScript types for safety
- Combine with Tailwind CSS for consistency
- Check contrast with `getContrastPair()` for accessibility

### ❌ DON'T

- Hard-code hex colors in components
- Use colors from Figma directly without checking
- Ignore TypeScript warnings about invalid colors
- Create color combinations that fail WCAG AA contrast standards
- Assume colors look the same across all devices

## Troubleshooting

### Colors appear different in production

- Ensure `src/lib/brand-colors.ts` is imported correctly
- Check browser DevTools to verify actual hex values
- Test on multiple devices/screens

### Glow effect too subtle/intense

- Adjust intensity parameter: 'subtle' (0.15) → 'intense' (1.0)
- Try numeric values between 0-1 for fine control
- Test on target background color

### TypeScript errors with color names

- Verify color name is in `brandColors` object
- Use `BrandColorName` type for function parameters
- Check for typos (colors are camelCase)

## Migration Guide

If migrating from hardcoded colors:

```typescript
// BEFORE: ❌ Hardcoded colors
<button style={{ backgroundColor: '#0015ff' }}>Click</button>

// AFTER: ✅ Using brand-colors utility
import { brandColors } from '@/lib/brand-colors';
<button style={{ backgroundColor: brandColors.blueBright }}>Click</button>
```

## Support

For color palette updates or new color requests, update `brand-colors.ts` and regenerate documentation.

---

**Last Updated:** 2026-01-28
**Version:** 1.0.0
**Brand Colors:** 8 colors + 4 status colors + animation utilities
