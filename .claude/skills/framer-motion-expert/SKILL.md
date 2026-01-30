---
name: framer-motion-expert
description: Expert in Framer Motion animations, parallax scrolling, and 2025 web design trends. Use when creating animations, implementing parallax effects, or enhancing UI with motion. Specializes in performance-optimized, accessible animations for Voxanne AI.
---

# Framer Motion Expert Skill

## Overview

Provides expert guidance on Framer Motion animations, 2025 Webflow-style design patterns, parallax scrolling, and performance-optimized motion design specifically for Voxanne AI.

## When to Use

Use this skill when:
- Creating scroll-driven animations
- Implementing parallax effects
- Building interactive hover states
- Designing stagger animations
- Optimizing animation performance
- Ensuring accessibility (prefers-reduced-motion)
- Applying brand-consistent motion design
- Debugging animation issues

## Core Animation Library

All animations use the unified library at `src/lib/animations/index.ts`:

### Easing Curves
```typescript
import { easings } from '@/lib/animations';

// Available easings:
easings.professional // [0.25, 1, 0.5, 1] - Smooth, polished
easings.antiGravity  // [0.16, 1, 0.3, 1] - Bouncy, playful (default)
easings.smooth       // [0.4, 0.0, 0.2, 1] - Material Design
easings.bounce       // [0.68, -0.55, 0.265, 1.55] - Overshoot
easings.sharp        // [0.4, 0.0, 0.6, 1] - Snappy
easings.easeOut      // [0.0, 0.0, 0.2, 1] - Deceleration
```

### Pre-built Variants
```typescript
import { variants } from '@/lib/animations';

// Common patterns:
variants.fadeInUp        // Signature Voxanne style
variants.fadeInScale     // Pop-in effect
variants.slideInLeft     // Slide from left
variants.scaleOnHover    // Subtle lift on hover
variants.glowOnHover     // Brand blue glow effect
```

### Spring Physics
```typescript
import { springs } from '@/lib/animations';

springs.gentle   // Subtle, soft motion
springs.snappy   // Quick, responsive
springs.bouncy   // Playful overshoot
springs.smooth   // Balanced motion
```

## Animation Patterns

### 1. Scroll-Triggered Animations (FadeIn)

```typescript
import FadeIn from '@/components/ui/FadeIn';

// Basic usage
<FadeIn>
  <h2>Animated Heading</h2>
</FadeIn>

// Advanced with options
<FadeIn
  direction="left"      // up, down, left, right, none
  delay={0.2}           // Delay in seconds
  duration={0.6}        // Animation duration
  blur={true}           // Blur effect
  scale={false}         // Scale effect
  once={true}           // Trigger once or every view
>
  <div>Content</div>
</FadeIn>
```

### 2. Text Reveal Animations

```typescript
import TextReveal, { HeroTextReveal, SubtitleTextReveal } from '@/components/ui/TextReveal';

// Word-by-word reveal
<HeroTextReveal text="Your AI Receptionist That Never Sleeps" />

// Character-by-character
<TextReveal
  text="Voxanne AI"
  mode="chars"
  variant="fadeScale"
  stagger={0.02}
/>
```

### 3. Scroll Progress Indicator

```typescript
import ScrollProgress, { CircularScrollProgress } from '@/components/ui/ScrollProgress';

// Linear progress bar
<ScrollProgress
  color="#0015ff"    // Brand blue
  height={3}
  position="top"
/>

// Circular with percentage
<CircularScrollProgress size={60} />
```

### 4. Stagger Grid Animations

```typescript
import { FeatureGrid, PricingGrid, LogoGrid } from '@/components/ui/StaggerGrid';

// Pre-configured for features (2 cols)
<FeatureGrid>
  {features.map(feature => <FeatureCard {...feature} />)}
</FeatureGrid>

// Custom grid
<StaggerGrid
  columns={{ mobile: 1, tablet: 2, desktop: 3 }}
  gap={8}
  stagger={0.1}
  variant="fadeUp"
>
  {items.map(item => <Card {...item} />)}
</StaggerGrid>
```

### 5. Parallax Effects

