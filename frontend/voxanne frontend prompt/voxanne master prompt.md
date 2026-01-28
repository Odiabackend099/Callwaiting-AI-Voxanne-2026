# Voxanne AI Website Rebuild - Master Prompt for Anti-Gravity IDE

## Project Context

Voxanne AI is a Voice-as-a-Service (VaaS) platform enabling healthcare organizations to deploy autonomous AI voice agents for inbound/outbound calls, appointment scheduling, and patient inquiries. The current website is inadequate for a 2026 production launch - it lacks motion design, trust signals, real integration logos, and premium UX.

**Target Audience:** Healthcare clinic owners, practice managers, medical office administrators  
**Brand Color:** Calendly Blue (#006BFF) + Clean White/Gray  
**Design Standard:** Calendly-quality, light mode, clinical trust aesthetic  
**Tech Stack:** Next.js 14+, Tailwind CSS, Framer Motion, TypeScript

---

## Critical Architecture Rules

### 1. **Brand Identity**

- **Primary Color:** #006BFF (Calendly Blue) - conveys trust, professionalism, healthcare credibility
- **Secondary Colors:**
  - Pure White: #FFFFFF (backgrounds)
  - Cool Gray: #F8FAFC (subtle sections)
  - Navy/Slate: #0F172A (headings)
  - Medium Gray: #64748B (body text)
  - Borders: #E2E8F0 (crisp, subtle)
- **Typography:**
  - Font Family: Inter (primary), Plus Jakarta Sans (alternative)
  - Headings: Bold, confident, tight tracking (-0.02em to -0.05em)
  - Body: Line-height 1.6-1.8 for medical readability
  - Size Scale: 16px base, 20px-72px range with 1.25 ratio

### 2. **"Clinical Trust" Visual System**

- **Light Mode Only:** Dark themes test poorly with healthcare decision-makers
- **Real Assets Over Abstractions:**
  - Use actual clinic interior photography (modern, clean, professional)
  - Show diverse medical staff in authentic settings
  - NO generic 3D robots, abstract AI nodes, or cyber aesthetics
- **Trust Signals Hierarchy:**
  1. HIPAA Compliance Badge (top priority)
  2. SOC 2 Type II Certification
  3. Integration Partner Logos (Twilio, Vapi, Supabase, Google Calendar, Salesforce, Calendly, Cal.com)
  4. Customer testimonials with real names + clinic names
  5. Uptime statistics (99.9%)

### 3. **Motion Design Philosophy: "Swiss Precision + Clinical Calm"**

#### **DO:**

- **Staggered Fade-In-Up** on scroll (Framer Motion with `staggerChildren: 0.1`)
- **Micro-interactions** on hover (scale: 1.02, subtle shadow increase)
- **Smooth page transitions** between routes (duration: 0.8s, ease: [0.16, 1, 0.3, 1])
- **Parallax scrolling** with 3 layers max (subtle depth, not distracting)

#### **DON'T:**

- No spinning 3D elements
- No glitch effects
- No jarring reloads or layout shifts
- No autoplay videos with sound
- No massive scaling on hover (>1.1x)

#### **Framer Motion Implementation Pattern:**

```tsx
// Use staggered reveal for sections
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
};
```

---

## Page-by-Page Specifications

### **Homepage (Landing Page)**

#### **Hero Section**

**Layout:** Split-screen (60/40 ratio)

- **Left (60%):**
  - Tagline badge: `HIPAA Compliant AI` (border, rounded-full, small caps)
  - Headline: "The AI Front Desk for Modern Clinics." (72px, Bold, Navy)
  - Subheadline: "Automate scheduling, answer patient queries, and reduce admin overhead with voice AI that sounds human and integrates with your EHR." (20px, Gray)
  - CTA Buttons (2):
    - Primary: "Get Started" (Blue, large, pill-shaped)
    - Secondary: "View Demo" (Outline, gray border)
- **Right (40%):**
  - High-quality clinic interior image (modern waiting room with subtle "Appointment Confirmed" toast overlay)
  - Animated appointment confirmation card (fade-in at 0.5s delay)

**Motion:**

- Tagline fades in immediately (delay: 0)
- Headline fades in 0.1s later with slight y-translate
- Subheadline 0.2s later
- Buttons 0.3s later
- Image parallax: moves 20% slower than scroll

#### **Trust Bar**

**Layout:** Full-width, light gray background (#F8FAFC)

- Text: "Trusted by 500+ clinics nationwide" (small, centered)
- Logos grid (6 logos, grayscale, hover color):
  - Twilio
  - Vapi
  - Supabase
  - Google Calendar
  - Salesforce
  - Calendly

**Implementation:**

- Download official SVG logos from each brand's press kit
- Apply `filter: grayscale(100%)` by default
- On hover: `filter: grayscale(0%)` + `scale(1.05)`

#### **Features Section ("Everything your front desk does. Just faster.")**

**Layout:** Bento Grid (CSS Grid, 4 cards, 2x2 on desktop, stacked mobile)

**Card 1: Automated Scheduling** (Spans 2 columns)

- Icon: Calendar with checkmark (Blue)
- Headline: "Automated Scheduling"
- Body: "Syncs directly with Google Calendar, Outlook, and major EHRs to book appointments in real-time without double-booking."
- Background: White with subtle border-radius (24px)
- Hover: Slight lift (translateY: -4px) + shadow increase

**Card 2: Patient Insights**

- Icon: Bar chart
- Headline: "Patient Insights"
- Body: "Analyze call sentiment and urgency to prioritize critical cases."

**Card 3: 24/7 Triage**

- Icon: Bolt/Lightning
- Headline: "24/7 Triage"
- Body: "Never miss a call. Handle after-hours inquiries with clinical precision."

**Card 4: Enterprise Security** (Spans 2 columns)

- Icon: Shield with lock
- Headline: "Enterprise Security"
- Body: "SOC2 Type II and HIPAA compliant. Your patient data is encrypted at rest and in transit."
- Trust badges: HIPAA + SOC2 icons (small, inline)

**Motion:**

- Cards stagger-in on scroll (0.1s delay each)
- Each card has `variants` for hover state

#### **Integration Showcase Section**

**Layout:** Center-aligned

- Headline: "Integrates with your existing stack"
- Subheadline: "No rip-and-replace. Voxanne connects to the tools you already use."
- Logo Grid (3 rows, 4 logos per row):
  - **Row 1 (Voice Infrastructure):** Twilio, Vapi, ElevenLabs, Vonage
  - **Row 2 (Calendars):** Google Calendar, Outlook, Calendly, Cal.com
  - **Row 3 (CRMs):** Salesforce, HubSpot, Pipedrive, Monday.com

**Visual Treatment:**

- Logos in white cards with subtle shadows
- Hover effect: Card lifts slightly + logo gets color
- Each logo has official SVG with proper sizing

#### **Social Proof Section (Testimonials)**

**Layout:** Carousel (3 testimonials, auto-rotate every 5s)

**Testimonial Structure:**

- Quote: "Voxanne cut our no-show rate by 40% and freed up 10 hours/week for our front desk staff."
- Attribution: "- Dr. Sarah Johnson, Clear Skin Dermatology, Los Angeles"
- Photo: Headshot (circular, 80px)
- Star rating: 5 stars (gold)

**Design:**

- Light background card
- Quote in larger italic font
- Subtle fade transition between testimonials

#### **Pricing Section**

**Layout:** 3-column grid (cards side-by-side)

**Plans:**

1. **Starter** - $99/mo
   - 500 calls/month
   - Google Calendar integration
   - Basic analytics
2. **Professional** - $299/mo (Most Popular badge)
   - 2,000 calls/month
   - EHR integration
   - Advanced analytics
   - Custom voice
3. **Enterprise** - Custom pricing
   - Unlimited calls
   - White-glove onboarding
   - Dedicated success manager
   - SLA guarantees

**CTA per card:** "Start Free Trial" / "Contact Sales"

#### **FAQ Section**

**Layout:** Accordion (12 questions, modeled after best healthcare sites 2026)

**Questions:**

1. What is Voxanne AI?
2. How is Voxanne different from traditional IVR systems?
3. Is Voxanne HIPAA compliant?
4. Can Voxanne integrate with my existing calendar system?
5. What industries does Voxanne serve?
6. How long does setup take?
7. Can I customize Voxanne's voice and personality?
8. What happens if Voxanne can't answer a question?
9. How do I update Voxanne's knowledge base?
10. What's your pricing model?
11. Do you offer a free trial?
12. Can I migrate from my current provider?

**Design:**

- Clean accordion with blue chevron icons
- Answer text: Gray, readable line-height
- Smooth expand/collapse animation (Framer Motion)

#### **Contact Section**

**Layout:** 2-column (info left, form right)

**Left Column:**

- Headline: "Ready to transform your clinic's front desk?"
- Contact info:
  - Email: <hello@voxanne.ai> (with mail icon)
  - Phone: +44 20 1234 5678 (with phone icon)
  - Address: 20 AI Innovation Way, London, UK (with map pin icon)

**Right Column:**

- Form fields:
  - Name (required)
  - Email (required)
  - Phone (optional)
  - Message (textarea, required)
- Submit button: "Send Message" (Blue, full width)

**Validation:**

- Real-time email validation
- Error states with red border + message
- Success toast on submission

#### **Footer**

**Layout:** 4-column grid

**Column 1: Voxanne AI**

- Logo + tagline
- "The Voice of Your Business, Powered by Intelligence."

**Column 2: Product**

- Features
- Pricing
- Integrations
- Security

**Column 3: Company**

- About
- Team
- Careers
- Contact

**Column 4: Legal**

- Privacy Policy
- Terms of Service
- HIPAA Compliance

**Bottom Bar:**

- Copyright: "© 2026 Voxanne AI. All rights reserved."
- Link: "Product of Call Waiting AI"

---

### **Login Page**

**CRITICAL:** Replace the existing poor login design with the approved "Voxanne copy.ai" design from screenshots.

#### **Layout: Split-Screen (50/50)**

**Left Column (White background):**

- **Back Navigation:** "← Back to Voxanne" (top-left, subtle link)
- **Icon Badge:** Lock icon in light blue circle (surgical-50 background)
- **Headline:** "Welcome Back" (48px, Bold, Navy)
- **Tagline:** "Secure access for clinical staff" (18px, Gray)
- **Form:**
  - Email input (label: "Email address")
  - Password input (label: "Password", type="password", eye icon toggle)
  - "Forgot password?" link (right-aligned, small, blue)
  - "Sign In" button (Blue, full width, large)
- **Divider:** "OR" (center, with lines)
- **Google OAuth:** Button with Google logo SVG + "Continue with Google"
- **Footer:** "Don't have an account? Contact Sales" (gray, centered)

**Right Column (Navy-900 background with gradient overlay):**

- **Background:** Dark navy (#0F172A) with radial gradient overlay
- **Texture:** Subtle dot pattern (20% opacity, `radial-gradient`)
- **Content (centered, white text):**
  - Quote: "The most trusted voice AI for medical professionals."
  - Attribution: "— Healthcare Leaders Survey 2025"
  - Social Proof: "Join 500+ clinics automating their front desk"

**Mobile Responsive:**

- Hide right column on mobile (<768px)
- Single-column login form centered

---

## Trust Signal Implementation Checklist

### **Integration Partner Logos (Download from official sources):**

1. **Twilio**
   - URL: <https://www.twilio.com/company/brand>
   - Format: SVG
   - Usage: Dark/light versions
   - Placement: Trust bar, Integration section

2. **Vapi**
   - URL: <https://vapi.ai> (check press kit / brand assets page)
   - Format: SVG
   - Placement: Hero testimonial, Integration section

3. **Supabase**
   - URL: <https://supabase.com/brand-assets>
   - Format: SVG (with/without wordmark)
   - Placement: Integration section

4. **Google Calendar**
   - URL: <https://developers.google.com/style/images/logos>
   - Format: PNG/SVG
   - Placement: Integration section, Features

5. **Salesforce**
   - URL: <https://www.salesforce.com/news/resources/media-resources>
   - Format: SVG
   - Placement: Integration section

6. **Calendly**
   - URL: <https://calendly.com/press> (brand assets)
   - Format: SVG
   - Placement: Integration section

7. **Cal.com**
   - URL: <https://cal.com/press>
   - Format: SVG
   - Placement: Integration section

### **Compliance Badges:**

1. **HIPAA Compliance Badge**
   - Source: Compliancy Group or Accountable
   - Format: SVG/PNG
   - Placement: Hero section badge, Footer, Features card
   - Badge text: "HIPAA Compliant" with shield icon

2. **SOC 2 Type II**
   - Source: Vanta or Drata (compliance monitoring providers)
   - Format: SVG badge
   - Placement: Features security card, Footer
   - Badge text: "SOC 2 Type II Certified"

**Custom Badge Implementation (if official badges not available):**

```tsx
// HIPAA Badge Component
<div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
  <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
  <span className="text-sm font-medium text-blue-900">HIPAA Compliant</span>
</div>
```

---

## Technical Implementation Guide

### **File Structure**

```
src/
├── app/
│   ├── page.tsx                    # Homepage
│   ├── login/page.tsx              # New login design
│   └── layout.tsx                  # Root layout
├── components/
│   ├── Hero.tsx                    # Hero section with motion
│   ├── TrustBar.tsx                # Partner logos
│   ├── Features.tsx                # Bento grid cards
│   ├── Integrations.tsx            # Logo grid
│   ├── Testimonials.tsx            # Carousel
│   ├── Pricing.tsx                 # 3-tier cards
│   ├── FAQ.tsx                     # Accordion
│   ├── Contact.tsx                 # Form + info
│   ├── Footer.tsx                  # Site footer
│   ├── Navbar.tsx                  # Main navigation
│   └── ui/
│       ├── FadeIn.tsx              # Reusable fade-in wrapper
│       ├── Button.tsx              # Primary/secondary/outline
│       ├── Input.tsx               # Form input
│       ├── Textarea.tsx            # Form textarea
│       └── Badge.tsx               # Trust badges
├── lib/
│   └── animations.ts               # Framer Motion variants
└── public/
    ├── logos/                      # Partner logos (SVG)
    │   ├── twilio.svg
    │   ├── vapi.svg
    │   ├── supabase.svg
    │   ├── google-calendar.svg
    │   ├── salesforce.svg
    │   ├── calendly.svg
    │   └── cal-com.svg
    ├── badges/                     # Compliance badges
    │   ├── hipaa.svg
    │   └── soc2.svg
    └── images/
        ├── clinic-interior.jpg     # Hero image
        ├── clinic-waiting-room.jpg
        └── team-headshots/         # Testimonial photos
```

### **Framer Motion Animation Library**

**File:** `src/lib/animations.ts`

```typescript
export const AG_EASE = [0.16, 1, 0.3, 1]; // "Anti-Gravity" cubic-bezier
export const AG_DURATION = 0.8;

export const fadeInUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { duration: AG_DURATION, ease: AG_EASE }
  }
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

export const scaleOnHover = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.3, ease: "easeOut" }
  }
};
```

### **Reusable FadeIn Component**

**File:** `src/components/ui/FadeIn.tsx`

```tsx
"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export default function FadeIn({ children, className, delay = 0 }: FadeInProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={isInView ? { 
        opacity: 1, 
        y: 0, 
        filter: "blur(0px)" 
      } : {}}
      transition={{
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
        delay: delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

### **Usage Example (Hero Section)**

```tsx
// src/components/Hero.tsx
import FadeIn from '@/components/ui/FadeIn';

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-b from-white via-slate-50/30 to-white">
      <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12">
        {/* Left Column */}
        <div>
          <FadeIn>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-900">
              <ShieldCheckIcon className="h-4 w-4" />
              HIPAA Compliant AI
            </span>
          </FadeIn>
          
          <FadeIn delay={0.1}>
            <h1 className="mt-6 text-6xl lg:text-7xl font-bold tracking-tight text-navy-900">
              The AI Front Desk for <br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                Modern Clinics.
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              Automate scheduling, answer patient queries, and reduce admin 
              overhead with voice AI that sounds human and integrates with your EHR.
            </p>
          </FadeIn>

          <FadeIn delay={0.3} className="flex gap-4 mt-10">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
            <Button size="lg" variant="outline">
              View Demo
            </Button>
          </FadeIn>
        </div>

        {/* Right Column */}
        <FadeIn delay={0.4}>
          <div className="relative">
            <img 
              src="/images/clinic-interior.jpg" 
              alt="Modern clinic waiting room" 
              className="rounded-3xl shadow-2xl"
            />
            {/* Floating appointment card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/20"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Appointment Confirmed</p>
                  <p className="text-sm text-gray-600">Dr. Smith • Tomorrow at 2:00 PM</p>
                </div>
              </div>
            </motion.div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
```

---

## Performance Optimization Checklist

### **Image Optimization**

- Use Next.js `<Image>` component for all images
- Provide width/height to prevent layout shift
- Use WebP format with PNG fallback
- Lazy load below-the-fold images
- Compress images to <200KB (use imagecompressor.com)

### **Font Loading**

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap', // Prevent invisible text during font load
  preload: true
});
```

### **Animation Performance**

- Use `transform` and `opacity` only (GPU-accelerated)
- Add `will-change: transform` for frequently animated elements
- Use `useReducedMotion` hook to respect user preferences:

```tsx
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();
const transition = shouldReduceMotion ? { duration: 0 } : { duration: 0.8 };
```

### **Accessibility (WCAG AA)**

- All interactive elements have focus states
- Color contrast ratio ≥4.5:1 for body text
- Color contrast ratio ≥3:1 for large text (18px+)
- All images have descriptive alt text
- Form inputs have persistent labels (not placeholders)
- Keyboard navigation works for all interactions

---

## Mobile Responsiveness

### **Breakpoints (Tailwind)**

```css
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Desktops */
xl: 1280px  /* Large desktops */
2xl: 1536px /* Extra large */
```

### **Mobile-Specific Adjustments**

- **Hero:** Stack vertically (image on top, content below)
- **Features:** Single column grid
- **Integration Logos:** 2-column grid (was 4)
- **Pricing:** Vertical cards with "Scroll →" hint
- **Login:** Hide right column entirely

---

## Content Writing Guidelines

### **Tone of Voice**

- **Professional but approachable:** Not overly technical
- **Confident without arrogance:** "Transform your clinic" not "Revolutionize healthcare"
- **Human-centered:** Focus on staff time saved, patient satisfaction
- **Specific over vague:** "Cut no-show rates by 40%" not "Improve operations"

### **Headlines Formula**

- **Hero:** [Problem solved] for [Target audience]
  - Example: "The AI Front Desk for Modern Clinics"
- **Features:** [Action verb] + [Outcome]
  - Example: "Automate Scheduling Without Double-Booking"

### **Call-to-Action Hierarchy**

1. **Primary:** "Get Started" / "Start Free Trial" (Blue button)
2. **Secondary:** "View Demo" / "Watch Video" (Outline button)
3. **Tertiary:** "Learn More" / "Contact Sales" (Text link)

---

## SEO Optimization

### **Meta Tags (Homepage)**

```html
<title>Voxanne AI - Voice AI for Healthcare | HIPAA-Compliant Scheduling</title>
<meta name="description" content="Automate your clinic's front desk with Voxanne AI. HIPAA-compliant voice AI that handles scheduling, patient inquiries, and reduces no-shows by 40%." />
<meta property="og:image" content="/og-image.png" />
<link rel="canonical" href="https://voxanne.ai" />
```

### **Structured Data (JSON-LD)**

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Voxanne AI",
  "applicationCategory": "Healthcare Software",
  "offers": {
    "@type": "Offer",
    "price": "99",
    "priceCurrency": "USD",
    "priceValidUntil": "2027-01-01"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "127"
  }
}
```

---

## Testing Checklist Before Launch

### **Functionality**

- [ ] All links work (no 404s)
- [ ] Forms submit successfully
- [ ] Buttons trigger correct actions
- [ ] Login authenticates properly (Supabase Auth)
- [ ] Mobile menu opens/closes

### **Design**

- [ ] All images load (no broken images)
- [ ] Logos display correctly (SVG format)
- [ ] Trust badges visible
- [ ] Colors match brand (#006BFF)
- [ ] Fonts load properly (Inter)

### **Motion**

- [ ] Hero elements stagger-in on page load
- [ ] Features cards fade-in on scroll
- [ ] Hover states work on cards/buttons
- [ ] Page transitions smooth (no flicker)
- [ ] Parallax doesn't cause motion sickness

### **Performance**

- [ ] Lighthouse score >90 (Performance)
- [ ] First Contentful Paint <1.5s
- [ ] Largest Contentful Paint <2.5s
- [ ] Cumulative Layout Shift <0.1

### **Accessibility**

- [ ] Tab navigation works through entire page
- [ ] Focus indicators visible
- [ ] Screen reader compatibility (NVDA/JAWS tested)
- [ ] Color contrast passes WCAG AA

### **Cross-Browser**

- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Final Notes for Anti-Gravity

### **Priorities (Build in this order):**

1. **Homepage Hero + Trust Bar** (Day 1) - First impression is everything
2. **Features Section** (Day 1) - Core value prop
3. **Login Page Replacement** (Day 2) - Critical for production
4. **Integration + Pricing** (Day 2-3) - Revenue generation
5. **Testimonials + FAQ** (Day 3) - Trust building
6. **Contact + Footer** (Day 3) - Lead capture

### **What NOT to Build:**

- ❌ Dark mode toggle (not needed for healthcare)
- ❌ Blog section (not in current scope)
- ❌ Multi-language support (English only for MVP)
- ❌ Video autoplay (causes accessibility issues)

### **Post-Launch Enhancements (Phase 2):**

- Interactive product demo (embedded iframe)
- Customer success stories page
- ROI calculator widget
- Live chat integration (Intercom/Drift)
- A/B testing framework (Vercel Edge Config)

---

## References & Inspiration

**Top Healthcare AI Websites (2026):**

- DrDoctor: Fresh green + purple, glassmorphism, brush stroke brand elements
- Maven Clinic: Calm green palette, sticky navigation, 2000+ partners displayed
- Athenahealth: Clinical imagery, AI-native positioning
- Tia Health: Pink/cream color scheme, table comparison of services

**B2B SaaS Design Leaders:**

- Notion: Story-driven hero, product-first visuals
- Linear: Subtle motion, interface previews
- Calendly: Split layout, problem/solution framing
- Slack: Bento grids, multiple user personas

**Login Page Inspiration:**

- Stripe: Split-screen, minimal left, visual right
- Notion: Clean form, persistent labels, SSO prominent
- Linear: Dark theme option, smooth transitions

---

## Success Metrics

**After deploying the new website, track:**

1. **Conversion Rate:** Homepage → Trial signup (Target: >3.8%)
2. **Bounce Rate:** <40% (industry benchmark)
3. **Time on Page:** >90 seconds (indicates engagement)
4. **Demo Requests:** 10+ per week
5. **Lighthouse Score:** >90 across all categories

---

## Contact for Questions

If Anti-Gravity needs clarification on:

- **Design decisions:** Reference Calendly screenshot + clinical-web-designer skill
- **Motion implementation:** Reference Framer Motion code examples above
- **Trust signals:** Download logos from official brand asset pages listed
- **Technical stack:** Next.js 14+ with App Router, TypeScript, Tailwind v3.4+

**Final Instruction:** Build a website that makes healthcare clinic owners think "This is the company I can trust with my patients' experience." Clean, professional, trustworthy, and undeniably premium.
