---
name: pwa-mobile-optimization
description: AI industry benchmark standard PWA and mobile-first UX optimization expert. Enforces 2026 PWA best practices, offline-first architecture, mobile performance optimization, touch interactions, and native app-like experiences. Use when optimizing for mobile, implementing PWA features, or ensuring mobile accessibility.
---

# PWA & Mobile Optimization Expert Skill

## Overview

Comprehensive guide for transforming web applications into production-grade Progressive Web Apps with native app-like experiences, optimized for mobile devices, following 2026 industry standards.

## When to Use

Use this skill when:
- Implementing PWA features (manifest, service workers, offline mode)
- Optimizing mobile performance (Core Web Vitals, lazy loading)
- Creating mobile-first responsive designs
- Implementing touch interactions and gestures
- Adding install prompts and app shortcuts
- Optimizing for low-bandwidth networks
- Implementing background sync and push notifications
- Ensuring mobile accessibility
- Debugging mobile-specific issues

## PWA Core Features Checklist

### 1. Web App Manifest (manifest.json)

**Location:** `/public/manifest.json`

**Required Fields:**
- name, short_name, description
- start_url, display, scope
- background_color, theme_color
- icons (192x192 and 512x512 minimum)
- shortcuts (max 4 recommended)
- screenshots (desktop + mobile)
- categories, orientation

**Manifest Best Practices:**
- ✅ Include 192x192 and 512x512 icons (minimum required)
- ✅ Add maskable icons for Android adaptive icons
- ✅ Provide shortcuts for quick actions (max 4)
- ✅ Include screenshots for app store-like experience
- ✅ Set display: "standalone" for app-like experience
- ✅ Match theme_color to brand color
- ✅ Use descriptive name and short_name

### 2. Service Worker Best Practices

**Caching Strategies:**
- **CacheFirst:** Fonts, media (rarely change, serve from cache)
- **StaleWhileRevalidate:** Images, JS/CSS (balance freshness + speed)
- **NetworkFirst:** API calls, pages (prefer fresh data, fallback to cache)

**Configuration:**
- ✅ Enable in production, optional in development
- ✅ Set skipWaiting: true for immediate updates
- ✅ Configure runtime caching for fonts, images, assets
- ✅ Set up fallback routes (offline page, offline image)
- ✅ Exclude build manifests from caching

### 3. Offline Support

**Requirements:**
- Offline fallback page (/offline)
- Cached static assets
- Network status indicator
- Graceful degradation for features requiring connectivity

**Offline Page Checklist:**
- ✅ Clear "You're Offline" messaging
- ✅ Retry/refresh button
- ✅ Navigation to cached pages
- ✅ Emergency contact information
- ✅ Branded, styled consistently

## Mobile Performance Optimization

### Core Web Vitals Targets

| Metric | Target | Critical For |
|--------|--------|--------------|
| LCP (Largest Contentful Paint) | <2.5s | Loading performance |
| FID (First Input Delay) | <100ms | Interactivity |
| CLS (Cumulative Layout Shift) | <0.1 | Visual stability |
| FCP (First Contentful Paint) | <1.8s | Perceived speed |
| TTI (Time to Interactive) | <3.8s | Usability |
| TBT (Total Blocking Time) | <200ms | Responsiveness |

### Image Optimization Checklist

- ✅ Use Next.js Image component (automatic WebP/AVIF)
- ✅ Set explicit width/height (prevents CLS)
- ✅ Use priority for above-the-fold images
- ✅ Use loading="lazy" for below-the-fold images
- ✅ Optimize quality (75-85 is usually sufficient)
- ✅ Use responsive sizes attribute
- ✅ Provide blur placeholder for smooth loading

### Font Optimization

- ✅ Use next/font for automatic optimization
- ✅ Set display: 'swap' to prevent FOIT
- ✅ Subset fonts to 'latin' (smaller file size)
- ✅ Limit font weights to only what's needed
- ✅ Preload critical fonts

### Code Splitting & Lazy Loading

- ✅ Use dynamic imports for heavy components
- ✅ Add loading states/skeleton screens
- ✅ Disable SSR for client-only components
- ✅ Prefetch critical routes
- ✅ Disable prefetch for less critical routes

