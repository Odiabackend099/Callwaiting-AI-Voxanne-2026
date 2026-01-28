---
name: clinical-web-designer
description: Design and build high-trust, clinical-grade websites for healthcare AI. Use when the user wants a "Calendly-like" aesthetic, light mode, or a trusted medical look.
---

# Clinical Web Designer Skill

This skill guides you to create a premium, high-trust website for the healthcare industry. The aesthetic is "Clinical Trust": clean, white, bright, with specific blue accents (Calendly Blue: `#006BFF`), avoiding dark mode which clinics often find untrustworthy.

## Phase 1: Research & Strategy (Mandatory)

Before writing any code, you MUST ask yourself these 10 questions and research the answers:

1. **Trust Signals**: What specific visual cues do doctors/clinics trust in 2026? (e.g., specific certifications, clean typography, white space).
2. **Color Psychology**: Why is `#006BFF` (Calendly Blue) effective? How does it pair with white/gray for a "sterile but warm" look?
3. **Motion**: How can we use motion to feel "efficient" rather than "flashy"? (e.g., smooth transitions, no jarring jumps).
4. **Imagery**: What kind of imagery resonates? (Real clinic interiors, diverse medical staff, no generic 3D bots).
5. **Competitors**: What are top UK/US health-tech sites doing right? (e.g., Doctolib, Zocdoc).
6. **Typography**: What font pairings scream "professional"? (e.g., Inter, Plus Jakarta Sans).
7. **Layout**: How does a "Bento" grid work in a light, clinical context? (Soft shadows, distinct borders).
8. **Navigation**: Is the path to "Login" and "Get Started" frictionless?
9. **Mobile**: How does this translate to a doctor's iPad or phone?
10. **Performance**: Is it instant? (Clinics have no patience for loading).

## Phase 2: Design Specifications

### 1. The "Clinical Trust" Palette

- **Background**: Pure White (`#FFFFFF`) or extremely subtle cool gray (`#F8FAFC`).
- **Primary Accent**: Calendly Blue (`#006BFF`). Use for primary buttons and key highlights.
- **Text**: Navy/Slate (`#0F172A`) for headings, Cool Gray (`#64748B`) for body. **NEVER** pure black.
- **Borders**: Subtle, crisp borders (`#E2E8F0`).

### 2. Typography

- **Headings**: Clean, sans-serif, confident. (e.g., `Inter`, `Plus Jakarta Sans`).
- **Body**: Highly readable, generous line height.

### 3. Imagery & Assets

- **Use Real Assets**: Use `clinic-interior.png`, `roxan_voice_interface.png` from `public/`.
- **Avoid**: Generic "AI Brain" nodes, dark cyber aesthetics, glitch effects.

### 4. Motion (Framer Motion)

- **Feel**: "Professional Polish".
- **Transitions**: Smooth fades, slight slides up (`y: 20 -> y: 0`).
- **Hover**: Subtle lift or shadow increase. No massive scaling.

## Phase 3: Implementation Rules

1. **Mobile First**: Ensure responsiveness.
2. **Accessibility**: WCAG AA standard (contrast ratios are critical in healthcare).
3. **Components**: Build reusable, clean components (`TrustBadge`, `ClinicalCard`, `TestimonialCarousel`).

## Example Prompt to Self

> "I need to redesign the login page.
> *Research*: Clinics value security.
> *Design*: Split layout. Left side: High-quality clinic image with a 'Secure' badge. Right side: Clean white form, blue primary button.
> *Motion*: Form fades in gently. No spinning 3D elements."
