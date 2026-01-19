# 🧹 Operation Austin: Clean Room Execution Plan

**Status:** CEO-Authorized Database Purge + Tool Sync + Verification  
**Date:** 2026-01-19  
**Objective:** Phone-First Identity SSOT with Zero Legacy Noise

---

## Phase 1: Database Sanitization (The Purge)

### Requirements
- Truncate `appointments`, `leads`, `contacts`, `call_logs` tables
- Restart identity sequences to ensure clean IDs
- Preserve schema (RLS policies, constraints, column definitions)
- Backup verification completed before execution

### Implementation
```sql
-- TRUNCATE in cascade order (respects foreign keys)
TRUNCATE TABLE appointments CASCADE;
TRUNCATE TABLE leads CASCADE;
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE call_logs CASCADE;

-- Reset identity sequences
ALTER SEQUENCE appointments_id_seq RESTART WITH 1;
ALTER SEQUENCE leads_id_seq RESTART WITH 1;
ALTER SEQUENCE contacts_id_seq RESTART WITH 1;
ALTER SEQUENCE call_logs_id_seq RESTART WITH 1;
```

### Testing Criteria
- [ ] Query returns 0 rows for each table
- [ ] RLS policies still active (not dropped)
- [ ] Foreign key constraints intact
- [ ] Next INSERT receives ID = 1 (or first UUID)

---

## Phase 2: Vapi Tool Sync (The Missing Link)

### Requirements
- Trigger `ToolSyncService.syncAllToolsForAssistant()` for Sara org
- Tool: `bookClinicAppointment` must be registered globally in Vapi
- Tool must be linked to Sara's assistant (`d7c52ba1-c3ab-46d7-8a2d-85e7dc49e99e`)
- Verify via Vapi API that `toolIds` array is populated

### Implementation
```bash
# Option A: Via backend API (if endpoint exists)
curl -X POST "http://localhost:3001/api/founders/save-agent" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orgId": "46cf2995-2bee-44e3-838b-24151486fe4e", ...}'

# Option B: Direct RPC or service call
# (Requires backend restart or direct function invocation)
```

### Verification Curl
```bash
curl -s -X GET "https://api.vapi.ai/assistant/d7c52ba1-c3ab-46d7-8a2d-85e7dc49e99e" \
  -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
  | jq '.model.toolIds'
# Expected: Array with tool IDs, NOT null
```

### Testing Criteria
- [ ] Vapi API returns `toolIds: [...]` (not null)
- [ ] Tool name matches `bookClinicAppointment`
- [ ] Tool URL points to backend endpoint
- [ ] No VAPI_PRIVATE_KEY errors in response

---

## Phase 3: Operation Austin Clean Test (The Verification)

### Requirements
- Execute booking curl with Austin's data (clean phone `+13024648548`)
- Verify 1 lead created (not duplicate)
- Verify 1 appointment created
- Verify SMS bridge logs correct 404 (Twilio not configured)
- Verify ZERO hardcoded phone numbers in logs

### Test Data
```json
{
  "patientName": "Austin",
  "patientPhone": "+13024648548",
  "patientEmail": "austin99@gmail.com",
  "appointmentDate": "2026-01-21",
  "appointmentTime": "12:00",
  "serviceType": "Botox Consultation"
}
```

### Implementation
```bash
curl -X POST "http://localhost:3001/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Verification Queries
```sql
-- Verify 1 lead exists
SELECT COUNT(*) FROM leads WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
-- Expected: 1

-- Verify 1 appointment exists
SELECT COUNT(*) FROM appointments WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
-- Expected: 1

-- Verify phone-first key uniqueness
SELECT phone, COUNT(*) as count FROM leads 
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
GROUP BY phone;
-- Expected: 1 row with count = 1

-- Verify appointment linked correctly
SELECT a.id, a.contact_id, l.phone, l.name FROM appointments a
JOIN leads l ON a.contact_id = l.id
WHERE a.org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
-- Expected: 1 row, Austin's data
```

### Testing Criteria
- [ ] Leads table has exactly 1 row for Austin
- [ ] Appointments table has exactly 1 row
- [ ] Contact ID foreign key valid
- [ ] SMS bridge log shows 404 (Twilio unconfigured)
- [ ] Log contains NO hardcoded `+1...` phone numbers
- [ ] API response contains correct appointmentId (from DB)

---

## Architecture: Phone-First Identity SSOT

| Component | Source of Truth | Enforcement |
|-----------|-----------------|-------------|
| **Contact Identity** | Phone (E.164) | `book_appointment_atomic` RPC checks `leads.phone` |
| **Credential Storage** | `integrations` table | `IntegrationDecryptor` enforces encryption |
| **Tool Registry** | Vapi Global (linked by ID) | `ToolSyncService` manages linkage |
| **UI State** | `useIntegration()` hook | Zero fallback values returned |
| **Appointment Binding** | `leads.id` → `appointments.contact_id` | RLS + FK constraint |

---

## Success Criteria (All Must Pass)

- ✅ Database is clean (0 legacy records)
- ✅ Vapi assistant has tools linked (`toolIds != null`)
- ✅ One booking creates exactly 1 lead (phone-deduped)
- ✅ One appointment persists in DB with correct contact reference
- ✅ SMS bridge fails gracefully (404, not hardcoded fallback)
- ✅ Zero hardcoded phone numbers in logs or responses
- ✅ RLS policies still enforced (multi-tenant isolation intact)

---

## Rollback Plan (If Needed)

If any phase fails:
1. Stop all backend services
2. Restore database from automated backup (Supabase maintains 7-day retention)
3. Revert any code changes
4. Restart from Phase 1

---

**Prepared by:** Copilot (AI Developer)  
**Authorized by:** CEO  
**Execute Date:** 2026-01-19  
**Target Status:** 🧹 CLEAN ROOM READY