### Resource Hints

- ✅ dns-prefetch for API domains
- ✅ preconnect for external resources
- ✅ preconnect for fonts (Google Fonts, etc.)

## Mobile-First Responsive Design

### Tailwind Breakpoints Strategy

```css
/* Mobile-first approach */
sm: 640px   /* Mobile landscape, small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Common Patterns

```typescript
// Stack on mobile, grid on desktop
<div className="flex flex-col md:flex-row gap-4">

// Hide on mobile, show on desktop
<div className="hidden md:block">

// Show on mobile, hide on desktop
<div className="block md:hidden">

// Responsive text sizes
<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">

// Responsive grid columns
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

### Touch-Optimized Interactions

**Minimum Touch Target Size:**
- Apple HIG: 44x44px
- Material Design: 48x48px

**Implementation:**
```typescript
// Touch-friendly button
<button className="min-h-12 min-w-12 px-6 py-3 text-base font-medium rounded-lg active:scale-95 transition-transform">

// Touch-friendly list items
<button className="min-h-14 px-4 flex items-center gap-3 active:bg-surgical-50 transition-colors">
```

### Haptic Feedback

**When to use:**
- Button/link taps
- Swipe gesture completion
- Success/error confirmations
- Toggle switches

**Implementation:**
```typescript
import { haptics } from '@/lib/haptics';

<button onClick={() => {
  haptics.light();
  handleClick();
}}>
```

**Patterns:**
- light: Quick feedback (10ms)
- medium: Standard interaction (20ms)
- heavy: Important action (50ms)
- success: [10ms, pause, 50ms, pause, 10ms]
- error: [50ms, pause, 100ms, pause, 50ms]

### Pull-to-Refresh

**Best Practices:**
- Pull threshold: 100px
- Show visual feedback (spinner icon)
- Add haptic feedback on threshold reach
- Integrate with data revalidation (SWR)
- Reset position after refresh

## Accessibility (A11Y) Best Practices

### Keyboard Navigation

- ✅ Skip to main content link
- ✅ Focus visible states (ring-2, ring-surgical-500)
- ✅ Logical tab order
- ✅ Keyboard shortcuts documented

### Screen Reader Support

- ✅ ARIA labels for icon-only buttons
- ✅ ARIA live regions for dynamic content
- ✅ ARIA expanded for accordions/collapsibles
- ✅ Proper heading hierarchy (h1 → h2 → h3)

### Color Contrast (WCAG AA)

- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**Clinical Trust Palette Compliance:**
- bg-white + text-obsidian: 19:1 ✅
- bg-surgical-600 + text-white: 7.2:1 ✅
- bg-surgical-50 + text-surgical-200: 1.8:1 ❌ (avoid)

### Form Accessibility

- ✅ Proper label associations (htmlFor/id)
- ✅ Required field indicators (aria-required)
- ✅ Error messages (aria-invalid, aria-describedby)
- ✅ Autocomplete attributes
- ✅ Proper input types (email, tel, number)

## Performance Monitoring

### Web Vitals Tracking

**Setup:**
```typescript
// src/lib/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function reportWebVitalsToAnalytics() {
  function sendToAnalytics(metric) {
    const body = JSON.stringify(metric);
    const url = '/api/analytics/web-vitals';
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { body, method: 'POST', keepalive: true });
    }
  }

  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
}
```

**Integration:**
```typescript
// src/app/layout.tsx
import { useReportWebVitals } from 'next/web-vitals';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Send to analytics
    reportWebVitalsToAnalytics();
  });
  return null;
}
```

### Lighthouse CI

**Thresholds:**
- PWA: 100/100 (strict)
- Performance: 90+/100 (recommended: 95+)
- Accessibility: 100/100 (strict)
- Best Practices: 90+/100
- SEO: 90+/100

## Testing PWA Features

### Manual Testing Checklist

**PWA Fundamentals:**
- [ ] App installs successfully on iOS Safari
- [ ] App installs successfully on Android Chrome
- [ ] App installs successfully on desktop Chrome/Edge
- [ ] Manifest displays correct name, icons, colors
- [ ] App shortcuts work (right-click app icon)
- [ ] Splash screen appears on launch
- [ ] App runs in standalone mode (no browser chrome)

