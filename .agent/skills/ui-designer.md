---
name: ui-ux-designer
description: Design and implement high-quality, industry-standard UI/UX for web applications. Use when the user requests UI improvements, redesigns, or "best practice" layouts.
---

# UI/UX Designer Skill

## Purpose

To transform generic or functional interfaces into polished, professional, and user-friendly experiences that adhere to modern design standards (e.g., Shadcn UI, Tailwind CSS, Glassmorphism).

## Core Principles

1. **Visual Hierarchy**: Use typography, color, and spacing to guide the user's eye. Important elements (CTAs) should stand out.
2. **Layout Structure**: Use grids and flexbox to create organized, balanced layouts. Avoid "walls of text" or linear vertical stacking for complex forms.
3. **Feedback & State**: Always show loading states, success messages, and error states clearly.
4. **Aesthetics**: Use modern color palettes (slate, emerald, indigo), rounded corners, subtle shadows, and backdrop blurs (glassmorphism) to create a premium feel.
5. **Responsiveness**: Ensure designs work on mobile and desktop.

## Instructions for Agent Configuration Redesign

### 1. Layout Strategy

- **Split View**: Use a 2-column layout for desktop.
  - **Left Column**: Configuration & Settings (Voice, Phone Number, Language, Duration).
  - **Right Column**: Content & Behavior (System Prompt, First Message, Templates).
- **Card-Based Design**: Group related fields into distinct cards with headers and icons.
- **Sticky Actions**: Keep the "Save" button accessible, potentially in a sticky header or clearly visible top-right area.

### 2. Component Guidelines

- **Template Selector**: Instead of a simple dropdown, use a visual grid or list of cards for templates, allowing users to preview the description before selecting.
- **Inputs**: Use styled inputs with focus rings. Textareas should have ample space.
- **Buttons**: Use semantic colors (Blue/Indigo for primary, Emerald for success, Red for destructive). Add icons to buttons.

### 3. "Best Practice" Features

- **Quick Actions**: Add buttons to "Load Best Practice Template" or "Reset to Default".
- **Inline Tips**: Add helper text or tooltips explaining *why* a setting matters (e.g., "System Prompt defines the agent's personality").

## Example Code Snippet (Tailwind)

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  {/* Left Sidebar - Settings */}
  <div className="lg:col-span-1 space-y-6">
    <Card title="Voice Settings" icon={<Volume2 />}>
       {/* Inputs */}
    </Card>
    <Card title="Telephony" icon={<Phone />}>
       {/* Inputs */}
    </Card>
  </div>

  {/* Right Content - Prompts */}
  <div className="lg:col-span-2 space-y-6">
    <Card title="Agent Behavior" icon={<Bot />}>
       <TemplateSelector />
       <PromptEditor />
    </Card>
  </div>
</div>
```
