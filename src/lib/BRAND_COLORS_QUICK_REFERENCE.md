# Voxanne Brand Colors - Quick Reference

## Color Palette at a Glance

| Name | Hex | Usage | Example |
|------|-----|-------|---------|
| **navyDark** | `#0a0e27` | Headers, high-contrast sections | Navy background with light text |
| **blueBright** | `#0015ff` | Primary CTAs, main interactive | Bright "Sign Up" buttons |
| **blueMedium** | `#4169ff` | Secondary actions, hover states | Secondary buttons |
| **blueLight** | `#87ceeb` | Soft backgrounds, light accents | Card backgrounds |
| **blueSubtle** | `#d6e9f5` | Borders, dividers, subtle text | Border color for cards |
| **offWhite** | `#f5f5f5` | Default backgrounds, text | Standard card/section bg |
| **cream** | `#FAF8F5` | Premium sections, hero areas | Landing page hero |
| **sage** | `#E8F0EE` | Alternative subtle background | Secondary card bg |

## 1-Minute Setup

```tsx
import { brandColors, createBrandGradient, createBrandGlow } from '@/lib/brand-colors';

// Use directly
<div style={{ backgroundColor: brandColors.navyDark }}>

// Use in gradients
<div className={createBrandGradient('navyDark', 'blueBright')}>

// Use for glows
<button style={{ boxShadow: createBrandGlow('blueBright') }} />
```

## Common Patterns

### Buttons
```tsx
// Primary CTA
backgroundColor: brandColors.blueBright
color: brandColors.offWhite
boxShadow: createBrandGlow('blueBright', 'medium')

// Secondary
backgroundColor: brandColors.blueMedium
color: brandColors.offWhite

// Tertiary
backgroundColor: brandColors.offWhite
color: brandColors.navyDark
border: `2px solid ${brandColors.blueSubtle}`
```

### Cards
```tsx
// Standard card
backgroundColor: brandColors.offWhite
borderColor: brandColors.blueSubtle
borderWidth: '1px'

// Premium card
backgroundColor: brandColors.cream
boxShadow: createBrandGlow('blueLight', 'subtle')

// Dark card
backgroundColor: brandColors.navyDark
color: brandColors.offWhite
```

### Headers/Navigation
```tsx
backgroundColor: brandColors.navyDark
color: brandColors.offWhite
boxShadow: createBrandGlow('navyDark', 0.15)
```

### Backgrounds
```tsx
// Hero section
className={createBrandGradient('navyDark', 'blueBright')}

// Subtle background
backgroundColor: brandColors.sage

// Default section
backgroundColor: brandColors.offWhite
```

## Function Reference

### `createBrandGradient(from, to, direction?)`
Creates Tailwind gradient classes
```tsx
createBrandGradient('navyDark', 'blueBright')
// → "bg-gradient-to-br from-[#0a0e27] to-[#0015ff]"

// Directions: to-r, to-l, to-b, to-t, to-br, to-bl, to-tr, to-tl
```

### `createBrandGlow(color, intensity?)`
Creates box-shadow glow effect
```tsx
createBrandGlow('blueBright')                    // Default (0.3)
createBrandGlow('blueBright', 'medium')          // 0.5
createBrandGlow('blueBright', 0.75)              // Custom
// Presets: 'subtle' (0.15), 'default' (0.3), 'medium' (0.5), 'strong' (0.75), 'intense' (1.0)
```

### `getContrastPair(bgColor)`
Returns recommended text colors
```tsx
const { light, dark } = getContrastPair('blueBright')
// → { light: '#f5f5f5', dark: '#0a0e27' }
```

### `createColorScheme(color, variant?)`
Returns complete component color scheme
```tsx
const scheme = createColorScheme('blueBright')
// → { bg: '#0015ff', text: '#0a0e27', border: '#0015ff', hover: '#0015ffdd' }
```

### `getColor(name, fallback?)`
Safe runtime color selection
```tsx
getColor('blueBright', brandColors.blueLight)  // Valid or fallback
```

