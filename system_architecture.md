# System Architecture & Configuration

This document provides the verified configuration and schema for the CallWaiting AI "Modular Agency" system.

## 1. Vapi Agent Configuration (JSON)

This JSON represents the "Master Agent" configuration used for Inbound Calls.

```json
{
  "name": "Voxanne (Inbound Master)",
  "voice": {
    "provider": "11labs",
    "voiceId": "hana",
    "stability": 0.5,
    "similarityBoost": 0.75
  },
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2-medical",
    "language": "en"
  },
  "model": {
    "provider": "anthropic",
    "model": "claude-3-haiku-20240307",
    "messages": [
      {
        "role": "system",
        "content": "You are Voxanne, a premium medical receptionist. Your goal is to book appointments. You must detect if a user asks for 'Rhinoplasty' but drops off, and flag it for the SMS agent."
      }
    ]
  },
  "functions": [
    {
      "name": "claim_slot_atomic",
      "description": "Locks a calendar slot implementation pessimistic locking to prevent double bookings.",
      "parameters": {
        "type": "object",
        "properties": {
          "slot_time": { "type": "string", "format": "date-time" }
        },
        "required": ["slot_time"]
      }
    }
  ]
}
```

## 2. Supabase SQL Schema

### Core Tables

#### `appointments`

Stores booking data with atomic locking support.

- `id` (uuid, PK)
- `org_id` (uuid)
- `contact_id` (uuid)
- `status` (text) - e.g. 'booked', 'pending'
- `scheduled_at` (timestamptz)
- `hold_id` (uuid) - For atomic locking
- `created_at` (timestamptz)

#### `call_logs`

Stores immutable records of voice interactions.

- `id` (uuid, PK)
- `org_id` (uuid)
- `lead_id` (uuid)
- `transcript` (text) - Redacted PII
- `summary` (text)
- `duration` (integer)

#### `contacts` (Leads)

Stores patient CRM data.

- `id` (uuid, PK)
- `org_id` (uuid)
- `phone` (text)
- `name` (text)
- `redacted_medical_history` (text) - Moved from transcript

### Row Level Security (RLS) Policies

All tables enforce strict "Silo" isolation using `org_id`.

#### `appointments`

- **Policy:** `appointments_org_isolation`
- **Definition:**

  ```sql
  (org_id = (
     SELECT campaigns.org_id
     FROM campaigns
     WHERE campaigns.user_id = auth.uid()
     LIMIT 1
  ))
  ```

  *(Note: This links users to orgs via the campaigns table or a similar auth mapping)*

#### `contacts`

- **Select Policy:** `contacts_org_select` -> `(org_id = auth_org_id())`
- **Insert Policy:** `contacts_org_insert` -> `(org_id = auth_org_id())`
- **Update Policy:** `contacts_org_update` -> `(org_id = auth_org_id())`
- **Delete Policy:** `contacts_org_delete` -> `(org_id = auth_org_id())`

#### `call_logs`

- **Select Policy:** `call_logs_org_select` -> `(org_id = auth_org_id())`
- **Update Policy:** `call_logs_org_update` -> `(org_id = auth_org_id())`

## 3. Atomic Locking Logic (RPC)

```sql
CREATE OR REPLACE FUNCTION claim_slot_atomic(
  p_slot_time TIMESTAMPTZ,
  p_contact_id UUID,
  p_org_id UUID
) RETURNS UUID AS $$
DECLARE
  v_hold_id UUID;
BEGIN
  -- Pesticimistic Lock via SELECT FOR UPDATE
  PERFORM 1
  FROM appointments
  WHERE scheduled_at = p_slot_time
    AND org_id = p_org_id
    AND status = 'booked'
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  -- Proceed to insert/lock
  INSERT INTO appointments (...) VALUES (...) RETURNING id INTO v_hold_id;
  RETURN v_hold_id;
END;
$$ LANGUAGE plpgsql;
```
