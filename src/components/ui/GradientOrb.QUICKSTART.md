# GradientOrb Quick Start

## Basic Usage (Copy & Paste)

```tsx
import { GradientOrb } from "@/components/ui/GradientOrb";

<div className="relative overflow-hidden">
  <GradientOrb position="top-right" color="blue-bright" />
  <div className="relative z-10">{/* Your content */}</div>
</div>
```

## Common Patterns

### Hero Section Background
```tsx
<section className="relative overflow-hidden min-h-screen">
  <GradientOrb position="top-right" color="blue-bright" opacity={0.3} />
  <GradientOrb position="bottom-left" color="blue-medium" opacity={0.2} />
  <div className="relative z-10 container mx-auto">
    <h1>Welcome to Voxanne AI</h1>
  </div>
</section>
```

### Feature Card Background
```tsx
<div className="relative overflow-hidden rounded-xl bg-navy-900 p-8">
  <GradientOrb position="top-right" color="blue-light" size={300} blur={100} opacity={0.2} />
  <div className="relative z-10">
    <h3>Feature Title</h3>
    <p>Feature description...</p>
  </div>
</div>
```

### Multi-Layer Depth
```tsx
<div className="relative overflow-hidden">
  {/* Back layer (furthest) */}
  <GradientOrb position="top-right" color="blue-bright" size={500} blur={180} opacity={0.2} />

  {/* Middle layer */}
  <GradientOrb position="center" color="blue-medium" size={400} blur={140} opacity={0.25} animationDuration={10} />

  {/* Front layer (closest) */}
  <GradientOrb position="bottom-left" color="blue-light" size={350} blur={120} opacity={0.3} animationDuration={12} />

  <div className="relative z-10">{/* Content */}</div>
</div>
```

## Props Cheat Sheet

| Prop | Values | Default | When to Use |
|------|--------|---------|-------------|
| `position` | `top-left`, `top-right`, `center`, `bottom-left`, `bottom-right` | Required | Where to place the orb |
| `color` | `blue-bright`, `blue-medium`, `blue-light`, `navy-dark` | Required | Match your section's color scheme |
| `blur` | 80-200 | 120 | Higher = softer, lower = more defined |
| `size` | 300-600 | 400 | Larger = more coverage, smaller = accent |
| `opacity` | 0.1-0.4 | 0.3 | Higher = more visible, lower = subtle |
| `animationDuration` | 6-15 | 8 | Vary for natural feel (avoid sync) |

## Color Guide

- **blue-bright** (`#0015ff`): High-impact CTAs, hero sections
- **blue-medium** (`#4169ff`): Balanced accent, feature sections
- **blue-light** (`#87ceeb`): Subtle highlights, tertiary elements
- **navy-dark** (`#0a0e27`): Dark mode backgrounds, depth

## Performance Rules

✅ **DO:**
- Use 2-4 orbs per section maximum
- Vary `animationDuration` (8s, 10s, 12s) for natural look
- Set `overflow-hidden` on parent container
- Keep blur between 80-200px

❌ **DON'T:**
- Use >5 orbs on one page
- Use same `animationDuration` for all orbs (looks synchronized)
- Forget `relative z-10` on content (orbs will cover it)
- Use blur >250px (performance hit)

## Accessibility

The component automatically:
- Respects `prefers-reduced-motion` (no animation for users who prefer it)
- Uses `aria-hidden="true"` (decorative, hidden from screen readers)
- Is not focusable (`pointer-events-none`)

## Troubleshooting

**Orb is covering my content:**
```tsx
// Add relative z-10 to your content
<div className="relative z-10">Your content</div>
```

**Orb is cut off:**
```tsx
// Add overflow-hidden to parent
<div className="relative overflow-hidden">
  <GradientOrb ... />
</div>
```

**Want orb to extend outside container:**
```tsx
// Remove overflow-hidden and adjust position
<div className="relative"> {/* No overflow-hidden */}
  <GradientOrb position="top-right" /> {/* Extends outside */}
</div>
```

**Orb not animating:**
- Check if user has `prefers-reduced-motion` enabled (expected behavior)
- Verify Framer Motion is installed: `npm install framer-motion`

## Live Example

Run: `npm run dev` and navigate to:
```
/src/components/ui/__examples__/GradientOrbExample.tsx
```

## Need Help?

See full documentation: `GradientOrb.README.md`