```typescript
import { ParallaxSection, ParallaxImage, StickyScrollSection } from '@/components/ParallaxSection';

// Parallax background
<ParallaxSection offset={0.5}>
  <div className="absolute inset-0 bg-gradient-radial..." />
</ParallaxSection>

// Parallax image
<ParallaxImage
  src="/image.png"
  alt="Feature"
  offset={50}
/>

// Sticky scroll section
<StickyScrollSection height="300vh">
  <div>Sticky content here</div>
</StickyScrollSection>
```

### 6. Interactive Hover States

```typescript
import { motion } from 'framer-motion';
import { variants } from '@/lib/animations';

// Scale + glow on hover
<motion.div
  variants={variants.scaleAndGlowOnHover}
  initial="rest"
  whileHover="hover"
  whileTap="tap"
>
  <button>Click me</button>
</motion.div>

// Custom hover effect
<motion.div
  whileHover={{
    scale: 1.05,
    boxShadow: "0 0 30px rgba(0, 21, 255, 0.3)",
  }}
  transition={{ duration: 0.3 }}
>
  <Card />
</motion.div>
```

## Brand Integration

### Voxanne AI Brand Colors

```typescript
import { brandColors, createBrandGlow } from '@/lib/animations';

// Available colors from 9.png:
brandColors.navyDark   // #0a0e27 - Primary dark
brandColors.blueBright // #0015ff - CTAs, primary actions
brandColors.blueMedium // #4169ff - Secondary accents
brandColors.blueLight  // #87ceeb - Highlights, hover
brandColors.blueSubtle // #d6e9f5 - Subtle backgrounds
brandColors.offWhite   // #f5f5f5 - Light backgrounds

// Create brand glow
const glow = createBrandGlow('blueBright', 0.3);
// Returns: "0 0 20px rgba(0, 21, 255, 0.3)"
```

### Applying Brand Animations

```typescript
// Glow effect on cards
<motion.div
  whileHover={{
    boxShadow: createBrandGlow('blueBright', 0.3),
    scale: 1.02,
  }}
>
  <PricingCard />
</motion.div>

// Animated gradient backgrounds
<motion.div
  animate={{
    background: [
      `radial-gradient(circle at 20% 50%, ${brandColors.blueBright}15 0%, transparent 50%)`,
      `radial-gradient(circle at 80% 50%, ${brandColors.blueMedium}15 0%, transparent 50%)`,
    ],
  }}
  transition={{ duration: 10, repeat: Infinity }}
/>
```

## Accessibility

### Always Check Reduced Motion Preference

```typescript
import { useReducedMotion } from '@/lib/animations';

function Component() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div>Static content (no animation)</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      Animated content
    </motion.div>
  );
}
```

**All Voxanne UI components respect `prefers-reduced-motion` automatically!**

### Accessibility Checklist

- [ ] All animations respect `useReducedMotion()` hook
- [ ] Animations enhance, never distract from content
- [ ] Focus states are visible during animations
- [ ] Content is readable at all animation stages
- [ ] No seizure-inducing patterns (no rapid flashing)
- [ ] Keyboard navigation works during animations

## Performance Best Practices

### GPU-Accelerated Properties (60fps)

✅ **USE THESE:**
```typescript
// Always use transform and opacity for smooth 60fps
{
  opacity: 0,
  transform: "translateY(20px)",
  scale: 0.9,
  rotate: 45,
  filter: "blur(4px)",
}
```

❌ **AVOID THESE:**
```typescript
// These cause layout recalculation (janky, slow)
{
  width: "100%",
  height: "200px",
  top: "50px",
  left: "100px",
  margin: "20px",
  padding: "10px",
}
```

### Animation Duration Guidelines

```typescript
import { durations } from '@/lib/animations';

durations.instant   // 0.15s - Micro-interactions
durations.fast      // 0.3s  - Hover effects
durations.normal    // 0.5s  - Standard UI
durations.slow      // 0.8s  - Entrance animations
durations.verySlow  // 1.2s  - Special effects only
```

**Rule:** Keep animations under 0.8s for perceived performance.

