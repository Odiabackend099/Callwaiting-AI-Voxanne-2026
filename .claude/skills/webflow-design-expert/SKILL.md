---
name: webflow-design-expert
description: Expert in 2025 Webflow-style design, Framer Motion animations, parallax scrolling, and modern UI/UX patterns. Specializes in healthcare-appropriate animations with enterprise-grade performance optimization.
---

# Webflow Design Expert Skill

## Overview

Provides expert guidance on creating 2025 Webflow-style websites with advanced parallax scrolling, Framer Motion animations, and modern UI/UX patterns. Specialized for healthcare/medical contexts with accessibility-first approach.

## When to Use

Use this skill when:
- Creating Webflow-style parallax scrolling effects
- Implementing advanced Framer Motion animations
- Designing modern landing pages with scroll-driven animations
- Building enterprise-grade UI with micro-interactions
- Optimizing animation performance (60fps target)
- Ensuring WCAG AA accessibility compliance
- Integrating brand systems with motion design

## Core Principles

### 1. 2025 Webflow Design Standards

**Parallax Scrolling Patterns:**
```typescript
// Multi-layer parallax (3 layers minimum)
<ParallaxBackground speed={0.3}>  // Slowest (background)
  <GradientOrbs />
</ParallaxBackground>

<ParallaxBackground speed={0.5}>  // Medium (accents)
  <FloatingShapes />
</ParallaxBackground>

<ParallaxBackground speed={0.7}>  // Fastest (foreground)
  <AnimatedContent />
</ParallaxBackground>
```

**Sticky Scroll Sections:**
```typescript
// Campaign showcase style
<StickyScrollSection height="300vh">
  <div className="sticky top-0 h-screen">
    <ParallaxImage offset={50} />
    <RevealContent />
  </div>
</StickyScrollSection>
```

**Text Reveal Animations:**
```typescript
// Word-by-word reveal (Webflow signature)
<HeroTextReveal
  text="Your Headline Here"
  mode="words"              // chars | words
  variant="fadeUp"          // fadeUp | fadeScale | slideIn
  stagger={0.05}           // 50ms between words
  once={true}              // Trigger once per page load
/>
```

### 2. Framer Motion Best Practices

**GPU-Accelerated Properties (60fps):**
```typescript
// ✅ USE THESE (GPU-accelerated)
{
  opacity: 0,
  scale: 0.9,
  rotate: 45,
  x: 100,
  y: 50,
  filter: 'blur(10px)',
}

// ❌ AVOID THESE (cause reflow/repaint)
{
  width: '100%',
  height: '200px',
  top: '50px',
  left: '100px',
  margin: '20px',
  padding: '10px',
}
```

**Scroll-Driven Animations:**
```typescript
import { useScroll, useTransform } from 'framer-motion';

const { scrollYProgress } = useScroll({
  target: ref,
  offset: ["start end", "end start"]  // Trigger points
});

const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

<motion.div style={{ y, opacity }}>Content</motion.div>
```

**Stagger Animations:**
```typescript
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,      // 100ms between children
      delayChildren: 0.2,        // Initial delay
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<motion.div variants={container} initial="hidden" whileInView="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={item}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### 3. Healthcare-Appropriate Animations

**Professional Motion Design:**
- **Duration:** 0.4-0.8s maximum (professional, not flashy)
- **Easing:** Smooth, gentle curves (avoid bounce/elastic)
- **Colors:** Muted transitions (medical trust colors)
- **Attention:** Subtle, never distracting

**Medical-Specific Variants:**
```typescript
export const medicalVariants = {
  // Calm fade (subtle, professional)
  medicalFade: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
    }
  },

  // Pulse for live indicators (calls, status)
  pulse: {
    rest: { scale: 1 },
    active: {
      scale: [1, 1.05, 1],
      transition: { repeat: Infinity, duration: 1.5 }
    }
  },

  // Data reveal (charts, metrics)
  dataReveal: {
    hidden: { scaleY: 0, originY: 1 },
    visible: {
      scaleY: 1,
      transition: { duration: 0.8, ease: [0, 0, 0.2, 1] }
    }
  },
};
```

### 4. Performance Optimization

**GPU Acceleration:**
```css
/* Force GPU layer promotion */
.parallax-layer {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Remove after animation completes */
.animate-complete {
  will-change: auto;
}
```

**Conditional Animation Hook:**
```typescript
export function useOptimizedAnimation() {
  const reducedMotion = useReducedMotion();
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Check device capabilities
    const isHighPerformance = window.navigator.hardwareConcurrency > 2;
    const isGoodConnection = navigator.connection?.effectiveType !== 'slow-2g';

    // Only animate if device can handle it
    setShouldAnimate(
      !reducedMotion &&
      isHighPerformance &&
      isGoodConnection
    );
  }, [reducedMotion]);

  return shouldAnimate;
}

