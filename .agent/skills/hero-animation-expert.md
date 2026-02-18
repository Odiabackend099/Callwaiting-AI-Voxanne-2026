---
name: Hero Animation Expert
description: Expert guidelines for creating world-class, high-converting hero animations for AI SaaS products.
---

# Hero Animation Expert Skill

This skill provides expertise in designing and implementing premium hero animations that rival top AI companies (DeepMind, OpenAI, Anthropic).

## Core Principles

1. **Narrative-Driven Motion**: The animation must tell a story (e.g., "The problem -> The AI processing -> The resolution"). Random movement is noise; narrative movement is communication.
2. **Depth & Layering (2.5D/3D)**: Flat designs feel cheap. Use shadows, blur, parallax, and layering to create a sense of depth. Glassmorphism should be used strategically to show context behind elements.
3. **Fluid Micro-Interactions**: Elements should breathe. Use continuous, subtle floating animations even when static. Interactions should be physics-based (springs) rather than linear.
4. **Typing & Generative Effects**: For AI products, seeing the "thinking" process (streaming text, pulsing cursors, shimmering borders) builds trust in the intelligence of the system.
5. **Performance First**: 60fps is non-negotiable. Use `transform` and `opacity` only. Heavy effects (blur) should be used sparingly or pre-rendered if possible, though CSS backdrop-filter is acceptable on modern devices.

## Implementation Guide (React + Framer Motion)

### 1. The "breathing" effect

All floating cards should have a subtle random movement to feel alive.

```tsx
<motion.div
  animate={{ y: [0, -10, 0] }}
  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
/>
```

### 2. Glassmorphism Stack

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}
```

### 3. Gradient Borders (The "AI Glow")

Use conical gradients or moving background positions to create a "living" border effect that draws attention to active elements.

## Optimization Checklist

- [ ] Will-change property used for complex animations?
- [ ] Layout thrashing avoided?
- [ ] Colors accessible against dynamic backgrounds?
- [ ] Reduced motion preference respected?
