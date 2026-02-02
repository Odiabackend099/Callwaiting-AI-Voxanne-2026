# Voxanne AI Chat Widget - Integration Guide

## Overview

The Voxanne AI Chat Widget is a complete, production-ready chat component that provides instant AI-powered customer support on your website using Groq LLM.

## Files Created

1. **`/src/components/VoxanneChatWidget.tsx`** (11KB)
   - Full-featured React chat widget component
   - Framer Motion animations
   - Clinical Trust design system
   - localStorage persistence
   - Glassmorphism effects

2. **`/src/app/api/chat-widget/route.ts`** (12KB)
   - Dedicated API endpoint for chat widget
   - Groq LLM integration (llama-3.3-70b-versatile)
   - Rate limiting (15 requests/minute)
   - Comprehensive error handling
   - Updated Voxanne AI knowledge base

## Features

### Component Features
✓ **Floating Chat Button** - Bottom-right corner with pulse animation
✓ **Chat Window** - 400px × 600px with glassmorphism
✓ **Message History** - Persisted in localStorage
✓ **Typing Indicator** - Three-dot pulse animation
✓ **Quick Actions** - 4 pre-configured buttons (Demo, Pricing, Cases, Contact)
✓ **Auto-scroll** - Smooth scroll to latest message
✓ **Timestamps** - Show time for each message
✓ **Responsive Design** - Mobile-friendly
✓ **Error Handling** - Graceful fallbacks

### API Features
✓ **Groq LLM** - Fast, accurate responses (llama-3.3-70b-versatile)
✓ **Rate Limiting** - Prevents abuse (15 req/min)
✓ **Input Validation** - Comprehensive checks
✓ **Error Handling** - User-friendly error messages
✓ **Knowledge Base** - Complete Voxanne AI product info

## Design System (Clinical Trust Palette)

### Colors
- **Header Gradient**: `from-surgical-600 to-surgical-500`
- **User Messages**: `bg-surgical-600 text-white` (right-aligned, blue)
- **Bot Messages**: `bg-white border border-surgical-200 text-obsidian` (left-aligned, white)
- **Background**: `bg-surgical-50/30` (light blue gradient)
- **Buttons**: Surgical blue with hover effects

### Typography
- Font: Inter (body), Plus Jakarta Sans (display)
- Sizes:
  - Header: `text-base` (16px)
  - Messages: `text-sm` (14px)
  - Timestamps: `text-xs` (12px)

### Animations
- Chat open/close: Scale + fade (200ms)
- Messages: Slide up + fade (200ms)
- Typing indicator: Bounce animation (600ms loop)
- Button hover: Scale 1.1

## Integration Steps

### 1. Add to Your Layout

```tsx
// app/layout.tsx or any page
import VoxanneChatWidget from '@/components/VoxanneChatWidget';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <VoxanneChatWidget />
      </body>
    </html>
  );
}
```

### 2. Environment Variables

Ensure `GROQ_API_KEY` is set in your `.env.local`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Verify Framer Motion

Ensure `framer-motion` is installed (already in package.json):

```bash
npm install framer-motion
```

## Usage Examples

### Basic Integration (Homepage)
```tsx
// app/page.tsx
import VoxanneChatWidget from '@/components/VoxanneChatWidget';

export default function HomePage() {
  return (
    <main>
      <h1>Welcome to Voxanne AI</h1>
      {/* Your content */}
      <VoxanneChatWidget />
    </main>
  );
}
```

### Conditional Display (Show on specific pages)
```tsx
'use client';
import { usePathname } from 'next/navigation';
import VoxanneChatWidget from '@/components/VoxanneChatWidget';

export default function ConditionalChatWidget() {
  const pathname = usePathname();
  const showWidget = ['/', '/pricing', '/features'].includes(pathname);

  return showWidget ? <VoxanneChatWidget /> : null;
}
```

## Quick Actions

The widget includes 4 pre-configured quick action buttons:

1. **Schedule a Demo** → "I want to schedule a demo"
2. **View Pricing** → "Can you show me the pricing plans?"
3. **See Case Studies** → "I want to see case studies and success stories"
4. **Contact Sales** → "How can I contact sales?"

These appear on the initial greeting screen and disappear after the first user message.

## Knowledge Base

The API endpoint includes complete Voxanne AI information:

### Product Info
- 24/7 AI receptionist capabilities
- Lead qualification & appointment booking
- Industry-specific features (healthcare focus)
- Security & compliance (HIPAA, GDPR, SOC 2)

