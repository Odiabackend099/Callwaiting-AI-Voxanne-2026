# TestSprite Fixes Implementation Plan (MVP-Focused)

**Date:** 2026-02-20
**Methodology:** 3-Step Coding Principle + Business User Perspective
**Objective:** Fix all TestSprite-discovered issues with MVP-first approach

---

## Executive Summary

**TestSprite Results:** 37 tests executed, 28 passed (76%), 6 failed, 3 skipped

**Critical Findings:**
- ✅ **Strengths:** Advisory locks work perfectly (1000 concurrent test passed), billing math 100% accurate, multi-tenant isolation solid
- ❌ **Blockers:** 2 HIGH severity issues preventing user workflows
- ⚠️ **Gaps:** 2 MEDIUM issues causing operational inefficiency
- 🔧 **Polish:** 2 LOW issues affecting UX/test coverage

**Business Impact:**
- **HIGH issues block customer value delivery** - appointments not visible = broken product
- **MEDIUM issues create technical debt** - missing features accumulate workarounds
- **LOW issues affect perception** - poor UX signals unpolished product

**SaaS Benchmark Analysis:**
- Calendly: Displays appointments instantly after booking (our dashboard fails this)
- Stripe: Formats currency consistently (we show "388 pence" vs "£3.88")
- Intercom: Allows rescheduling via single API call (we're missing endpoint)

---

## Phase 1: HIGH Priority Fixes (Production Blockers)

### Issue #1: Dashboard Appointments Not Displaying

**TestSprite Discovery:**
```
Test: Full booking lifecycle
Status: ❌ FAILED
Error: "Appointment created in database but not visible in dashboard"
Impact: User cannot see their bookings after successful creation
```

**Root Cause Analysis:**

1. **Hypothesis 1:** RLS policy blocking read access
   - Test: Query `appointments` table as test user
   - Expected: Should return appointments for org_id
   - Verify: Check `rls_policies` for `appointments` table

2. **Hypothesis 2:** Frontend query missing org_id filter
   - Test: Inspect `/dashboard/appointments` API call
   - Expected: Should include `org_id` from JWT
   - Verify: Check network tab for request parameters

3. **Hypothesis 3:** Date/time filtering too restrictive
   - Test: Check query date range logic
   - Expected: Should show all upcoming appointments
   - Verify: Inspect SQL WHERE clauses

**Implementation Plan:**

**Step 1: Diagnostic Script** (30 minutes)
```typescript
// backend/src/scripts/diagnose-appointments-issue.ts
import { createClient } from '@supabase/supabase-js';

async function diagnoseAppointmentsIssue() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const testOrgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';

  console.log('🔍 Diagnosing Appointments Display Issue\n');

  // Test 1: Raw database query (bypasses RLS)
  console.log('Test 1: Raw Database Query (Service Role)');
  const { data: rawData, error: rawError } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', testOrgId);

  console.log(`✅ Found ${rawData?.length || 0} appointments in database`);
  if (rawError) console.log(`❌ Error: ${rawError.message}`);

  // Test 2: User-level query (respects RLS)
  console.log('\nTest 2: User-Level Query (RLS Enforced)');
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // TODO: Get JWT token for test@demo.com
  const { data: userData, error: userError } = await userSupabase
    .from('appointments')
    .select('*');

  console.log(`✅ Found ${userData?.length || 0} appointments via RLS`);
  if (userError) console.log(`❌ Error: ${userError.message}`);

  // Test 3: Check RLS policies
  console.log('\nTest 3: RLS Policy Check');
  const { data: policies } = await supabase.rpc('pg_policies', {
    schemaname: 'public',
    tablename: 'appointments'
  });
  console.log(`✅ Found ${policies?.length || 0} RLS policies`);

  // Test 4: Frontend API endpoint
  console.log('\nTest 4: Frontend API Endpoint');
  const response = await fetch('https://voxanneai.onrender.com/api/appointments', {
    headers: {
      'Authorization': `Bearer ${TEST_JWT_TOKEN}`
    }
  });
  const apiData = await response.json();
  console.log(`✅ API returned ${apiData?.length || 0} appointments`);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Database: ${rawData?.length || 0} appointments`);
  console.log(`RLS Query: ${userData?.length || 0} appointments`);
  console.log(`API Endpoint: ${apiData?.length || 0} appointments`);
  console.log('\n💡 Issue likely in: ' + identifyBottleneck());
}
```

**Step 2: Fix Based on Diagnosis** (1-2 hours)

**Scenario A: RLS Policy Missing**
```sql
-- backend/supabase/migrations/20260220_fix_appointments_rls.sql
-- Add missing SELECT policy
CREATE POLICY "Users can view own org appointments"
ON appointments FOR SELECT
USING (
  org_id = (
    SELECT org_id FROM profiles
    WHERE id = auth.uid()
  )
);
```

**Scenario B: Frontend Query Bug**
```typescript
// src/app/dashboard/appointments/page.tsx
// BEFORE (BROKEN):
const { data: appointments } = await supabase
  .from('appointments')
  .select('*'); // ❌ Missing org_id filter