## Gradient Directions

```
to-r    ➜ right
to-l    ➜ left
to-b    ➜ bottom
to-t    ➜ top
to-br   ➜ bottom-right (default)
to-bl   ➜ bottom-left
to-tr   ➜ top-right
to-tl   ➜ top-left
```

## Intensity Presets

```
'subtle'   = 0.15 (very faint)
'default'  = 0.3  (standard)
'medium'   = 0.5  (noticeable)
'strong'   = 0.75 (pronounced)
'intense'  = 1.0  (maximum)
```

## Accessibility

| Background | Text Color | WCAG |
|-----------|-----------|------|
| navyDark | offWhite | AAA ✅ |
| blueBright | offWhite | AAA ✅ |
| cream | navyDark | AAA ✅ |
| offWhite | navyDark | AAA ✅ |

Always use `getContrastPair()` to verify safe combinations!

## Copy-Paste Templates

### Primary Button
```tsx
<button style={{
  backgroundColor: brandColors.blueBright,
  color: brandColors.offWhite,
  boxShadow: createBrandGlow('blueBright'),
  padding: '12px 24px',
  borderRadius: '8px',
}}>
  Click Me
</button>
```

### Gradient Hero
```tsx
<section className={`${createBrandGradient('navyDark', 'blueBright')} py-20`}>
  <h1 className="text-white">Hero Section</h1>
</section>
```

### Styled Card
```tsx
<div style={{
  backgroundColor: brandColors.offWhite,
  borderLeft: `4px solid ${brandColors.blueBright}`,
  boxShadow: createBrandGlow('blueLight', 'subtle'),
  padding: '20px',
  borderRadius: '8px',
}}>
  Card content
</div>
```

### Interactive Element
```tsx
<div
  style={{
    backgroundColor: brandColors.sage,
    boxShadow: createBrandGlow('blueSubtle', 0.2),
    transition: 'box-shadow 0.3s ease',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = createBrandGlow('blueBright', 0.5);
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = createBrandGlow('blueSubtle', 0.2);
  }}
>
  Hover me
</div>
```

## Status Colors

For errors, warnings, success, info states:
```tsx
import { animationColors } from '@/lib/brand-colors';

animationColors.status.success  // #10b981 (Green)
animationColors.status.warning  // #f59e0b (Amber)
animationColors.status.error    // #ef4444 (Red)
animationColors.status.info     // #0015ff (Brand Blue)
```

## Tailwind Integration

Using with arbitrary values:
```tsx
// Direct color
className={`bg-[${brandColors.navyDark}]`}

// Gradient
className={createBrandGradient('navyDark', 'blueBright')}

// Combined
className={`${createBrandGradient('navyDark', 'blueBright')} text-white`}
```

## Common Mistakes ❌ → ✅

```tsx
// ❌ Hard-coded colors
backgroundColor: '#0015ff'

// ✅ Use brand-colors
backgroundColor: brandColors.blueBright

// ❌ Random gradient
className="bg-gradient-to-r from-blue-500 to-purple-500"

// ✅ Use brand gradient
className={createBrandGradient('blueBright', 'blueLight')}

// ❌ No contrast checking
backgroundColor: brandColors.blueLight
color: '#999999'  // Too light!

// ✅ Use getContrastPair
const contrast = getContrastPair('blueLight')
color: contrast.dark
```

## File Location

```
src/lib/brand-colors.ts         ← Main utility
src/lib/BRAND_COLORS_GUIDE.md   ← Full documentation
src/lib/__tests__/brand-colors.test.ts  ← Tests
```

## Need Help?

1. **Color name**: Check `brandColors` object
2. **Gradient**: Use `createBrandGradient(from, to)`
3. **Glow effect**: Use `createBrandGlow(color, intensity)`
4. **Text color**: Use `getContrastPair(bgColor)`
5. **Full scheme**: Use `createColorScheme(color)`

---

**Pro Tip:** Keep this reference open while building for quick copy-paste patterns! 💡