### will-change Property

```typescript
// Use sparingly - only for frequently animated elements
<motion.div
  style={{ willChange: "transform" }}
  whileHover={{ scale: 1.1 }}
>
  Button
</motion.div>

// Remove after animation completes
<motion.div
  onAnimationComplete={() => {
    element.style.willChange = "auto";
  }}
/>
```

### Layout Animations (FLIP technique)

```typescript
// Automatic FLIP animations for layout changes
<motion.div layout>
  <motion.div layoutId="card-1">
    Card content
  </motion.div>
</motion.div>
```

## Common Issues & Solutions

### Issue 1: Animation Not Triggering

**Problem:** FadeIn not animating when scrolling.

**Solution:**
```typescript
// Check useInView configuration
const isInView = useInView(ref, {
  once: true,        // Set to false to re-trigger
  margin: "-100px"   // Adjust trigger point
});
```

### Issue 2: Janky Animations

**Problem:** Animations are stuttering or slow.

**Solutions:**
1. Use transform/opacity only (no width/height)
2. Reduce number of simultaneous animations
3. Check for heavy re-renders
4. Use `will-change` sparingly

```typescript
// Bad (animates height - causes reflow)
<motion.div animate={{ height: 200 }} />

// Good (animates scale - GPU accelerated)
<motion.div animate={{ scaleY: 2 }} />
```

### Issue 3: Exit Animations Not Working

**Problem:** Component disappears instantly without exit animation.

**Solution:**
```typescript
import { AnimatePresence } from 'framer-motion';

// Wrap with AnimatePresence
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      Content
    </motion.div>
  )}
</AnimatePresence>
```

### Issue 4: Stagger Not Working

**Problem:** Stagger animation plays all at once.

**Solution:**
```typescript
// Parent needs variants with staggerChildren
const container = {
  visible: {
    transition: {
      staggerChildren: 0.1,  // REQUIRED
      delayChildren: 0.2,
    }
  }
};

const item = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

<motion.div variants={container} initial="hidden" animate="visible">
  <motion.div variants={item} />
  <motion.div variants={item} />
</motion.div>
```

## Testing Animations

### Manual Testing Checklist

- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test with reduced motion enabled (System Preferences → Accessibility)
- [ ] Test with slow network (throttle in DevTools)
- [ ] Test scroll performance (should maintain 60fps)
- [ ] Test keyboard navigation
- [ ] Test with screen reader (VoiceOver, NVDA)

### Performance Testing

```bash
# Run Lighthouse audit
npx lighthouse https://voxanne.ai --view

# Check animation performance
# Chrome DevTools → Performance → Record → Scroll/interact
# Look for green bars (60fps) not red (dropped frames)
```

### Browser Support

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅
- iOS Safari 14+ ✅
- Android Chrome 90+ ✅

## Quick Reference

### Import Paths
```typescript
// Animation library
import { easings, variants, springs, useReducedMotion } from '@/lib/animations';

// UI components
import FadeIn from '@/components/ui/FadeIn';
import TextReveal from '@/components/ui/TextReveal';
import ScrollProgress from '@/components/ui/ScrollProgress';
import StaggerGrid from '@/components/ui/StaggerGrid';
import { ParallaxSection, ParallaxImage } from '@/components/ParallaxSection';
```

### Common Patterns
```typescript
// 1. Fade in on scroll
<FadeIn><Content /></FadeIn>

// 2. Text reveal
<HeroTextReveal text="Headline" />

// 3. Stagger grid
<FeatureGrid>{items}</FeatureGrid>

// 4. Parallax
<ParallaxImage src="/img.png" alt="Feature" />

// 5. Hover effect
<motion.div whileHover={{ scale: 1.05 }}>Card</motion.div>
```

## Resources

- Framer Motion Docs: https://www.framer.com/motion/
- Animation Library: `src/lib/animations/index.ts`
- UI Components: `src/components/ui/`
- Brand Colors: From 9.png (#0015ff, #0a0e27, etc.)

---

**Remember:** Animations should enhance the user experience, not distract from it. When in doubt, animate less and focus on performance and accessibility.