// AFTER (FIXED):
const { data: appointments } = await supabase
  .from('appointments')
  .select('*')
  .eq('org_id', user?.app_metadata?.org_id) // ✅ Explicit filter
  .order('scheduled_at', { ascending: true });
```

**Scenario C: API Endpoint Missing**
```typescript
// backend/src/routes/appointments.ts
import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';

const router = Router();

router.get('/', authenticateUser, async (req, res) => {
  const { orgId } = req.user!;

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      duration_minutes,
      status,
      contacts (
        first_name,
        last_name,
        phone
      )
    `)
    .eq('org_id', orgId)
    .gte('scheduled_at', new Date().toISOString()) // Only upcoming
    .order('scheduled_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

export default router;
```

**Step 3: Verification** (30 minutes)
```bash
# Run diagnostic script
cd backend
npx ts-node src/scripts/diagnose-appointments-issue.ts

# Expected Output:
# ✅ Database: 3 appointments
# ✅ RLS Query: 3 appointments
# ✅ API Endpoint: 3 appointments
# ✅ All layers returning consistent data

# Re-run TestSprite test
cd ..
npx testsprite run --test "Full booking lifecycle"
# Expected: ✅ PASSED
```

**Success Criteria:**
- [ ] Diagnostic script identifies exact bottleneck
- [ ] Fix applied to correct layer (RLS/API/Frontend)
- [ ] TestSprite test passes
- [ ] Dashboard displays all test appointments
- [ ] Manual verification: Book appointment → See in dashboard within 2 seconds

**Time Estimate:** 2-3 hours
**Risk:** Low (diagnostic-first approach prevents guessing)
**Dependencies:** None (can start immediately)

---

## Phase 2: MEDIUM Priority Fixes (Operational Efficiency)

### Issue #2: Appointment Reschedule Endpoint Missing

**TestSprite Discovery:**
```
Test: Reschedule appointment
Status: ❌ FAILED
Error: "404 Not Found - PATCH /api/appointments/:id"
Impact: Users cannot change appointment times without canceling and rebooking
```

**Business Context:**
- Calendly: Single-click reschedule with conflict checking
- Acuity Scheduling: Drag-and-drop calendar rescheduling
- Voxanne (current): Cancel + rebook = 2 API calls, worse UX

**SaaS Benchmark:**
```
Calendly API: PATCH /bookings/{uuid}
  Body: { start_time: "2026-02-27T10:00:00Z" }
  Response: 200 OK, { rescheduled: true, conflicts: [] }

Google Calendar API: PATCH /calendars/{id}/events/{eventId}
  Body: { start: { dateTime: "..." }, end: { ... } }
  Response: 200 OK, updated event object
```

**Implementation Plan:**

**Step 1: Create API Endpoint** (1 hour)
```typescript
// backend/src/routes/appointments.ts

router.patch('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { orgId } = req.user!;
  const { scheduled_at, duration_minutes } = req.body;

  // Validation
  if (!scheduled_at) {
    return res.status(400).json({ error: 'scheduled_at is required' });
  }

  const newScheduledAt = new Date(scheduled_at);
  if (isNaN(newScheduledAt.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  // Step 1: Verify appointment belongs to org
  const { data: existing, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Step 2: Check for conflicts using advisory lock
  const { data: rescheduleResult, error: rescheduleError } = await supabase
    .rpc('reschedule_appointment_with_lock', {
      p_appointment_id: id,
      p_org_id: orgId,
      p_new_scheduled_at: newScheduledAt.toISOString(),
      p_new_duration_minutes: duration_minutes || existing.duration_minutes
    });

  if (rescheduleError || !rescheduleResult?.success) {
    return res.status(409).json({
      error: 'Time slot unavailable',
      conflicting_appointment: rescheduleResult?.conflicting_appointment
    });
  }

  // Step 3: Update Google Calendar event
  try {
    await updateGoogleCalendarEvent(orgId, existing.google_event_id, {
      start: { dateTime: newScheduledAt.toISOString() },
      end: { dateTime: addMinutes(newScheduledAt, duration_minutes || existing.duration_minutes).toISOString() }
    });
  } catch (calendarError) {
    // Log but don't block (can be manually fixed)
    logger.error('Google Calendar update failed during reschedule', { error: calendarError });
  }

  // Step 4: Return updated appointment
  res.json({
    success: true,
    appointment: rescheduleResult.appointment
  });
});
```

**Step 2: Create Database Function** (1 hour)
```sql
-- backend/supabase/migrations/20260220_reschedule_appointment_with_lock.sql

CREATE OR REPLACE FUNCTION reschedule_appointment_with_lock(
  p_appointment_id UUID,
  p_org_id UUID,
  p_new_scheduled_at TIMESTAMPTZ,
  p_new_duration_minutes INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_lock_key BIGINT;
  v_conflict_count INTEGER;
  v_updated_appointment JSONB;
BEGIN
  -- Generate lock key for new time slot
  v_lock_key := ('x' || substr(md5(p_org_id::text || p_new_scheduled_at::text), 1, 16))::bit(64)::bigint;

  -- Acquire advisory lock (transaction-scoped)
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot being booked by another request');
  END IF;

  -- Check for conflicts (exclude the appointment being rescheduled)
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE org_id = p_org_id
    AND id != p_appointment_id
    AND status IN ('scheduled', 'confirmed')
    AND (
      -- New appointment overlaps with existing
      (p_new_scheduled_at, p_new_scheduled_at + (p_new_duration_minutes || ' minutes')::interval)
      OVERLAPS
      (scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval)
    );

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Time slot conflicts with existing appointment',
      'conflicting_appointment', (
        SELECT jsonb_build_object(
          'scheduled_at', scheduled_at,
          'duration_minutes', duration_minutes
        )
        FROM appointments
        WHERE org_id = p_org_id
          AND id != p_appointment_id
          AND status IN ('scheduled', 'confirmed')
          AND (p_new_scheduled_at, p_new_scheduled_at + (p_new_duration_minutes || ' minutes')::interval)
            OVERLAPS (scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval)
        LIMIT 1
      )
    );
  END IF;

  -- Update appointment
  UPDATE appointments
  SET
    scheduled_at = p_new_scheduled_at,
    duration_minutes = p_new_duration_minutes,
    updated_at = NOW()
  WHERE id = p_appointment_id
    AND org_id = p_org_id
  RETURNING jsonb_build_object(
    'id', id,
    'scheduled_at', scheduled_at,
    'duration_minutes', duration_minutes,
    'status', status
  ) INTO v_updated_appointment;

  RETURN jsonb_build_object(
    'success', true,
    'appointment', v_updated_appointment
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 3: Frontend Integration** (1 hour)
```typescript
// src/components/appointments/RescheduleModal.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function RescheduleModal({ appointment, onClose, onSuccess }) {
  const [newDateTime, setNewDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReschedule = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          scheduled_at: newDateTime,
          duration_minutes: appointment.duration_minutes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reschedule failed');
      }

      onSuccess(data.appointment);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <h2>Reschedule Appointment</h2>
      <p>Current: {new Date(appointment.scheduled_at).toLocaleString()}</p>

      <input
        type="datetime-local"
        value={newDateTime}
        onChange={(e) => setNewDateTime(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button onClick={handleReschedule} disabled={loading}>
        {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}
```

**Step 4: TestSprite Verification** (30 minutes)
```typescript
// tests/testsprite/booking/booking.spec.ts (add new test)

it('should reschedule appointment without conflicts', async () => {
  // Step 1: Book initial appointment
  const booking1 = await context.apiCall({
    method: 'POST',
    url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
    body: {
      orgId: testOrgId,
      contactId: testContactId,
      scheduledAt: '2026-02-27T09:00:00Z',
      durationMinutes: 45
    }
  });
  expect(booking1.success).toBe(true);

  // Step 2: Reschedule to new time
  const reschedule = await context.apiCall({
    method: 'PATCH',
    url: `https://voxanneai.onrender.com/api/appointments/${booking1.appointmentId}`,
    body: {
      scheduled_at: '2026-02-27T14:00:00Z',
      duration_minutes: 45
    }
  });

  expect(reschedule.success).toBe(true);
  expect(reschedule.appointment.scheduled_at).toContain('14:00:00');

  // Step 3: Verify database updated
  const dbResult = await context.database.query({
    sql: 'SELECT scheduled_at FROM appointments WHERE id = $1',
    params: [booking1.appointmentId]
  });
  expect(dbResult.rows[0].scheduled_at).toContain('14:00:00');

  // Step 4: Verify old slot is now available
  const availability = await context.apiCall({
    method: 'POST',
    url: 'https://voxanneai.onrender.com/api/vapi-tools/check-availability',
    body: { orgId: testOrgId, requestedDate: '2026-02-27' }
  });
  expect(availability.availableSlots).toContain('09:00'); // Old slot free again
});
```

**Success Criteria:**
- [ ] PATCH endpoint created and tested
- [ ] Database function prevents reschedule conflicts
- [ ] Google Calendar event updates automatically
- [ ] TestSprite test passes
- [ ] Frontend modal works end-to-end

**Time Estimate:** 3-4 hours
**Risk:** Medium (calendar integration complexity)
**Dependencies:** None

---

### Issue #3: Reservation Cleanup Not Scheduled

**TestSprite Discovery:**
```
Test: Credit reservation expiration
Status: ⚠️ WARNING
Issue: "Cleanup job exists but not scheduled to run"
Impact: Stale reservations accumulate, inflating reserved_credits count
```

**Backend Analysis:**

Current state:
```typescript
// backend/src/jobs/reservation-cleanup.ts exists ✅
// But never scheduled! ❌
```

**SaaS Benchmark:**
- Stripe: Pending charges expire after 7 days (automatic cleanup)
- AWS: Reserved instances cleanup via CloudWatch Events (hourly)
- Shopify: Order reservations expire after 10 minutes (background job)

**Implementation Plan:**

**Step 1: Schedule Job on Server Startup** (30 minutes)
```typescript
// backend/src/server.ts

import { scheduleReservationCleanup } from './jobs/reservation-cleanup';

// ... existing code ...

// Schedule background jobs on server start
scheduleReservationCleanup(); // Run every hour

logger.info('✅ Background jobs scheduled: reservation cleanup (hourly)');
```

**Step 2: Verify Cleanup Logic** (30 minutes)
```typescript
// backend/src/jobs/reservation-cleanup.ts (verify existing code)

import { scheduleJob } from 'node-schedule';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

export function scheduleReservationCleanup() {
  // Run every hour at :00
  scheduleJob('0 * * * *', async () => {
    logger.info('Running reservation cleanup job');

    try {
      const { data, error } = await supabase.rpc('cleanup_expired_reservations');

      if (error) {
        logger.error('Reservation cleanup failed', { error });
      } else {
        logger.info('Reservation cleanup completed', {
          released: data?.released_count || 0,
          total_credits_released: data?.total_credits_released || 0
        });
      }
    } catch (err) {
      logger.error('Reservation cleanup exception', { error: err });
    }
  });

  logger.info('Reservation cleanup scheduled (hourly at :00)');
}
```

**Step 3: Add Monitoring** (30 minutes)
```typescript
// backend/src/routes/monitoring.ts (add new endpoint)

router.get('/reservation-cleanup-status', authenticateAdmin, async (req, res) => {
  // Get last cleanup timestamp
  const { data: lastRun } = await supabase
    .from('system_logs')
    .select('created_at, metadata')
    .eq('event_type', 'reservation_cleanup')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get current stale reservations count
  const { count: staleCount } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'call_reservation')
    .lt('expires_at', new Date().toISOString());

  res.json({
    last_cleanup: lastRun?.created_at,
    last_cleanup_released: lastRun?.metadata?.released_count,
    current_stale_reservations: staleCount,
    health: staleCount > 100 ? 'unhealthy' : 'healthy'
  });
});
```

**Step 4: Alert on Accumulation** (30 minutes)
```typescript
// backend/src/jobs/reservation-cleanup.ts (enhance)

export function scheduleReservationCleanup() {
  scheduleJob('0 * * * *', async () => {
    logger.info('Running reservation cleanup job');

    try {
      const { data, error } = await supabase.rpc('cleanup_expired_reservations');

      if (error) {
        logger.error('Reservation cleanup failed', { error });

        // Alert if cleanup fails
        await sendSlackAlert('🔴 Reservation Cleanup Failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        const releasedCount = data?.released_count || 0;

        logger.info('Reservation cleanup completed', {
          released: releasedCount,
          total_credits_released: data?.total_credits_released || 0
        });

        // Alert if unusually high accumulation
        if (releasedCount > 50) {
          await sendSlackAlert('⚠️ High Reservation Accumulation', {
            released: releasedCount,
            message: 'Check for call termination issues',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      logger.error('Reservation cleanup exception', { error: err });
    }
  });
}
```

**Success Criteria:**
- [ ] Cleanup job scheduled on server startup
- [ ] Job runs every hour (verified via logs)
- [ ] Monitoring endpoint shows last cleanup timestamp
- [ ] Slack alerts on cleanup failures
- [ ] TestSprite warning resolved

**Time Estimate:** 2 hours
**Risk:** Low (code exists, just needs scheduling)
**Dependencies:** Slack webhook configured

---

## Phase 3: LOW Priority Fixes (UX Polish)

### Issue #4: Wallet Balance Formatting

**TestSprite Discovery:**
```
Test: Credit deduction display
Status: ⚠️ WARNING
Issue: "Balance shows '388 pence' instead of '£3.88'"
Impact: Confusing UX, unprofessional appearance
```

**SaaS Benchmark:**
- Stripe Dashboard: Always shows "£3.88" (currency symbol + 2 decimals)
- PayPal: "$25.00" format consistently
- Wise: "€12.50" with proper locale formatting

**Implementation Plan:**

**Step 1: Create Formatting Utility** (30 minutes)
```typescript
// src/utils/currency.ts

export function formatPence(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(pounds);
}

// Examples:
// formatPence(388)   → "£3.88"
// formatPence(2500)  → "£25.00"
// formatPence(99)    → "£0.99"
// formatPence(0)     → "£0.00"
```

**Step 2: Update Dashboard Components** (1 hour)
```typescript
// src/components/dashboard/WalletBalance.tsx

import { formatPence } from '@/utils/currency';

export function WalletBalance({ balancePence }: { balancePence: number }) {
  return (
    <div className="wallet-balance-card">
      <h3>Current Balance</h3>
      <p className="balance-value">
        {formatPence(balancePence)} {/* ✅ Formatted */}
      </p>
      <p className="balance-subtitle">
        {balancePence} credits available {/* Optional: show pence for debugging */}
      </p>
    </div>
  );
}
```

**Step 3: Update Transaction History** (30 minutes)
```typescript
// src/components/dashboard/TransactionHistory.tsx

import { formatPence } from '@/utils/currency';

export function TransactionHistory({ transactions }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(tx => (
          <tr key={tx.id}>
            <td>{new Date(tx.created_at).toLocaleDateString()}</td>
            <td>{tx.type}</td>
            <td className={tx.amount_pence > 0 ? 'positive' : 'negative'}>
              {tx.amount_pence > 0 ? '+' : ''}
              {formatPence(Math.abs(tx.amount_pence))} {/* ✅ Formatted */}
            </td>
            <td>{formatPence(tx.balance_after_pence)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Success Criteria:**
- [ ] Utility function created with Intl.NumberFormat
- [ ] All dashboard components use formatPence()
- [ ] Manual verification: Dashboard shows "£3.88" not "388 pence"
- [ ] TestSprite warning resolved

**Time Estimate:** 2 hours
**Risk:** Very Low (cosmetic change only)
**Dependencies:** None

---

### Issue #5: Stripe Checkout E2E Configuration

**TestSprite Discovery:**
```
Test: Wallet top-up via Stripe
Status: ⏭️ SKIPPED
Reason: "Stripe test mode not configured for CI environment"
Impact: Cannot test payment flow end-to-end in CI/CD
```

**Context:** This is NOT a production bug - it's a test infrastructure gap.

**SaaS Benchmark:**
- Stripe's own CI: Uses test API keys, automated checkout completion
- Shopify Checkout CI: Mock Stripe API for E2E tests
- Vercel Commerce: Stripe test mode with auto-complete webhooks

**Implementation Plan:**

**Step 1: Add Stripe Test Credentials** (15 minutes)
```yaml
# testsprite.config.yml

environments:
  production:
    stripe_mode: test
    stripe_publishable_key: pk_test_...  # From Stripe Dashboard
    stripe_secret_key: sk_test_...      # From Stripe Dashboard
```

**Step 2: Configure TestSprite Stripe Integration** (30 minutes)
```typescript
// tests/testsprite/billing/billing.spec.ts

it('should complete Stripe checkout in test mode', async () => {
  const page = await browser.newPage();

  // Step 1: Navigate to wallet page
  await page.goto('https://voxanne.ai/dashboard/wallet');

  // Step 2: Click top-up button
  await page.click('button[data-amount="2500"]'); // £25

  // Step 3: TestSprite automatically handles Stripe test mode
  await page.waitForURL('**/checkout/stripe**');

  // Step 4: Use Stripe test card (TestSprite fills automatically)
  await context.handleStripeCheckout({
    card: '4242424242424242', // Stripe test card
    expiry: '12/34',
    cvc: '123',
    autoComplete: true // TestSprite submits form
  });

  // Step 5: Wait for redirect back to dashboard
  await page.waitForURL('**/dashboard/wallet**', { timeout: 15000 });

  // Step 6: Verify balance increased
  await page.waitForSelector('.balance-value');
  const balanceText = await page.textContent('.balance-value');
  expect(balanceText).toContain('£25.00'); // ✅ Formatted properly

  // Step 7: Verify transaction logged
  const dbResult = await context.database.query({
    sql: `SELECT * FROM credit_transactions
          WHERE org_id = $1 AND type = 'topup'
          ORDER BY created_at DESC LIMIT 1`,
    params: [testOrgId]
  });
  expect(dbResult.rows[0].amount_pence).toBe(2500);
});
```

**Success Criteria:**
- [ ] Stripe test credentials added to TestSprite config
- [ ] Checkout test passes in CI/CD
- [ ] No manual intervention required
- [ ] TestSprite skipped test now passes

**Time Estimate:** 1 hour
**Risk:** Very Low (test-only change)
**Dependencies:** Stripe test API keys

---

### Issue #6: Google Calendar OAuth Test Setup

**TestSprite Discovery:**
```
Test: Google Calendar OAuth flow
Status: ⏭️ SKIPPED
Reason: "Requires manual OAuth consent screen approval"
Impact: Cannot test calendar integration end-to-end
```

**Context:** OAuth flows are inherently hard to automate due to consent screens.

**SaaS Benchmark:**
- Google's OAuth Testing: Service account bypass for CI
- Slack API Testing: Pre-approved test tokens
- GitHub OAuth Testing: Mock OAuth server for E2E

**Implementation Plan:**

**Option A: Service Account (Recommended for CI)** (2 hours)
```typescript
// tests/testsprite/helpers/google-calendar-mock.ts

import { OAuth2Client } from 'google-auth-library';

export async function setupTestCalendarIntegration(orgId: string) {
  // Use service account (no OAuth required)
  const serviceAccount = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
  );

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  const calendar = google.calendar({ version: 'v3', auth });

  // Create test calendar
  const { data: testCalendar } = await calendar.calendars.insert({
    requestBody: {
      summary: `TestSprite - ${orgId}`,
      description: 'Automated test calendar',
      timeZone: 'Europe/London'
    }
  });

  // Store credentials in database (simulates OAuth result)
  await supabase.from('integrations').insert({
    org_id: orgId,
    provider_type: 'google_calendar',
    credentials: {
      access_token: 'service_account_token',
      refresh_token: 'not_needed',
      calendar_id: testCalendar.id
    },
    is_active: true
  });

  return testCalendar.id;
}
```

**Option B: Pre-Authorized Test Account** (1 hour)
```markdown
# Manual Setup (One-Time)

1. Create dedicated test Google Workspace account:
   - Email: testsprite@voxanne.ai
   - Purpose: Automated testing only

2. Authorize Voxanne AI app:
   - Login as testsprite@voxanne.ai
   - Complete OAuth flow manually
   - Save refresh token to test environment

3. Use refresh token in CI:
   ```yaml
   # .github/workflows/testsprite.yml
   env:
     GOOGLE_CALENDAR_TEST_REFRESH_TOKEN: ${{ secrets.GOOGLE_CALENDAR_TEST_REFRESH_TOKEN }}
   ```

4. TestSprite uses pre-authorized account:
   - No consent screen required
   - Fully automated E2E tests
   - Refresh token never expires (delegated admin)
```

**Success Criteria:**
- [ ] Service account OR pre-authorized test account configured
- [ ] OAuth test no longer skipped
- [ ] Calendar integration tested end-to-end
- [ ] CI/CD runs without manual intervention

**Time Estimate:** 2 hours (Option A) or 1 hour (Option B)
**Risk:** Low (test-only configuration)
**Dependencies:** Google Cloud project setup

---

## Implementation Timeline

**Total Time Estimate:** 12-16 hours (1.5-2 days for 1 developer)

**Day 1 (MVP Launch Blockers):**
- Morning: Phase 1 - Fix appointments display issue (3 hours)
- Afternoon: Phase 2 - Implement reschedule endpoint (4 hours)
- **Deliverable:** Core user workflows functional

**Day 2 (Operational Polish):**
- Morning: Phase 2 - Schedule reservation cleanup (2 hours)
- Afternoon: Phase 3 - UX polish (wallet formatting, Stripe test setup, calendar test setup) (4 hours)
- **Deliverable:** Production-ready with comprehensive test coverage

---

## Risk Assessment

| Issue | Severity | Risk | Mitigation |
|-------|----------|------|------------|
| #1: Appointments not displaying | HIGH | Low | Diagnostic script identifies exact cause |
| #2: Reschedule endpoint missing | MEDIUM | Medium | Reuse existing advisory lock pattern |
| #3: Reservation cleanup not scheduled | MEDIUM | Low | Code exists, just needs startup scheduling |
| #4: Wallet formatting | LOW | Very Low | Pure cosmetic change |
| #5: Stripe E2E testing | LOW | Very Low | Test-only configuration |
| #6: Calendar OAuth testing | LOW | Low | Service account bypass available |

**Overall Risk:** Low - No breaking changes, all fixes are additive

---

## Success Metrics

**Phase 1 Complete:**
- ✅ TestSprite pass rate: 76% → 85%+ (appointments + reschedule tests passing)
- ✅ User can see all booked appointments in dashboard
- ✅ User can reschedule appointments without canceling

**Phase 2 Complete:**
- ✅ TestSprite pass rate: 85% → 92%+ (reservation cleanup test passing)
- ✅ Stale reservations cleaned up hourly
- ✅ Slack alerts on cleanup failures

**Phase 3 Complete:**
- ✅ TestSprite pass rate: 92% → 100% (all tests passing, 0 skipped)
- ✅ Wallet displays professional currency formatting
- ✅ CI/CD runs full E2E suite including Stripe + Google Calendar

**Business Impact:**
- Customer satisfaction: Users can manage appointments end-to-end
- Operational efficiency: Automated cleanup prevents manual intervention
- Professional polish: Proper currency formatting signals mature product

---

## Post-Implementation Verification

**TestSprite Re-Run:**
```bash
# Run full test suite
npx testsprite run \
  --config testsprite.config.yml \
  --suite full_regression \
  --browsers chrome,firefox \
  --env production \
  --report-format html

# Expected Results:
# ✅ 37/37 tests passing (100%)
# ✅ 0 tests failed
# ✅ 0 tests skipped
# ✅ Performance benchmarks met (dashboard <3s, API <500ms)
```

**Manual Verification Checklist:**
- [ ] Book appointment → See in dashboard immediately
- [ ] Reschedule appointment → Conflict detection works
- [ ] Check wallet balance → Shows "£X.XX" format
- [ ] Complete Stripe checkout → Balance updates
- [ ] Wait 1 hour → Verify cleanup job ran (check logs)
- [ ] Trigger call → Credit reservation → Cleanup after call ends

---

## Appendix: 3-Step Coding Principle Applied

**Step 1: Plan First** ✅
- Created diagnostic approach for Issue #1 (appointments display)
- Researched SaaS benchmarks (Calendly, Stripe, Google Calendar)
- Identified root causes before coding
- Prioritized by business impact (HIGH → MEDIUM → LOW)

**Step 2: Create planning.md** ✅
- This document serves as comprehensive planning.md
- Includes implementation steps, code examples, verification procedures
- Documents risks, dependencies, time estimates
- Provides success criteria for each phase

**Step 3: Execute Phase by Phase** (Next)
- Phase 1: Fix HIGH priority issues first (appointments, reschedule)
- Phase 2: Address MEDIUM priority operational issues (cleanup)
- Phase 3: Polish LOW priority UX issues (formatting, test coverage)
- Verify after each phase (TestSprite re-run)

**Business User Perspective Applied:**
- Benchmarked against industry leaders (Calendly, Stripe, Google)
- Prioritized by customer impact (broken appointments = lost customers)
- Focused on MVP (fix blockers first, polish later)
- Provided clear business metrics (pass rate improvement, customer satisfaction)

---

**Ready to Execute:** All issues analyzed, solutions designed, implementation order defined. Proceed with Phase 1 immediately.
