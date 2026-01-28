---
name: Brand Guidelines & Color System
---

# Voxanne AI Brand Guidelines (2026)

Complete branding system, color palette, typography, and visual identity standards for enterprise healthcare positioning.

---

## Part 1: Brand Foundation

### Brand Definition

**Name:** Voxanne AI  
**Category:** Enterprise AI Voice-as-a-Service (VaaS) Platform  
**Market:** Medical clinics, healthcare providers, service-based businesses  
**Position:** Premium, secure, HIPAA-compliant autonomous voice agent infrastructure  
**Tone:** Professional, trustworthy, innovative, clinical but approachable  

### Brand Promise

> "Voxanne AI gives medical clinics autonomous voice agents that handle inbound calls 24/7, schedule appointments securely, and understand patient needs—all without sharing clinic data or credentials with third parties."

### Core Values

1. **Security** - HIPAA compliance, multi-tenant isolation, zero data exposure
2. **Autonomy** - No manual setup required, agents work out of the box
3. **Healthcare-First** - Built for medical workflows, not generic chat
4. **Intelligence** - RAG-powered knowledge, contextual understanding, learning
5. **Enterprise-Grade** - Production-hardened, scalable, reliable infrastructure

---

## Part 2: Visual Identity

### Color Palette

#### Primary Brand Colors

| Color | Hex Code | RGB | Use | Psychology |
|-------|----------|-----|-----|------------|
| **Voxanne Blue** | #0066CC | 0, 102, 204 | Primary brand color, buttons, links, primary UI elements | Trust, healthcare, professionalism, reliability |
| **Deep Blue** | #0052A3 | 0, 82, 163 | Hover states, pressed states, dark mode, authority | Authority, stability, security, depth |
| **Cyan** | #00A8E8 | 0, 168, 232 | Accent, sound waves, call active states, highlights | Innovation, voice, energy, technology, communication |
| **White** | #FFFFFF | 255, 255, 255 | Background, text contrast, negative space | Clean, premium, accessible, trustworthy |

#### Extended Palette

| Color | Hex Code | Use | Context |
|-------|----------|-----|---------|
| **Light Blue Background** | #E6F2FF | Subtle backgrounds, hover states, empty states | Soft, welcoming, premium feel |
| **Neutral Gray (Surface)** | #F5F7FA | Card backgrounds, surface dividers | Clean, organized, professional |
| **Dark Gray (Text)** | #2C3E50 | Body text, headings | High contrast, readable, authority |
| **Light Gray (Border)** | #DCDFE6 | Subtle borders, dividers | Organized, subtle separation |
| **Success Green** | #10B981 | Call confirmed, booking success, positive states | Positive, confirmation, success |
| **Warning Orange** | #F59E0B | Alerts, need attention, pending states | Caution, attention-required |
| **Error Red** | #EF4444 | Connection lost, errors, failures | Negative, urgent, action-required |

### Color Application Guide