**Offline Functionality:**
- [ ] App loads when offline
- [ ] Offline page displays when navigating offline
- [ ] Cached pages load when offline
- [ ] Network status indicator shows when offline/online
- [ ] Data syncs when back online

**Performance:**
- [ ] LCP < 2.5s on mobile (3G network)
- [ ] FID < 100ms (test button clicks)
- [ ] CLS < 0.1 (no layout shifts)
- [ ] Images load progressively
- [ ] Fonts load without FOIT

**Mobile UX:**
- [ ] Touch targets are 44x44px minimum
- [ ] Pull-to-refresh works
- [ ] Swipe gestures work
- [ ] Haptic feedback on interactions
- [ ] Safe area insets respected (iPhone notch)

**Accessibility:**
- [ ] Keyboard navigation works
- [ ] Focus visible on all elements
- [ ] Screen reader announces correctly
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Form errors announced to screen reader

### Automated Testing

**Lighthouse Audit:**
```bash
npx lighthouse https://voxanne.ai --view
npx lighthouse https://voxanne.ai --only-categories=pwa
```

**PWA Audit Script:**
```bash
npm run audit:pwa
```

**Playwright Tests:**
```bash
npm run test:pwa
```

## Troubleshooting

### Common Issues

**Issue 1: Service worker not registering**
- Check DevTools → Application → Service Workers
- Verify HTTPS (required except localhost)
- Check service worker scope
- Clear caches and unregister old SWs

**Issue 2: Install prompt not showing**
- Verify manifest validity (DevTools → Application → Manifest)
- Ensure all PWA criteria met (HTTPS, manifest, service worker)
- Check if already installed (display-mode: standalone)
- Test on mobile device (desktop has stricter criteria)

**Issue 3: Offline page not displaying**
- Verify fallback route in SW config
- Ensure offline page is precached
- Test with DevTools offline mode

**Issue 4: App not updating after deployment**
- Set skipWaiting: true in PWA config
- Implement update notification UI
- Force service worker update programmatically

## Quick Reference

### Environment Variables

```env
# Enable PWA in development
NEXT_PUBLIC_ENABLE_PWA=true

# Production (PWA always enabled)
NODE_ENV=production
```

### NPM Scripts

```json
{
  "scripts": {
    "dev:pwa": "NEXT_PUBLIC_ENABLE_PWA=true next dev",
    "test:pwa": "playwright test tests/pwa-*.spec.ts",
    "audit:pwa": "./scripts/pwa-audit.sh",
    "lighthouse": "npx lighthouse https://voxanne.ai --view"
  }
}
```

### Critical File Locations

```
public/
├── manifest.json          # PWA manifest
├── icons/                 # PWA icons (8 sizes)
├── screenshots/           # App screenshots
└── sw.js                  # Service worker (auto-generated)

src/
├── app/
│   ├── offline/page.tsx   # Offline fallback
│   └── layout.tsx         # PWA components integration
├── components/pwa/
│   ├── InstallPrompt.tsx  # Install prompt UI
│   ├── NetworkStatus.tsx  # Online/offline indicator
│   └── PullToRefresh.tsx  # Pull-to-refresh
└── lib/
    ├── web-vitals.ts      # Performance monitoring
    └── haptics.ts         # Haptic feedback
```

### PWA Compliance Checklist

**✅ Core Features:**
- [ ] Valid manifest.json
- [ ] Service worker active
- [ ] HTTPS enabled (production)
- [ ] Installable on all platforms
- [ ] Offline page functional
- [ ] Network status indicator

**✅ Performance:**
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Images optimized
- [ ] Fonts optimized
- [ ] Code splitting

**✅ Mobile UX:**
- [ ] Touch targets 44x44px
- [ ] Responsive design
- [ ] Haptic feedback
- [ ] Pull-to-refresh
- [ ] Swipe gestures

**✅ Accessibility:**
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] WCAG AA contrast (4.5:1)
- [ ] Focus visible states
- [ ] ARIA labels

---

**Remember:** PWA excellence is about progressive enhancement. Start with a solid responsive web app, then layer PWA features to create an exceptional mobile experience.