### Pricing (UK/GBP)
- **Starter**: £350/month (400 min/mo)
- **Professional**: £550/month (1,200 min/mo) ⭐ Most Popular
- **Enterprise**: £800/month (2,000 min/mo)

### Contact Information
- **Phone**: +44 7424 038250
- **Email**: support@voxanne.ai
- **Demo**: https://calendly.com/austyneguale/30min

### Common Questions
- Setup time (~30 minutes)
- Integrations (Google Calendar, Outlook, Salesforce, etc.)
- Security features
- Industry support
- Pricing comparison vs. traditional staff

## Customization

### Change Colors
Edit the Tailwind classes in `VoxanneChatWidget.tsx`:

```tsx
// Header gradient
className="bg-gradient-to-r from-surgical-600 to-surgical-500"

// User message bubble
className="bg-surgical-600 text-white"

// Bot message bubble
className="bg-white border border-surgical-200 text-obsidian"
```

### Change Size
```tsx
// Widget dimensions
className="w-[400px] h-[600px]" // Adjust as needed
```

### Change Position
```tsx
// From bottom-right to bottom-left
className="fixed bottom-6 left-6" // Instead of right-6
```

### Modify Initial Greeting
Edit the constant in `VoxanneChatWidget.tsx`:

```tsx
const INITIAL_GREETING = "Your custom greeting here!";
```

### Add/Remove Quick Actions
Edit the array in `VoxanneChatWidget.tsx`:

```tsx
const QUICK_ACTIONS = [
  { icon: Calendar, label: 'Your Action', action: 'custom' },
  // Add more actions
];
```

## API Configuration

### Rate Limiting
Current: 15 requests per minute per IP

To adjust, edit `route.ts`:
```typescript
if (userLimit.count >= 15) { // Change this number
```

### Response Length
Current: max 250 tokens

To adjust, edit `route.ts`:
```typescript
max_tokens: 250, // Change this number
```

### AI Temperature
Current: 0.7 (balanced creativity)

To adjust, edit `route.ts`:
```typescript
temperature: 0.7, // 0.0 = deterministic, 1.0 = creative
```

## Testing

### Manual Testing
1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Click chat button (bottom-right)
4. Test quick actions
5. Send custom messages
6. Verify localStorage persistence (refresh page)

### Test Scenarios
- ✓ Ask about pricing → Should show UK/GBP prices
- ✓ Ask about demos → Should provide Calendly link
- ✓ Ask about contact → Should show phone + email
- ✓ Ask complex questions → Should provide detailed answers
- ✓ Trigger errors → Should show fallback messages

## Troubleshooting

### Widget not appearing
- Check if component is imported
- Verify z-index (should be `z-50`)
- Check for CSS conflicts

### API errors
- Verify `GROQ_API_KEY` is set
- Check console for error messages
- Test API endpoint directly: `POST /api/chat-widget`

### Messages not persisting
- Check localStorage is enabled in browser
- Verify no errors in browser console
- Clear localStorage and retry: `localStorage.clear()`

### Styling issues
- Ensure Tailwind config includes Clinical Trust palette
- Verify `tailwind.config.ts` has surgical colors
- Check for CSS specificity conflicts

## Performance

### Bundle Size
- Component: ~11KB (uncompressed)
- API Route: ~12KB (uncompressed)
- Framer Motion: ~65KB (tree-shaken)

### API Performance
- Average response time: 1-3 seconds (depends on Groq API)
- Rate limit: 15 requests/minute
- Caching: Messages cached in localStorage

### Optimization Tips
- Use `next/dynamic` for code splitting:
```tsx
import dynamic from 'next/dynamic';
const VoxanneChatWidget = dynamic(() => import('@/components/VoxanneChatWidget'), {
  ssr: false
});
```

## Security

### Data Privacy
- Messages stored only in user's browser (localStorage)
- No server-side message logging
- Rate limiting prevents abuse

### API Security
- Input validation (message length, role validation)
- Rate limiting per IP
- Error messages don't leak sensitive info
- GROQ_API_KEY stored securely in environment variables

## Support

For issues or questions:
- **Email**: support@voxanne.ai
- **Phone**: +44 7424 038250
- **Documentation**: This file

## Next Steps

1. ✅ Integrate widget into your app
2. ✅ Test all quick actions
3. ✅ Customize colors/branding if needed
4. ✅ Deploy to production
5. ✅ Monitor analytics in Groq dashboard

## License

Part of the Voxanne AI platform. Proprietary software.

---

**Created**: 2026-02-02
**Version**: 1.0.0
**Powered by**: Groq LLM (llama-3.3-70b-versatile)
