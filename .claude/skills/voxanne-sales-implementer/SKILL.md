---
name: voxanne-sales-implementer
description: Implements the Voxanne Sales System teardown, including copy updates, safety features (Safe Mode), and pricing restructuring. Use when applying the CEO-level feedback to the Voxanne website.
allowed-tools: ReplaceFileContent, MultiReplaceFileContent, ViewFile, RunCommand
---

# Voxanne Sales Implementer

## Description

This skill encapsulates the knowledge and steps required to transform the Voxanne website into a high-trust, safety-first sales machine based on the "CEO-level teardown" critique.

## Capabilities

- **Copy Rewrite**: Replaces generic AI claims with specific, safety-focused copy (e.g., "Medical Advice" -> "Safe Mode").
- **Component Creation**: Generates new React components for "Safe Mode", "Revenue Massacre", and "Proof" sections.
- **Safety Integration**: Inserts legal disclaimers and compliance badges.
- **Pricing Restructuring**: Implements the 3-tier pricing model (Essentials, Growth, Premium).

## Instructions for the Agent

When asked to "implement the Voxanne teardown" or similar:

1. **Analyze the Current State**:
    - specific focus on `src/app/page.tsx` and `src/components/Hero.tsx`.
    - Identify where "Medical Advice" claims exist and flag them for removal.

2. **Execute Phase 1: Trust & Safety (The Hero)**:
    - Rewrite `Hero.tsx` headline to "STOP LOSING £50,000+ EVERY YEAR".
    - Insert the `SafetyDisclaimer` component immediately below the hero.

3. **Execute Phase 2: The Logic (Pain & Solution)**:
    - Replace generic features with the "Silent Revenue Massacre" section.
    - Implement "Voxanne Safe Mode" explanation.

4. **Execute Phase 3: The Offer (Pricing & Guarantee)**:
    - Replace the existing pricing table with the explicit 3-tier model.
    - Add the "30-Day Money-Back Guarantee" section.

## Key Copy Substitutions

- **Bad**: "Answers medical questions"
- **Good**: "Escalates clinical questions to staff"
- **Bad**: "Handles emergencies"
- **Good**: "Instant transfer for emergencies"
- **Bad**: "AI Doctor"
- **Good**: "AI Receptionist with Safe Mode™"

## Verification

- Ensure NO medical advice is being offered by the AI in the copy.
- Check that the "Handoff Flow" is visually described or implemented.
