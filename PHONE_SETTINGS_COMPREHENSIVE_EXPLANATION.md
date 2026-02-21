# Phone Settings Page - Comprehensive Explanation

**Date:** 2026-02-15
**Purpose:** Clear explanation of the TWO completely separate features on this page

---

## The Confusion: Two Separate Features on One Page

The Phone Settings page (`/dashboard/phone-settings`) shows **TWO LANES** that are completely independent:

```
┌──────────────────────────────────────────────────────────────┐
│                  PHONE SETTINGS PAGE                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  LEFT SIDE (Lane 1):          RIGHT SIDE (Lane 2):          │
│  INBOUND CALLS                OUTBOUND CALLS                 │
│  (Call Forwarding)            (Caller ID Verification)       │
│                                                               │
│  Your AI Phone Number         Your Outbound Caller ID        │
│  +16504595418                 [Not verified yet]             │
│                                                               │
│  ┌─────────────────┐          ┌──────────────────┐          │
│  │ Carrier:        │          │ Enter your       │          │
│  │ [ ] AT&T        │          │ business phone:  │          │
│  │ [ ] Verizon     │          │ +234814199539    │          │
│  │ [x] International│         │                  │          │
│  │                 │          │ [Start           │          │
│  │ Forwarding code:│          │  Verification]   │          │
│  │ **21*+16504..#  │          │                  │          │
│  └─────────────────┘          └──────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

---

## LANE 1: INBOUND CALLS (Left Side - Call Forwarding)

### What It Does

**Purpose:** Route incoming calls FROM customers TO your AI assistant

**Flow:**
```
Customer Calls Your Business Number
         ↓
Forward to Voxanne AI Number (+16504595418)
         ↓
AI Answers and Handles the Call
```

### How Call Forwarding Works

#### Step 1: You Already Have a Managed Number

- Voxanne provisioned you a phone number: **+16504595418**
- This is stored in the `twilio_phone_numbers` table
- This number is **managed by Voxanne** (you don't own it)
- Status: **Active**

#### Step 2: Select Your Carrier

The page shows 4 carrier options:
- **AT&T** - US carrier
- **Verizon** - US carrier
- **T-Mobile** - US carrier
- **International / GSM** - All other carriers worldwide (MTN, Glo, Airtel, Vodafone, etc.)

#### Step 3: Get Your Forwarding Code

Based on your carrier selection, the page generates a **forwarding code**:

**For International / GSM (most carriers):**
```
Activation:   **21*+16504595418#
Deactivation: ##21#
```

**How the codes work:**
- `**21*[number]#` = "Forward all calls to this number"
- `##21#` = "Turn off call forwarding"

These are **GSM standard codes** that work on ALL mobile carriers worldwide.

#### Step 4: Dial the Code on YOUR Business Phone

1. Pick up your office/cell phone (the number you want customers to call)
2. Dial: `**21*+16504595418#`
3. Press call button
4. Your carrier confirms: "Call forwarding activated"

**Result:** All calls to YOUR business number now ring the AI instead.

### What Happens Behind the Scenes

**Database:**
- Managed number stored in: `twilio_phone_numbers` table
- Linked to your organization via: `org_id`
- Vapi phone ID stored in: `agents.vapi_phone_number_id`

**Call Flow:**
```
Customer → Your Business Number (forwarded)
         ↓
         Voxanne AI Number (+16504595418)
         ↓
         Vapi Platform
         ↓
         Your Agent Configuration (agent.vapi_assistant_id)
         ↓
         AI Answers with your custom prompt
```

### Key Files (Inbound / Call Forwarding)

| File | Purpose |
|------|---------|
| `backend/src/services/managed-telephony-service.ts` | Provision managed numbers |
| `backend/src/routes/phone-settings.ts` | API: GET /phone-settings/status (inbound data) |
| `src/app/dashboard/phone-settings/components/CarrierForwardingInstructions.tsx` | UI: Carrier selection + forwarding codes |
| `database: twilio_phone_numbers` | Stores managed number |
| `database: agents.vapi_phone_number_id` | Links agent to phone number |

---

## LANE 2: OUTBOUND CALLS (Right Side - Caller ID Verification)

### What It Does

**Purpose:** Set what number customers SEE when your AI calls them

**Flow:**
```
AI Makes Outbound Call to Customer
         ↓
Customer's Phone Rings
         ↓
Customer Sees: YOUR Business Number (not "Unknown")
         ↓
Customer Trusts the Call and Answers
```

### How Caller ID Verification Works

#### Step 1: Enter Your Business Phone Number

- You enter: `+2348141995397` (your actual business phone)
- This is the number you WANT customers to see
- Must include country code (+234 for Nigeria, +1 for US, etc.)

#### Step 2: Click "Start Verification"

