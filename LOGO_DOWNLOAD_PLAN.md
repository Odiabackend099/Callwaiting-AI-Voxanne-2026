# Logo Download & Integration Plan

## Phase 1: Identify & Download Logos

### Companies to Download (from Integrations section):
1. **Google Calendar** - calendar.google.com
2. **Twilio** - twilio.com
3. **Salesforce** - salesforce.com
4. **Calendly** - calendly.com
5. **Supabase** - supabase.com
6. **Vapi** - vapi.ai
7. **ElevenLabs** - elevenlabs.io
8. **Vonage** - vonage.com
9. **Outlook** - microsoft.com/outlook
10. **Cal.com** - cal.com
11. **HubSpot** - hubspot.com
12. **Pipedrive** - pipedrive.com
13. **Monday.com** - monday.com

### Download Strategy:
- Use Playwright to navigate to each company's official site
- Locate logo/branding assets (typically in /about, /brand, /press-kit)
- Download in SVG (preferred) or PNG format
- Target size: 200x200px or larger for clarity
- Save to: `/public/integrations/`

### Directory Structure:
```
public/
  integrations/
    google-calendar.svg
    twilio.svg
    salesforce.svg
    calendly.svg
    supabase.svg
    vapi.svg
    elevenlabs.svg
    vonage.svg
    outlook.svg
    cal-com.svg
    hubspot.svg
    pipedrive.svg
    monday.svg
```

## Phase 2: Update Integrations.tsx Component

- Replace text placeholders with `<Image>` components
- Import logos from `/public/integrations/`
- Set appropriate dimensions (e.g., 80x80px display)
- Add alt text for accessibility

## Phase 3: Testing & Verification

- Verify all logos display correctly
- Check responsive behavior
- Ensure proper sizing and alignment

## Technical Requirements:
- Playwright MCP for automated downloading
- SVG or PNG formats
- Proper file naming (kebab-case)
- Accessibility attributes (alt text)