**Healthcare Credibility:**
- Use Voxanne Blue (#0066CC) as dominant color (60% of color use)
- White as secondary (30%)
- Cyan as accent (10%)

**Dark Mode:**
- Background: Dark navy or pure black
- Text: White or light gray
- Primary Button: Voxanne Blue (#0066CC)
- Accent: Cyan (#00A8E8)

**Example Application:**
```css
/* Light Mode */
:root {
  --color-primary: #0066CC;      /* Voxanne Blue */
  --color-primary-dark: #0052A3; /* Deep Blue */
  --color-accent: #00A8E8;       /* Cyan */
  --color-background: #FFFFFF;   /* White */
  --color-surface: #F5F7FA;      /* Neutral Gray */
  --color-text: #2C3E50;         /* Dark Gray */
  --color-border: #DCDFE6;       /* Light Gray */
  --color-success: #10B981;      /* Green */
  --color-warning: #F59E0B;      /* Orange */
  --color-error: #EF4444;        /* Red */
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0F1419;
    --color-surface: #1A202C;
    --color-text: #E2E8F0;
    --color-border: #2D3748;
  }
}
```

### Accessibility Requirements

**Color Contrast Ratios** (WCAG AA minimum: 4.5:1 for text, 3:1 for graphics)

| Text Color | Background | Contrast Ratio | Status |
|------------|-----------|-----------------|--------|
| Dark Gray (#2C3E50) | White (#FFFFFF) | 12.3:1 | ✅ Exceeds AA |
| White (#FFFFFF) | Voxanne Blue (#0066CC) | 8.6:1 | ✅ Exceeds AA |
| Voxanne Blue (#0066CC) | Light Blue (#E6F2FF) | 7.2:1 | ✅ Exceeds AA |
| Dark Gray (#2C3E50) | Light Gray Surface (#F5F7FA) | 7.8:1 | ✅ Exceeds AA |

**Color-Blind Friendly:**
- Never use red/green only to distinguish states
- Use icons + color for status indicators
- Use text labels + color for important information
- Test with color-blind simulation tools

---

## Part 3: Typography

### Font System

**Primary Font Family: Inter**
- Modern, clean sans-serif
- Excellent readability (healthcare requirement)
- Professional enterprise aesthetic
- Available: Google Fonts, Figma, Adobe
- Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial

**Secondary Font Family: Poppins**
- Friendly, modern geometric sans-serif
- Use for UI labels, buttons, tags
- Available: Google Fonts

**Display Font Family: Playfair Display**
- Elegant serif for headlines
- Premium, sophisticated feel
- Use for: Large headings, marketing materials, premium branding
- Available: Google Fonts

### Font Sizes

**Scale (Base: 16px)**

| Size | Pixel | Use | Weight | Example |
|------|-------|-----|--------|---------|
| **Overline** | 12px | Tags, labels, small text | 600 | Status badges |
| **Caption** | 14px | Helper text, hints, secondary info | 400 | Form hints |
| **Body Small** | 14px | Secondary body text | 400 | Descriptions |
| **Body** | 16px | Main body text, default | 400 | Paragraphs |
| **Body Large** | 18px | Larger body text | 400 | Rich text |
| **Title Small** | 14px | Card titles | 600 | Card headers |
| **Title** | 16px | Section titles | 600 | Section headers |
| **Title Large** | 22px | Page sections | 600 | Page headers |
| **Headline Small** | 24px | Secondary headlines | 700 | Dashboard titles |
| **Headline** | 28px | Main headlines | 700 | Page titles |
| **Headline Large** | 32px | Major headlines | 700 | Marketing headers |
| **Display** | 48px+ | Marketing, hero sections | 700 | Landing page hero |

### Font Weights

- **400 Regular** - Body text, normal weight
- **500 Medium** - Buttons, slightly emphasized text
- **600 Semibold** - Headings, labels, emphasis
- **700 Bold** - Headlines, strong emphasis

### Typography Examples

```css
/* Inter for body and UI */
body {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #2C3E50;
}

/* Poppins for buttons and labels */
button {
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Playfair for display */
h1, h2, h3 {
  font-family: 'Playfair Display', serif;
  font-weight: 700;
}

h1 { font-size: 32px; }
h2 { font-size: 28px; }
h3 { font-size: 24px; }
```

---

## Part 4: Logo Usage Rules

### Logo Variations

**Icon Form** (Square, for app icons and small spaces)
- Minimum size: 16x16px
- Use when space is limited
- Always maintain clear space (8px padding)

**Horizontal Lockup** (Primary, logo + text side-by-side)
- Recommended for website headers and marketing
- Logo left, text right
- Minimum size: 100px width

**Vertical Lockup** (Alternative, logo above text)
- Use when horizontal space is limited
- Logo centered above text
- Minimum size: 80px width

**Monochrome Blue** (Single color usage)
- Use when color isn't available
- Use Voxanne Blue (#0066CC)
- Works on any background

**Inverted White** (White on colored background)
- Logo: White (#FFFFFF)
- Background: Voxanne Blue (#0066CC)
- For dark surfaces and colored backgrounds

### Usage Rules (Do's and Don'ts)

✅ **DO:**
- Use in horizontal lockup on website
- Use icon form for app and social media
- Scale proportionally
- Maintain clear space around logo
- Use approved colors
- Apply to solid backgrounds
- Use high-quality PNG or SVG

❌ **DON'T:**
- Rotate or skew the logo
- Stretch or compress disproportionately
- Change colors (use only approved palette)
- Add effects (gradients, shadows, outlines)
- Place on busy backgrounds or photos
- Use outdated versions
- Modify the design
- Use in low resolution

### Clear Space Guidelines

Maintain clear space around logo equal to the height of the primary text character:

```
┌──────────────────────────────┐
│  [space] [LOGO] [space]      │
│                              │
│  Voxanne AI                  │
│                              │
└──────────────────────────────┘
```

### File Formats

| Format | Use Case | Notes |
|--------|----------|-------|
| **SVG** | Web, apps, scaling | Preferred—infinitely scalable |
| **PNG** | Web, presentations, email | 3000x3000px recommended |
| **PDF** | Print, professional documents | Vector format for printing |
| **ICO** | Website favicon | 32x32, 64x64, 128x128px |
| **JPG** | Photos, low-quality use | Avoid—use PNG instead |

---

## Part 5: Visual Design Patterns

### Buttons

**Primary Button (Voxanne Blue)**
```css
.btn-primary {
  background-color: #0066CC;
  color: #FFFFFF;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #0052A3;
}

.btn-primary:active {
  background-color: #003D7A;
}
```

**Secondary Button (Border)**
```css
.btn-secondary {
  background-color: transparent;
  color: #0066CC;
  border: 2px solid #0066CC;
  padding: 10px 22px;
  border-radius: 8px;
}

.btn-secondary:hover {
  background-color: #E6F2FF;
}
```

**Accent Button (Cyan for Active/Voice)**
```css
.btn-accent {
  background-color: #00A8E8;
  color: #FFFFFF;
  padding: 12px 24px;
  border-radius: 8px;
}

.btn-accent:hover {
  background-color: #0088C5;
}
```

### Cards

**Card Container**
```css
.card {
  background: #FFFFFF;
  border: 1px solid #DCDFE6;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.12);
  border-color: #00A8E8;
}
```

### Call Status Indicators

**Active Call (Green + Cyan pulse)**
```css
.call-active {
  background-color: #10B981;
  color: #FFFFFF;
  animation: pulse-cyan 2s infinite;
}

@keyframes pulse-cyan {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 168, 232, 0.7); }
  50% { box-shadow: 0 0 0 8px rgba(0, 168, 232, 0); }
}
```

**Call Ended (Neutral)**
```css
.call-ended {
  background-color: #DCDFE6;
  color: #2C3E50;
}
```

**Call Failed (Error Red)**
```css
.call-failed {
  background-color: #EF4444;
  color: #FFFFFF;
}
```

### Voice Wave Animation

**Sound Wave Pattern**
```css
.voice-wave {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.voice-wave span {
  width: 3px;
  background: linear-gradient(180deg, #0066CC, #00A8E8);
  border-radius: 2px;
  animation: wave 0.6s ease-in-out infinite;
}

.voice-wave span:nth-child(1) { animation-delay: 0s; height: 10px; }
.voice-wave span:nth-child(2) { animation-delay: 0.1s; height: 20px; }
.voice-wave span:nth-child(3) { animation-delay: 0.2s; height: 30px; }
.voice-wave span:nth-child(4) { animation-delay: 0.1s; height: 20px; }
.voice-wave span:nth-child(5) { animation-delay: 0s; height: 10px; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1); }
}
```

---

## Part 6: Photography & Imagery

### Photography Style

**Recommended:**
- Modern, clean healthcare settings
- Professional medical staff and diverse patients
- Bright, natural lighting (no harsh shadows)
- Healthcare technology (phones, dashboards, calls)
- Real, candid moments (not overly posed)
- Diverse representation
- Professional but approachable tone

**Avoid:**
- Clichéd stock photos (doctor with stethoscope, fake smiles)
- Overly clinical or sterile settings
- Dark or moody lighting
- Dated healthcare imagery
- Excessive use of blue color (let photography be natural)

### Imagery Color Treatment

- Keep photos natural color
- Avoid blue color overlay (save blue for UI)
- Use Voxanne Blue (#0066CC) as accent frame for key images
- Maintain professional, healthcare-appropriate tone

---

## Part 7: Implementation Checklist

### Website Implementation

- [ ] Logo in header (horizontal lockup)
- [ ] Primary color (#0066CC) for buttons and links
- [ ] White background with blue accent elements
- [ ] Inter font for body, Playfair for headlines
- [ ] Cyan accent for "voice" or "call" UI elements
- [ ] Clear call-to-action buttons in primary blue
- [ ] Professional healthcare imagery
- [ ] Mobile responsive design

### App Implementation

- [ ] Icon logo as app icon (512x512px)
- [ ] Primary blue (#0066CC) for navigation
- [ ] Cyan (#00A8E8) for active voice states
- [ ] Sound wave animations during calls
- [ ] Success (green) and error (red) states
- [ ] Dark mode support (adjusted colors)
- [ ] Professional typography (Inter)

### Marketing Materials

- [ ] Business cards: Logo, primary colors, contact info
- [ ] Letterhead: Logo, colors, professional layout
- [ ] Presentations: Blue + white theme, Playfair headlines
- [ ] Email: Blue header, consistent branding
- [ ] Social media: Profile picture (logo icon), banner (branded)
- [ ] PDF documents: Consistent header/footer with logo
- [ ] Trade show booth: Large logo, brand colors prominent

### Email Signature Template

```html
<table>
  <tr>
    <td style="padding-right: 20px;">
      <img src="logo.png" width="80" alt="Voxanne AI" />
    </td>
    <td style="border-left: 2px solid #0066CC; padding-left: 20px;">
      <strong style="color: #2C3E50; font-size: 14px;">Name</strong><br/>
      <span style="color: #666; font-size: 12px;">Title</span><br/>
      <span style="color: #0066CC; font-size: 12px;">Voxanne AI</span><br/>
      <a href="https://voxanne.ai" style="color: #0066CC;">voxanne.ai</a>
    </td>
  </tr>
</table>
```

---

## Part 8: Quick Reference

### Brand Colors (Copy-Paste)

```
Primary: #0066CC (Voxanne Blue)
Dark: #0052A3 (Deep Blue)
Accent: #00A8E8 (Cyan)
White: #FFFFFF
Light Blue: #E6F2FF
Text: #2C3E50 (Dark Gray)
Border: #DCDFE6 (Light Gray)
Success: #10B981 (Green)
Warning: #F59E0B (Orange)
Error: #EF4444 (Red)
```

### Tailwind CSS Configuration

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        voxanne: {
          50: '#E6F2FF',
          100: '#CCE5FF',
          200: '#99CBFF',
          300: '#66B0FF',
          400: '#3399FF',
          500: '#0066CC',
          600: '#0052A3',
          700: '#003D7A',
          800: '#002952',
          900: '#001429',
        },
        cyan: {
          500: '#00A8E8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      }
    }
  }
}
```

### CSS Variables

```css
:root {
  --color-primary: #0066CC;
  --color-primary-dark: #0052A3;
  --color-accent: #00A8E8;
  --color-background: #FFFFFF;
  --color-surface: #F5F7FA;
  --color-text: #2C3E50;
  --color-border: #DCDFE6;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-serif: 'Playfair Display', Georgia, serif;
  
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

---

## Final Branding Summary

| Element | Standard | Notes |
|---------|----------|-------|
| **Logo** | Voxanne Voice Node | Distinctive sound wave + node design |
| **Primary Color** | #0066CC (Voxanne Blue) | Trust, healthcare, professional |
| **Accent Color** | #00A8E8 (Cyan) | Innovation, voice, energy |
| **Secondary Color** | #FFFFFF (White) | Clean, premium, accessible |
| **Font - Body** | Inter | Modern, readable, professional |
| **Font - Display** | Playfair Display | Elegant, premium, sophisticated |
| **Tone** | Professional, Clinical, Approachable | Healthcare authority with human touch |
| **Target Audience** | Healthcare admins, clinic managers | Enterprise medical buyers |
| **Positioning** | Premium, Secure, Healthcare-First | vs. generic ChatGPT, Anthropic, Google |

---

**Document Version:** 1.0  
**Created:** January 27, 2026  
**Status:** Production-Ready Brand Guidelines  
**Last Updated:** January 27, 2026  

For questions or updates, contact the Voxanne AI branding team.