**What happens:**
1. Frontend sends: `POST /api/verified-caller-id/verify`
2. Backend detects country code: `+234` → `NG` (Nigeria)
3. Backend calls Twilio API: `outgoingCallerIds.create()`
4. Twilio initiates a verification call to `+2348141995397`

#### Step 3: Answer the Verification Call

**Within ~30 seconds:**
- Your phone (+2348141995397) rings
- It's from Twilio's verification system
- You hear: "Your verification code is: 9-0-2-0-1-1"
- You enter: `902011` on your phone's keypad (NOT on the website)
- Twilio verifies the code automatically

#### Step 4: Click "I'm Done - Check Status"

**What happens:**
1. Frontend sends: `POST /api/verified-caller-id/confirm`
2. Backend calls Twilio API: `outgoingCallerIds.list(phoneNumber: "+2348141995397")`
3. Twilio responds: "Yes, this number is verified"
4. Backend stores: `verified_caller_ids` table → status: 'verified'
5. Page shows: "🎉 Verification Complete!"

**Result:** When your AI makes outbound calls, customers see `+2348141995397` on their caller ID.

### What Happens Behind the Scenes

**Database:**
- Verified number stored in: `verified_caller_ids` table
- Columns:
  - `phone_number`: '+2348141995397'
  - `status`: 'verified'
  - `org_id`: Your organization ID
  - `verification_sid`: Twilio validation record ID
  - `verified_at`: Timestamp

**Outbound Call Flow:**
```
User Clicks "Call Back" on Contact
         ↓
Backend: VapiClient.createOutboundCall(
  phoneNumberId: agents.vapi_phone_number_id,  ← Voxanne managed number
  assistantId: agents.vapi_assistant_id,
  customerNumber: "+1234567890",
  fromNumber: "+2348141995397"  ← YOUR verified caller ID
)
         ↓
Vapi makes call using YOUR verified number as caller ID
         ↓
Customer sees +2348141995397 (recognizes it, answers)
```

### Key Files (Outbound / Caller ID)

| File | Purpose |
|------|---------|
| `backend/src/routes/verified-caller-id.ts` | API: POST /verify, POST /confirm |
| `backend/src/services/integration-decryptor.ts` | Get Twilio credentials (managed or BYOC) |
| `backend/src/services/managed-telephony-service.ts` | Auto-fix Geo Permissions for international calls |
| `src/app/dashboard/phone-settings/page.tsx` | UI: Verification wizard (3 steps) |
| `database: verified_caller_ids` | Stores verified phone numbers |

---

## The Critical Difference

### Inbound (Lane 1) = RECEIVING Calls

- **Question:** How do customers reach my AI?
- **Answer:** Forward your business number to the Voxanne managed number
- **Action:** Dial a forwarding code on YOUR phone
- **Database:** `twilio_phone_numbers` table
- **User Phone:** Your business phone forwards calls
- **Voxanne Number:** +16504595418 (receives forwarded calls)

### Outbound (Lane 2) = MAKING Calls

- **Question:** What number do customers see when my AI calls them?
- **Answer:** Verify ownership of your business number with Twilio
- **Action:** Answer a verification call, enter code on keypad
- **Database:** `verified_caller_ids` table
- **User Phone:** Receives verification call (one-time)
- **Voxanne Number:** +16504595418 (makes calls on your behalf, shows YOUR number as caller ID)

---

## Visual Comparison

| Feature | Inbound (Call Forwarding) | Outbound (Caller ID) |
|---------|--------------------------|---------------------|
| **Purpose** | Route customer calls TO AI | Set what customers SEE when AI calls |
| **Your Action** | Dial forwarding code | Answer verification call |
| **Database Table** | `twilio_phone_numbers` | `verified_caller_ids` |
| **Phone Number Used** | Voxanne managed (+16504595418) | YOUR business number |
| **Who Calls Who** | Customer → Your Number (forwarded) → AI | AI → Customer (showing YOUR number) |
| **Setup Time** | 1 minute (one-time) | 2 minutes (one-time) |
| **UI Location** | Left side of page | Right side of page |

---

## Common Confusion Points

### 1. "Why do I need TWO numbers?"

**You don't.** You have ONE business number. The confusion is:

- **Inbound:** You forward YOUR business number → Voxanne managed number
- **Outbound:** You verify YOUR business number so Twilio can show it as caller ID

The Voxanne managed number (+16504595418) is used for BOTH directions:
- **Inbound:** Receives forwarded calls
- **Outbound:** Makes calls but displays YOUR verified number

### 2. "What's the forwarding code for?"

The forwarding code (`**21*+16504595418#`) tells YOUR mobile carrier:
> "When someone calls MY number, don't ring my phone. Instead, automatically forward the call to +16504595418 (the AI)."

This is a **carrier-level feature**, not a Voxanne feature. Works on all GSM carriers.

