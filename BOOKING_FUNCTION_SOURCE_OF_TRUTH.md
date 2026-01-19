# 📌 Single Source of Truth: Atomic Booking Function

**Status**: ✅ Consolidation Complete  
**Date**: 2026-01-18  
**Version**: 1.0  

---

## ⚠️ CRITICAL: ONE FUNCTION ONLY

There is **EXACTLY ONE** booking function in production:

```
public.book_appointment_atomic(
    p_org_id uuid,
    p_patient_name text,
    p_patient_email text,
    p_patient_phone text,
    p_service_type text,
    p_scheduled_at timestamp with time zone,
    p_duration_minutes integer
) RETURNS json
```

**All other booking functions are DELETED.**

---

## 🎯 Function Purpose

This function atomically creates a booking with:
1. **Race condition prevention** via `pg_advisory_xact_lock()`
2. **Slot conflict detection** before insert
3. **Contact normalization** (E.164 phone, title case names)
4. **Multi-tenant isolation** via org_id filtering
5. **Proper error handling** with meaningful error codes

---

## 📍 Where It's Called

### Backend Route Handler
**File**: `backend/src/routes/vapi-tools-routes.ts`  
**Line**: ~799  
**Endpoint**: `POST /api/vapi/tools/bookClinicAppointment`

```typescript
const { data, error } = await supabase.rpc('book_appointment_atomic', {
  p_org_id: orgId,
  p_patient_name: name,
  p_patient_email: email,
  p_patient_phone: phone,
  p_service_type: rawArgs.serviceType || 'consultation',
  p_scheduled_at: scheduledAt,
  p_duration_minutes: 60
});
```

---

## ✅ Implementation Checklist

- [x] Deleted `book_appointment_atomic_v2` (old version with race conditions)
- [x] Consolidated to single `book_appointment_atomic` function
- [x] Added database comment documenting this is production function
- [x] Verified backend calls correct function by name
- [x] Tested atomic lock prevents double-booking
- [x] Tested contact normalization works
- [x] Tested multi-tenant isolation works

---

## 🔒 Function Response

### Success Response
```json
{
  "success": true,
  "appointment_id": "uuid",
  "contact_id": "uuid",
  "scheduled_at": "2026-01-18T15:00:00+00:00",
  "created_at": "2026-01-18T18:55:00+00:00"
}
```

### Error Response (Slot Unavailable)
```json
{
  "success": false,
  "error": "SLOT_UNAVAILABLE",
  "message": "SLOT_UNAVAILABLE: This time slot is already booked",
  "created_at": "2026-01-18T18:55:00+00:00"
}
```

### Error Response (Invalid Org)
```json
{
  "success": false,
  "error": "INVALID_ORGANIZATION",
  "message": "The organization does not exist",
  "created_at": "2026-01-18T18:55:00+00:00"
}
```

---

## 🚨 DO NOT

❌ Create alternative booking functions (like `book_appointment_atomic_v3`)  
❌ Call `book_appointment_atomic_v2` (it's been deleted)  
❌ Bypass the RPC and do raw INSERT operations  
❌ Call this function without org_id (multi-tenant security risk)  

---

## ✨ DO

✅ Always use `book_appointment_atomic` for all booking operations  
✅ Include org_id from request metadata or JWT context  
✅ Handle both success and error response types  
✅ Let the advisory lock protect against race conditions  
✅ Document any new code that calls this function  

---

## 🧪 Testing

To verify this function works correctly:

```bash
# Run the direct validation test
python3 RPC_DIRECT_VALIDATION.py

# Or test via SQL directly
SELECT book_appointment_atomic(
    'a0000000-0000-0000-0000-000000000001'::UUID,
    'Test User',
    'test@example.com',
    '+15551234567',
    'consultation',
    '2026-02-01T14:00:00Z'::TIMESTAMPTZ,
    60
);
```

---

## 📊 Migration History

| Date | Change | Status |
|------|--------|--------|
| 2026-01-18 | Created `book_appointment_atomic` with advisory locks | ✅ Applied |
| 2026-01-18 | Fixed leads.status constraint (was 'active' → 'pending') | ✅ Applied |
| 2026-01-18 | Removed duration_minutes from INSERT (column doesn't exist) | ✅ Applied |
| 2026-01-18 | **Deleted `book_appointment_atomic_v2` - CONSOLIDATION** | ✅ Applied |
| 2026-01-18 | Added database comment for single source of truth | ✅ Applied |

---

## 🔐 Security Notes

- The function uses `SECURITY DEFINER` to run with elevated privileges
- This is safe because the function validates org_id before any operations
- RLS policies on `leads` and `appointments` provide secondary isolation
- Advisory locks are scoped to transaction, automatically released

---

## 📞 Questions?

**Q: Can we still use REST API to call this?**  
A: Yes! Use: `POST {SUPABASE_URL}/rest/v1/rpc/book_appointment_atomic`

**Q: What if we need a different booking flow?**  
A: Modify THIS function or create a wrapper, but don't create a new booking function

**Q: How do we know this is being used?**  
A: All bookings go through the Vapi webhook → backend endpoint → this RPC

**Q: Is it safe to deploy?**  
A: Yes! The function has been tested with:
- Direct RPC calls (SQL)
- REST API calls via Supabase
- HTTP endpoint calls via backend

---

## ✅ Validation Results (After Consolidation)

```
Criterion 1 (Normalization):     ✅ PASS
Criterion 2 (Date Prevention):   ✅ PASS
Criterion 3 (Slot Conflicts):    ✅ PASS
Criterion 4 (Multi-Tenant):      ✅ PASS

Overall: 4/4 = 100% ✅
Production Ready: YES 🚀
```

---

**Document Status**: Complete  
**Last Updated**: 2026-01-18 18:56 UTC  
**Next Review**: Before any schema changes  
