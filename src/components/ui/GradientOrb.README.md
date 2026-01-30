# GradientOrb Component

Animated gradient background orb for parallax effects and visual depth. Built with Framer Motion for GPU-accelerated animations.

## Features

- **GPU-Accelerated Animations**: Uses `transform` and `opacity` only (no layout thrashing)
- **Responsive Design**: Automatically scales down on mobile devices
- **Accessibility**: Respects `prefers-reduced-motion` for users who prefer less animation
- **Performance Optimized**: Infinite loop with subtle scale + opacity changes
- **Brand Colors**: Integrated with Voxanne AI brand color system
- **Z-Index Management**: Automatically positioned behind content

## Usage

```tsx
import { GradientOrb } from "@/components/ui/GradientOrb";

export default function MyPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient orbs */}
      <GradientOrb position="top-right" color="blue-bright" />
      <GradientOrb position="bottom-left" color="blue-medium" opacity={0.2} />

      {/* Your content (with z-10 to stay above orbs) */}
      <div className="relative z-10">
        <h1>Your Content Here</h1>
      </div>
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'top-left' \| 'top-right' \| 'center' \| 'bottom-left' \| 'bottom-right'` | **Required** | Position of the orb relative to its container |
| `color` | `'blue-bright' \| 'blue-medium' \| 'blue-light' \| 'navy-dark'` | **Required** | Brand color for the gradient |
| `blur` | `number` | `120` | Gaussian blur intensity in pixels |
| `size` | `number` | `400` | Orb diameter in pixels |
| `opacity` | `number` | `0.3` | Opacity level (0-1) |
| `animationDuration` | `number` | `8` | Animation loop duration in seconds |

## Brand Colors

| Color | Hex | Use Case |
|-------|-----|----------|
| `blue-bright` | `#0015ff` | Primary CTA blue - high impact |
| `blue-medium` | `#4169ff` | Secondary accent - balanced |
| `blue-light` | `#87ceeb` | Subtle highlights - soft |
| `navy-dark` | `#0a0e27` | Dark backgrounds - depth |

## Animation Behavior

The orb animates in an infinite loop with:
- **Scale**: 1 → 1.2 → 1 (subtle breathing effect)
- **Opacity**: base → base × 1.3 → base (subtle pulsing)
- **Easing**: `easeInOut` for smooth transitions
- **Duration**: Configurable (default 8 seconds)

### Reduced Motion

When a user has `prefers-reduced-motion: reduce` enabled, the orb:
- Remains static (no scale/opacity animation)
- Still displays at specified opacity
- Maintains visual hierarchy

## Responsive Behavior

| Breakpoint | Size |
|------------|------|
| Mobile (default) | 60% of specified size |
| Tablet (md+) | 80% of specified size |
| Desktop (lg+) | 100% of specified size |

## Examples

### Multiple Orbs for Depth

```tsx
<div className="relative overflow-hidden min-h-screen">
  {/* Background layer */}
  <GradientOrb
    position="top-right"
    color="blue-bright"
    opacity={0.3}
    size={500}
    blur={150}
  />

  {/* Mid layer */}
  <GradientOrb
    position="bottom-left"
    color="blue-medium"
    opacity={0.2}
    size={400}
    blur={120}
    animationDuration={10}
  />

  {/* Foreground layer */}
  <GradientOrb
    position="center"
    color="blue-light"
    opacity={0.15}
    size={600}
    blur={180}
    animationDuration={12}
  />

  {/* Content */}
  <div className="relative z-10">
    <h1>Welcome to Voxanne AI</h1>
  </div>
</div>
```

### Parallax Effect

```tsx
"use client";

import { useScroll, useTransform, motion } from "framer-motion";
import { GradientOrb } from "@/components/ui/GradientOrb";

export default function ParallaxSection() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

  return (
    <div className="relative overflow-hidden">
      {/* Orb moves slower than content for parallax */}
      <motion.div style={{ y }}>
        <GradientOrb position="top-right" color="blue-bright" />
      </motion.div>

      <div className="relative z-10">
        {/* Your content scrolls normally */}
      </div>
    </div>
  );
}
```

### Dark/Light Mode

```tsx
<div className="relative overflow-hidden bg-navy-900 dark:bg-white">
  {/* Dark mode: bright blue orb */}
  <div className="hidden dark:block">
    <GradientOrb position="top-right" color="blue-bright" opacity={0.3} />
  </div>

  {/* Light mode: subtle navy orb */}
  <div className="dark:hidden">
    <GradientOrb position="top-right" color="navy-dark" opacity={0.1} />
  </div>

  <div className="relative z-10">
    {/* Content */}
  </div>
</div>
```

## Performance Tips

1. **Limit the number of orbs**: Use 2-4 orbs maximum per section to avoid performance issues
2. **Vary animation durations**: Prevents visual synchronization (looks more natural)
3. **Use appropriate blur values**: Higher blur = more GPU work (120-180px is optimal)
4. **Parent container must have overflow**: Use `overflow-hidden` on the parent to clip orbs

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile Safari: ✅ Full support (with responsive sizing)

## Accessibility

- **ARIA**: Uses `aria-hidden="true"` (decorative element)
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce`
- **Focus**: Not focusable (`pointer-events-none`)
- **Screen Readers**: Hidden from assistive technologies

## TypeScript

```typescript
import type { GradientOrbProps } from "@/components/ui/GradientOrb";

const orbConfig: GradientOrbProps = {
  position: "top-right",
  color: "blue-bright",
  blur: 120,
  size: 400,
  opacity: 0.3,
  animationDuration: 8,
};
```

## Related Components

- `FadeIn` - For content fade-in animations
- `TextReveal` - For text reveal effects
- `ScrollProgress` - For scroll-based animations
- `StaggerGrid` - For grid item stagger animations

## Credits

Built with:
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- Voxanne AI Brand Colors - Design system integration