### 3. "Why can't the AI just use the managed number for outbound calls?"

It can, but customers would see:
- Caller ID: **+16504595418** (Unknown number from USA)

Most customers won't answer. But if you verify YOUR business number:
- Caller ID: **+2348141995397** (Your recognized business number)

Customers are 3x more likely to answer.

### 4. "Do I need to verify my number every time?"

**No.** Once verified, it stays verified permanently. You only need to:
- Enter the code once (during initial verification)
- The number remains in `verified_caller_ids` table forever
- Future outbound calls automatically use it

### 5. "What if I have BYOC (Bring Your Own Carrier)?"

**Inbound:** You don't need call forwarding. Your Twilio number directly routes to Vapi.

**Outbound:** Same process - verify your desired caller ID number.

---

## Error from Screenshot

Looking at your screenshot, I see this error:

```
Failed to initiate verification: twilioClient.outgoingCallerIds.create is not a function
```

**Root Cause:** The Twilio SDK is not being initialized correctly, or there's a TypeScript type issue.

**The Code (Line 114 in verified-caller-id.ts):**
```typescript
validation = await (twilioClient.outgoingCallerIds as any).create({
  phoneNumber: phoneNumber,
  friendlyName: `Voxanne AI - ${phoneNumber}`
});
```

**Possible Causes:**
1. Twilio SDK not installed: `npm install twilio`
2. Wrong Twilio client import
3. Invalid Twilio credentials (accountSid/authToken)

**Fix:**
1. Check `backend/package.json` - ensure `"twilio": "^X.X.X"` exists
2. Run: `npm install` in backend directory
3. Restart backend server
4. Check credentials in Supabase `org_credentials` or `twilio_subaccounts` table

---

## Database Schema Reference

### twilio_phone_numbers (Inbound)

```sql
CREATE TABLE twilio_phone_numbers (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  phone_number TEXT NOT NULL,  -- E.g., +16504595418
  status TEXT CHECK (status IN ('active', 'inactive')),
  country_code TEXT,  -- E.g., 'US'
  vapi_phone_id UUID,  -- Vapi platform phone ID
  friendly_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### verified_caller_ids (Outbound)

```sql
CREATE TABLE verified_caller_ids (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  phone_number TEXT NOT NULL,  -- E.g., +2348141995397
  country_code TEXT,  -- E.g., 'NG'
  verification_sid TEXT,  -- Twilio validation record
  status TEXT CHECK (status IN ('pending', 'verified', 'failed')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### agents (Links Both)

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  name TEXT,
  vapi_assistant_id TEXT,  -- Vapi AI assistant ID
  vapi_phone_number_id UUID,  -- Links to twilio_phone_numbers.vapi_phone_id
  inbound_enabled BOOLEAN DEFAULT false,  -- Use for receiving calls?
  outbound_enabled BOOLEAN DEFAULT false,  -- Use for making calls?
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints Reference

### Inbound (Call Forwarding)

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/phone-settings/status` | GET | Get managed number | `{ inbound: { managedNumber, status, vapiPhoneId } }` |
| `/api/managed-telephony/provision` | POST | Buy new managed number | `{ phoneNumber, vapiPhoneId }` |

### Outbound (Caller ID)

| Endpoint | Method | Purpose | Request Body | Response |
|----------|--------|---------|-------------|----------|
| `/api/verified-caller-id/verify` | POST | Start verification | `{ phoneNumber, countryCode }` | `{ validationSid, status }` |
| `/api/verified-caller-id/confirm` | POST | Check verification | `{ phoneNumber }` | `{ success, verifiedAt }` |
| `/api/verified-caller-id/list` | GET | Get verified numbers | - | `{ numbers: [...] }` |
| `/api/verified-caller-id/:id` | DELETE | Remove verification | - | `{ success }` |

---

## Summary for Your Use Case

**You are Nigerian user with:**
- Business phone: +2348141995397
- Voxanne managed number: +16504595418

**Setup:**

**1. Inbound (LEFT SIDE):**
- Carrier: Select "International / GSM"
- Forwarding code: `**21*+16504595418#`
- Action: Dial this on your +2348141995397 phone
- Result: Customers calling +2348141995397 reach your AI

**2. Outbound (RIGHT SIDE):**
- Enter: +2348141995397
- Click: "Start Verification"
- Answer: Verification call from Twilio
- Enter: 6-digit code on phone keypad
- Click: "I'm Done - Check Status"
- Result: Customers see +2348141995397 when AI calls them

**Both features work together** but are completely independent. You can set up one without the other.

---

## Next Steps to Fix Your Error

1. Check Twilio package installed:
```bash
cd backend
npm list twilio
```

2. If missing, install:
```bash
npm install twilio
```

3. Restart backend:
```bash
npm run dev
```

4. Try verification again

If still failing, check your Twilio credentials in the database.