// Usage
const shouldAnimate = useOptimizedAnimation();

if (!shouldAnimate) {
  return <StaticVersion />;
}

return <AnimatedVersion />;
```

**Lazy Loading Animations:**
```typescript
// Only load when component enters viewport
const ParallaxSection = dynamic(
  () => import('@/components/ParallaxSection'),
  { ssr: false, loading: () => <StaticFallback /> }
);
```

### 5. Accessibility (WCAG AA)

**Reduced Motion Support:**
```typescript
import { useReducedMotion } from 'framer-motion';

function Component() {
  const reducedMotion = useReducedMotion();

  const variants = reducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
      }
    : {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 }
      };

  return <motion.div variants={variants} />;
}
```

**Focus States During Animations:**
```css
/* Visible focus indicators */
.animated-element:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
  transition: outline 0.2s ease;
  animation-play-state: paused; /* Pause animations on focus */
}
```

**Keyboard Navigation:**
```typescript
// Preserve focus during animations
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  onFocus={(e) => e.currentTarget.style.animationPlayState = 'paused'}
>
  Click me
</motion.button>
```

## Common Webflow Patterns

### Pattern 1: Hero with Multi-Layer Parallax

```typescript
function HeroWebflowStyle() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Layer 1: Slow gradient orbs */}
      <ParallaxBackground speed={0.3}>
        <GradientOrb position="top-left" color="blue" blur={120} />
        <GradientOrb position="bottom-right" color="purple" blur={100} />
      </ParallaxBackground>

      {/* Layer 2: Medium accent shapes */}
      <ParallaxBackground speed={0.5}>
        <FloatingShape type="circle" size={300} />
        <FloatingShape type="square" size={200} />
      </ParallaxBackground>

      {/* Layer 3: Content (fastest) */}
      <div className="relative z-10 container">
        <HeroTextReveal
          text="Your Headline Here"
          mode="words"
          stagger={0.05}
        />

        <FadeIn direction="up" delay={0.6}>
          <p className="subtitle">Supporting text</p>
        </FadeIn>

        <FadeIn direction="up" delay={0.8}>
          <MagneticButton>Call to Action</MagneticButton>
        </FadeIn>
      </div>
    </section>
  );
}
```

### Pattern 2: Features with Sticky Scroll

```typescript
function FeaturesWebflowStyle() {
  const features = [
    { id: 1, title: 'Feature 1', image: '/img1.png' },
    { id: 2, title: 'Feature 2', image: '/img2.png' },
    { id: 3, title: 'Feature 3', image: '/img3.png' },
  ];

  return (
    <section className="features-container">
      {features.map((feature, index) => (
        <StickyScrollSection key={feature.id} height="150vh">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Sticky image with parallax */}
            <ParallaxImage
              src={feature.image}
              alt={feature.title}
              offset={30}
              className="sticky top-32"
            />

            {/* Slide-in content */}
            <SlideInOnScroll
              direction={index % 2 === 0 ? 'left' : 'right'}
              delay={0.2}
            >
              <FeatureCard {...feature} />
            </SlideInOnScroll>
          </div>
        </StickyScrollSection>
      ))}
    </section>
  );
}
```

### Pattern 3: Pricing Cards with Glow Effect

```typescript
function PricingWebflowStyle() {
  return (
    <section className="pricing-section">
      <StaggerGrid
        columns={{ mobile: 1, tablet: 2, desktop: 3 }}
        stagger={0.15}
        variant="fadeScale"
      >
        {plans.map(plan => (
          <motion.div
            key={plan.id}
            className="pricing-card"
            whileHover={{
              scale: 1.02,
              boxShadow: '0 0 30px rgba(0, 21, 255, 0.3)',
            }}
            transition={{ duration: 0.3 }}
          >
            {/* Counter animation for price */}
            <CounterAnimation
              from={0}
              to={plan.price}
              duration={1.5}
              prefix="$"
              suffix="/mo"
            />

            {/* Features with stagger reveal */}
            <motion.ul
              initial="hidden"
              whileInView="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.1 }
                }
              }}
            >
              {plan.features.map(feature => (
                <motion.li
                  key={feature}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                >
                  {feature}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        ))}
      </StaggerGrid>
    </section>
  );
}
```

### Pattern 4: Animated Timeline

```typescript
function TimelineWebflowStyle() {
  const steps = [
    { id: 1, title: 'Step 1', description: 'First step' },
    { id: 2, title: 'Step 2', description: 'Second step' },
    { id: 3, title: 'Step 3', description: 'Third step' },
  ];

  return (
    <section className="timeline-container">
      {steps.map((step, index) => (
        <div key={step.id} className="timeline-item">
          {/* Animated line connector */}
          <motion.div
            className="timeline-line"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: index * 0.2 }}
          />

          {/* Step number with pulse */}
          <motion.div
            className="timeline-number"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: index * 0.2
            }}
          >
            {index + 1}
          </motion.div>

          {/* Content reveal */}
          <SlideInOnScroll direction="right" delay={index * 0.2 + 0.3}>
            <div className="timeline-content">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </SlideInOnScroll>
        </div>
      ))}
    </section>
  );
}
```

## Performance Checklist

### Before Launch
- [ ] All animations maintain 60fps (Chrome Performance tab)
- [ ] Reduced motion preference respected
- [ ] Mobile performance 85+ (Lighthouse)
- [ ] No layout shift during animations (CLS < 0.1)
- [ ] GPU acceleration enabled (`will-change` used correctly)
- [ ] Animation components lazy loaded
- [ ] Low-end devices show static fallback
- [ ] WCAG AA contrast ratios maintained
- [ ] Focus states visible during animations
- [ ] Keyboard navigation preserved

### Optimization Techniques
1. Use `transform` and `opacity` only (GPU-accelerated)
2. Enable `will-change` before animation, remove after
3. Lazy load animation components
4. Disable parallax on mobile
5. Throttle scroll events (max 60fps)
6. Use `useInView` with margin for early loading
7. Implement reduced motion fallback
8. Test on low-end Android devices

## Common Issues & Solutions

### Issue 1: Janky Parallax Scrolling

**Problem:** Parallax feels choppy, not smooth 60fps

**Solution:**
```typescript
// Use CSS transform instead of JS position updates
const y = useTransform(scrollYProgress, [0, 1], [0, 100]);

