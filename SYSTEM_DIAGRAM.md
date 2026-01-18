# 📊 System Diagram - What's Actually Running

## Current Architecture (Simplified)

```
YOUR PHONE
    │
    │ (call to your clinic number)
    │
    ▼
┌──────────────────────────────────────────────┐
│  VAPI (Cloud Voice Platform)                 │
│  - Receives your call                        │
│  - Runs Sarah AI assistant                   │
│  - Decides: Booking? Knowledge? Transfer?    │
└──────────────────────────────────────────────┘
    │
    ├─────────────────────────────────┬────────────────────────────────┐
    │ (Booking Tool)                  │ (Knowledge Base Query)         │
    │                                 │                               │
    ▼                                 ▼                               ▼
┌─────────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Webhook #1          │      │ Webhook #2       │      │ Transfer to Human│
│ (Booking)           │      │ (Knowledge)      │      │ (Phone Number)   │
│ POST to:            │      │ POST to:         │      │                  │
│ /api/vapi/tools/    │      │ /api/vapi/       │      │ (No webhook)     │
│ bookClinicAppt      │      │ webhook          │      │                  │
│                     │      │                  │      │                  │
│ Returns: {          │      │ Returns: {       │      │                  │
│   toolResult: {     │      │   success: true, │      │                  │
│     content: "..." │      │   context: "..." │      │                  │
│   },                │      │ }                │      │                  │
│   speech: "..."     │      │                  │      │                  │
│ }                   │      │                  │      │                  │
└─────────────────────┘      └──────────────────┘      └──────────────────┘
    │                             │
    ▼                             ▼
┌─────────────────────┐      ┌──────────────────┐
│ Your Backend        │      │ Supabase (KB)    │
│ (Node.js)           │      │ (Knowledge Docs) │
│                     │      │                  │
│ 1. Create contact   │      │ (Embedded as     │
│ 2. Create appt      │      │  vectors)        │
│ 3. Send SMS         │      │                  │
│ 4. Sync Calendar    │      │                  │
│                     │      │                  │
│ Returns success ✅  │      │ Returns context  │
└─────────────────────┘      └──────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│  Sarah's Response (spoken to you)            │
│  "Perfect! I've scheduled your appointment" │
└──────────────────────────────────────────────┘
    │
    ▼
YOUR PHONE (confirmation!)
```

---

## What's Running (Right Now)

### ✅ Already Built & Working

| Component | Status | URL |
|-----------|--------|-----|
| Sarah AI Voice | ✅ Running | Vapi (cloud) |
| Booking Endpoint | ✅ Built | `/api/vapi/tools/bookClinicAppointment` |
| Knowledge Base | ✅ Built | `/api/vapi/webhook` |
| Database | ✅ Running | Supabase |
| SMS System | ✅ Built | TwilioGuard |
| Backend | ✅ Running | Port 3001 |

### ⚠️ NOT Connected Yet

| Component | Issue |
|-----------|-------|
| Vapi → Booking | URL not set in Vapi dashboard |
| Vapi → Knowledge | Not configured in Vapi dashboard |
| .env → Backend | Still has localhost URL |

---

## What You're Fixing Today

```
BEFORE:
┌────────────────────────────────────────┐
│ Vapi Booking Tool                      │
│ Webhook URL: http://localhost:3001     │
│ Status: ❌ Not accessible (localhost)  │
└────────────────────────────────────────┘

AFTER:
┌────────────────────────────────────────────────┐
│ Vapi Booking Tool                              │
│ Webhook URL: https://ngrok-url/api/vapi/...   │
│ Status: ✅ Connected & working!                │
└────────────────────────────────────────────────┘
```

---

## The 3 Webhooks (For Your Understanding)

### Webhook #1: Booking Tool ✅ IMPORTANT
**Purpose:** Book appointments
**Endpoint:** `/api/vapi/tools/bookClinicAppointment`
**What Vapi sends:** Tool call with booking details
**What backend returns:** Success/error + appointment ID
**Status:** Built ✅, needs Vapi URL ⚠️

