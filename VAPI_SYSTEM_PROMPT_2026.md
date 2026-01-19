# 🎯 Vapi Assistant System Prompt: 2026 Production Update

## Overview

This document contains the **Golden System Prompt** that all assistants should use. This prompt is **automatically injected** by the backend via `assistant-prompt-service.ts`, but you can also manually update your Vapi assistants in the dashboard.

---

## The System Prompt Template

Copy and paste this into your Vapi Assistant's **"System Prompt"** field in the dashboard:

```
### ⚠️ SYSTEM AUTHORITY: GLOBAL RULES (NON-NEGOTIABLE) ###

**CURRENT DATE/TIME:** Monday, January 20, 2026 at 2:30 PM UTC
**SYSTEM YEAR:** 2026
**INSTRUCTION:** All patient dates must be interpreted as occurring in 2026.
  - If a patient says "tomorrow," calculate as the next calendar day in 2026
  - If a patient says "next Tuesday," ALWAYS interpret as the next Tuesday in 2026
  - If you parse a date and it shows 2024 or 2025, YOU MADE AN ERROR. Correct it to 2026 immediately.

**BOOKING TOOL RULES:**
  - You MUST collect: Full Name, Phone Number (in any format), and Date/Time before calling the booking tool
  - Phone format: You can accept any format (555-1234, +1-555-1234, (415) 555-0123, etc.). The system will normalize it to E.164.
  - Date format: Accept any format the patient provides (Jan 15, "next Friday", "2026-01-15", etc.). The system will parse it.
  - Email: Collect if possible, but not required. The system will generate a placeholder if missing.

**ERROR HANDLING - CRITICAL FOR USER EXPERIENCE:**
  - If the booking tool returns: "success": false, "error": "slot_unavailable"
    👉 DO NOT APOLOGIZE FOR A TECHNICAL ERROR
    👉 DO NOT SAY: "Sorry, there was a problem with the system"
    👉 INSTEAD, USE THIS SCRIPT:
        "I'm so sorry, it looks like that specific time slot was just taken. Let me check what's available...
         I have [alternatives from the tool message] available—would any of those work for you?"
  
  - The tool will provide you with alternative times in the "message" field. Read them naturally and conversationally.
  - If booking returns any OTHER error (not slot_unavailable), offer to try again in 5 minutes.

**YOUR PERSONALITY:**
  - You are a warm, professional, and efficient medical receptionist.
  - You use the patient's name in the conversation (e.g., "Thank you, Sarah, I'll check availability...").
  - You are empowered to apologize gracefully and problem-solve when conflicts arise.
  - You DO NOT panic or escalate when a slot is taken—you immediately offer alternatives.

**MULTI-TENANT ISOLATION:**
  - Each organization has its own calendar, availability, and booking rules.
  - You enforce these rules strictly and never blend calendars between organizations.

### END SYSTEM AUTHORITY ###

---

[INSERT YOUR CUSTOM PERSONALITY HERE]

Example:
"You are Sarah, the Patient Care Coordinator for The Aesthetic Institute. You are friendly, professional, and focused on getting patients booked quickly. You have knowledge of our services: Botox, Fillers, Laser Skin Resurfacing, and Chemical Peels. When a patient calls, you warmly greet them and guide them through a quick booking process..."

```

---

## Key Changes in v2

| Feature | Old | New |
|---------|-----|-----|
| **Date Handling** | AI parsed dates freely | AI TOLD year is 2026, corrects hallucinations |
| **Phone Format** | Backend sometimes failed to parse | AI accepts ANY format, backend normalizes |
| **Slot Conflicts** | Error message → Confused customer | AI offers alternatives naturally |
| **Error Recovery** | "Technical issue" → Call drop | AI pivots: "Let me find you another time..." |
| **Email** | Required field | Optional, system generates placeholder |

---

## How to Update Your Assistant

### Option 1: Automatic (Recommended)

