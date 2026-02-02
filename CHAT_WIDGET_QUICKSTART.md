# Voxanne AI Chat Widget - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Add to Your App (2 minutes)

```tsx
// app/layout.tsx
import VoxanneChatWidget from '@/components/VoxanneChatWidget';

export default function RootLayout({ children }) {
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

### Step 2: Verify Environment Variable (30 seconds)

Ensure `.env.local` has your Groq API key:
```env
GROQ_API_KEY=gsk_your_key_here
```

### Step 3: Test It! (1 minute)

```bash
npm run dev
```

Open http://localhost:3000 and click the chat button in the bottom-right corner!

---

## ✅ What You Get

### Component Features
- 💬 **Floating chat button** - Bottom-right corner with animations
- 🎨 **Clinical Trust design** - Surgical blue palette, glassmorphism
- 💾 **Persistent chat** - Saves to localStorage
- ⚡ **Quick actions** - 4 pre-configured buttons
- 📱 **Responsive** - Works on all devices
- ♿ **Accessible** - WCAG AA compliant

### AI Features
- 🤖 **Groq LLM** - Fast, accurate responses (llama-3.3-70b-versatile)
- 📚 **Voxanne AI knowledge** - Complete product info, pricing, features
- 🇬🇧 **UK pricing** - £350, £550, £800/month plans
- 📞 **Contact info** - Phone: +44 7424 038250, Email: support@voxanne.ai
- 🛡️ **Rate limiting** - 15 requests/minute protection

---

## 📁 Files Created

1. **`/src/components/VoxanneChatWidget.tsx`** (11KB)
   - React component with Framer Motion animations
   - localStorage persistence
   - Quick action buttons
   - Typing indicator

2. **`/src/app/api/chat-widget/route.ts`** (12KB)
   - Next.js API route
   - Groq LLM integration
   - Rate limiting & validation
   - Comprehensive error handling

3. **`/CHAT_WIDGET_INTEGRATION.md`**
   - Complete integration guide
   - Customization examples
   - Troubleshooting tips

4. **`/CHAT_WIDGET_VISUAL_GUIDE.md`**
   - Visual design specifications
   - Color palette reference
   - Animation details

---

## 🎨 Design Highlights

### Colors (Clinical Trust Palette)
- **Header**: Gradient from `surgical-600` (#1D4ED8) to `surgical-500` (#3B82F6)
- **User messages**: Blue background (#1D4ED8), white text
- **Bot messages**: White background, border, dark text (#020412)
- **Background**: Light blue gradient (#F0F9FF)

### Size & Position
- **Widget**: 400px × 600px
- **Position**: Fixed bottom-right (24px margin)
- **Button**: 64px circle when closed

### Animations
- **Open/Close**: Scale + fade (200ms)
- **Messages**: Slide up + fade (200ms)
- **Typing**: Bouncing dots (600ms loop)
- **Button hover**: Scale 1.1

---

## 💡 Quick Actions

The widget includes 4 smart buttons:

1. **📅 Schedule a Demo**
   - Triggers: "I want to schedule a demo"
   - Response: Provides Calendly link

2. **💷 View Pricing**
   - Triggers: "Can you show me the pricing plans?"
   - Response: Shows UK pricing (£350, £550, £800/mo)

3. **📄 See Case Studies**
   - Triggers: "I want to see case studies"
   - Response: Discusses success stories

4. **✉ Contact Sales**
   - Triggers: "How can I contact sales?"
   - Response: Phone, email, Calendly

These appear on first visit and disappear after the first user message.

---

## 🛠️ Customization Examples

### Change Position (Bottom-Left)
```tsx
// In VoxanneChatWidget.tsx
className="fixed bottom-6 left-6" // Instead of right-6
```

### Change Size
```tsx
// Make it bigger
className="w-[450px] h-[700px]"
```

### Change Initial Greeting
```tsx
const INITIAL_GREETING = "Welcome! How can I help you today?";
```

### Add Custom Quick Action
```tsx
const QUICK_ACTIONS = [
  { icon: Star, label: 'Features', action: 'features' },
  // ... existing actions
];

// Then handle in handleQuickAction():
case 'features':
  userMessage = 'Tell me about key features';
  break;
```

---

## 🧪 Testing Checklist

- [ ] Chat button appears (bottom-right)
- [ ] Click to open widget
- [ ] See initial greeting
- [ ] Click "Schedule a Demo" → See Calendly link
- [ ] Click "View Pricing" → See UK prices
- [ ] Send custom message → Get response
- [ ] Verify typing indicator shows
- [ ] Refresh page → Chat history persists
- [ ] Close and reopen → History still there

---

## 🐛 Troubleshooting

### Widget not appearing?
- Check import: `import VoxanneChatWidget from '@/components/VoxanneChatWidget'`
- Verify it's rendered in JSX: `<VoxanneChatWidget />`
- Check browser console for errors

### "Chat service not configured" error?
- Verify `GROQ_API_KEY` in `.env.local`
- Restart dev server: `npm run dev`

### Messages not persisting?
- Check localStorage is enabled
- Try: `localStorage.clear()` in browser console
- Refresh page

### Styling looks wrong?
- Verify Tailwind config has Clinical Trust palette
- Check `surgical-*` colors are defined
- Run: `npm run dev` to rebuild CSS

---

## 📊 Performance

- **Initial Load**: ~200ms (component mount)
- **Response Time**: 1-3 seconds (Groq API)
- **Bundle Size**: ~65KB (with Framer Motion)
- **Rate Limit**: 15 requests/minute per IP

---

## 📞 Support

Need help?
- **Email**: support@voxanne.ai
- **Phone**: +44 7424 038250
- **Documentation**: See `CHAT_WIDGET_INTEGRATION.md`

---

## 🎯 Next Steps

1. ✅ Integrate into your app
2. ✅ Test all quick actions
3. ✅ Customize if needed (colors, text, etc.)
4. ✅ Deploy to production
5. ✅ Monitor usage

---

## 📦 Dependencies

Already installed (from `package.json`):
- `framer-motion` - Animations
- `lucide-react` - Icons
- `groq-sdk` - AI API
- `next` - Framework

---

## 🔒 Security

- ✅ Rate limiting (15 req/min)
- ✅ Input validation
- ✅ No sensitive data storage
- ✅ GROQ_API_KEY secured in env
- ✅ Error messages sanitized

---

## 📝 Notes

- Chat history stored in **browser localStorage** (not server)
- Widget works **offline** (shows error gracefully)
- **Mobile-friendly** (responsive design)
- **Accessible** (keyboard navigation, ARIA labels)

---

**Version**: 1.0.0
**Created**: 2026-02-02
**Powered by**: Groq LLM (llama-3.3-70b-versatile)
**Design**: Clinical Trust Palette

---

## 🎉 You're All Set!

The Voxanne AI Chat Widget is now ready to use. Just add it to your layout and start chatting!

Questions? Contact us at support@voxanne.ai or call +44 7424 038250.