### Webhook #2: Knowledge Base (Optional)
**Purpose:** Answer questions about services
**Endpoint:** `/api/vapi/webhook`
**What Vapi sends:** User question
**What backend returns:** Answer from knowledge base
**Status:** Built ✅, not used yet ⏭️

### Webhook #3: SMS Status (Already Integrated)
**Purpose:** Track SMS delivery
**Endpoint:** `/api/webhooks/sms-status`
**Status:** Built ✅, automatic

---

## Data Flow: Booking Example

```
1. User calls clinic number
   ↓
2. Vapi answers with Sarah
   ↓
3. User: "I want to book"
   ↓
4. Sarah: "What's your name?"
   User: "Samuel"
   ↓
5. Sarah: "Email?"
   User: "samuel@test.com"
   ↓
6. Sarah: "Service?"
   User: "Botox"
   ↓
7. Sarah: "When?"
   User: "Monday 6 PM"
   ↓
8. Sarah collects all data
   ↓
9. Vapi calls: POST /api/vapi/tools/bookClinicAppointment
   {
     "toolCall": {
       "function": {
         "name": "bookClinicAppointment",
         "arguments": {
           "appointmentDate": "2026-01-20",
           "appointmentTime": "18:00",
           "patientEmail": "samuel@test.com",
           "patientName": "Samuel",
           "serviceType": "Botox"
         }
       }
     },
     "customer": {
       "metadata": {
         "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
       }
     }
   }
   ↓
10. Backend receives request
    ↓
11. Backend:
    - Creates contact in Supabase
    - Creates appointment in Supabase
    - Sends SMS confirmation
    - Syncs to Google Calendar (if configured)
    ↓
12. Backend returns:
    {
      "toolResult": {
        "content": "{\"success\":true,\"appointmentId\":\"...\"}"
      },
      "speech": "Perfect! I've scheduled your appointment..."
    }
    ↓
13. Vapi gets response
    ↓
14. Sarah speaks: "Perfect! I've scheduled your appointment for Monday at 6 PM"
    ↓
15. User hears confirmation ✅
    ↓
16. Appointment in database ✅
    ↓
17. SMS sent ✅
```

---

## Why It's Failing Now

```
User calls → Vapi tries to call booking endpoint
                                    ↓
                    Vapi: Where's the webhook URL?
                                    ↓
                    Vapi Dashboard: http://localhost:3001 ❌
                    (Localhost is not accessible to Vapi!)
                                    ↓
                    Vapi: Endpoint not found!
                                    ↓
                    Sarah: "It seems there was an issue..." ❌
```

---

## Why It Will Work After You Fix It

```
User calls → Vapi tries to call booking endpoint
                                    ↓
                    Vapi: Where's the webhook URL?
                                    ↓
                    Vapi Dashboard: https://ngrok-url/api/vapi/tools/... ✅
                    (Ngrok tunnels localhost to public HTTPS URL!)
                                    ↓
                    Vapi: Found it! POSTing request...
                                    ↓
                    Backend receives & processes
                                    ↓
                    Backend: Here's your appointment! ✅
                                    ↓
                    Sarah: "Perfect! Appointment confirmed!" ✅
                                    ↓
                    User: "Great!" ✅
```

---

## Environment Variables (What .env Does)

Your `.backend/.env` file contains:

```bash
# OLD (doesn't work with Vapi)
BACKEND_URL=http://localhost:3001

# NEW (Vapi can reach it)
BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

The backend uses `BACKEND_URL` to construct webhook URLs and tell Vapi where to send requests.

---

## The Multi-Tenant Stuff (For Later)

All those files I created about multi-tenancy? Those are for when you have:
- Multiple clinics
- Each clinic has own org_id
- Each clinic has own data in database

**Right now:** You have ONE clinic (VoxAnne), so ignore that complexity.

**When you grow:** Add multiple orgs, and the system routes automatically.

---

## Summary: What's Happening

✅ Everything is built and working
✅ Backend is running
✅ Supabase is connected
✅ Ngrok tunnel is active

❌ One problem: Vapi doesn't know where to send requests (URL is localhost)

✅ Solution: Tell Vapi the correct URL (ngrok URL)

✅ Result: Sarah books appointments

---

**Ready to fix it?**

Follow: `DO_THIS_NOW.md` (4 simple steps)