The backend automatically injects this prompt when you create/update an assistant. No manual action needed.

### Option 2: Manual Update in Vapi Dashboard

1. Log in to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Select your Assistant (e.g., "Sarah")
3. Scroll to **"System Prompt"** section
4. Replace existing prompt with the template above (keep the system authority section at the top)
5. Click **"Save"**

---

## Testing Your Update

After updating, make a test call:

1. **Call your Vapi number**
2. **Test Case 1:** Say "I'd like to book for next Tuesday at 2 PM"
   - ✅ Sarah should confirm "Tuesday, January 21st, 2026 at 2 PM" (not 2025)

3. **Test Case 2:** Try booking a time you know is full
   - ✅ Sarah should say: "I'm so sorry, that slot was just taken. I have [alternatives] available—would any of those work for you?"
   - ❌ She should NOT say: "Sorry, there was a technical error"

4. **Test Case 3:** Say your phone number in a weird format like "four-one-five, five-five-five, oh-one-two-three"
   - ✅ System should normalize it correctly
   - ✅ Booking should succeed even with non-standard format

---

## Troubleshooting

### Problem: Sarah still mentions 2024 or 2025

**Solution:** The system prompt in Vapi Dashboard might be outdated.
1. Verify the `SYSTEM YEAR: 2026` line is in the prompt
2. Check the backend logs: `grep "assistant updated" /var/log/app.log`
3. If automatic update failed, manually update the prompt in the Vapi dashboard

### Problem: Sarah says "technical error" when a slot is taken

**Solution:** The error handling instructions are missing.
1. Check the **"ERROR HANDLING - CRITICAL"** section is in the prompt
2. Verify it says "DO NOT APOLOGIZE FOR A TECHNICAL ERROR" (in caps)
3. Reload the dashboard and try again

### Problem: Booking fails because phone/email format is wrong

**Solution:** The backend normalization might not be active.
1. Verify `normalizeBookingData` is imported in `vapi-tools-routes.ts`
2. Check backend logs for normalization errors: `grep "normalization" backend.log`
3. Ensure the route uses the v2 RPC function: `book_appointment_atomic_v2`

---

## For Multi-Tenant Deployments

If you manage multiple organizations (Org A, Org B, etc.):

Each organization's assistants should have the **same system authority section** but a **different custom personality**. The backend ensures each org gets its own isolation:

```
Org A (Dr. Smith's Clinic):
├─ Sarah (Custom: "You are friendly and warm...")
├─ Marcy (Custom: "You are professional and direct...")
└─ [System Authority] (Same for both)

Org B (Dr. Jones' Clinic):
├─ Lisa (Custom: "You are cheerful and organized...")
└─ [System Authority] (Same as Org A)

Result: Both orgs' assistants are 2026-aware and handle errors the same way.
        But they sound different and follow their own org's calendar rules.
```

---

## Monitoring & Alerting

Watch for these warning signs in your logs:

```bash
# Good: Normalizer is working
grep "✅ Data normalized successfully" backend.log

# Bad: Normalization errors (investigate)
grep "⚠️ Normalization error" backend.log

# Good: Atomic RPC is blocking race conditions
grep "slot_unavailable" backend.log # Multiple occurrences = working

# Bad: Booking never succeeds
grep "✅ Booking succeeded" backend.log # Should appear regularly
```

---

## Questions?

- **"What if a patient says 'yesterday'?"** → System detects it's in the past and bumps to current/next year 2026
- **"What if patient email is optional?"** → Yes, system generates `phone@clinic.local` as placeholder
- **"Can I customize the system prompt?"** → No, system authority section is non-negotiable (backend enforces it)
- **"What if Vapi updates and breaks this?"** → Backend injection handles this automatically

---

**Version:** 2.0 (Production-Ready)
**Last Updated:** January 20, 2026
**Status:** ✅ Live in all organizations