// ✅ Good (GPU-accelerated)
<motion.div style={{ y }}>Content</motion.div>

// ❌ Bad (causes reflow)
<motion.div style={{ top: `${scrollY * 0.5}px` }}>Content</motion.div>
```

### Issue 2: Text Reveal Not Working

**Problem:** Text reveal animation doesn't trigger

**Solution:**
```typescript
// Ensure parent has `overflow: hidden`
<div className="overflow-hidden">
  <HeroTextReveal text="Headline" />
</div>

// Use `once={false}` if you want re-triggering
<HeroTextReveal text="Headline" once={false} />
```

### Issue 3: High Memory Usage on Mobile

**Problem:** Mobile devices lag or crash

**Solution:**
```typescript
// Disable animations on low-end devices
const shouldAnimate = useOptimizedAnimation();

if (!shouldAnimate) {
  return <StaticVersion />;
}

// Or simplify animations for mobile
const isMobile = useMediaQuery('(max-width: 768px)');
const parallaxOffset = isMobile ? 0 : 0.5;
```

## Resources

- **Framer Motion Docs:** https://www.framer.com/motion/
- **Webflow Inspiration:** https://webflow.com/made-in-webflow
- **Animation Timing:** https://easings.net/
- **Performance Tools:** Chrome DevTools Performance tab
- **Accessibility:** WCAG 2.1 AA guidelines

---

**Remember:** In healthcare/medical contexts, animations should enhance trust and professionalism, never distract or feel gimmicky. Prioritize performance and accessibility over visual flair.

**Last Updated:** 2026-01-28
**Status:** Production-ready patterns for 2025 Webflow-style implementations
