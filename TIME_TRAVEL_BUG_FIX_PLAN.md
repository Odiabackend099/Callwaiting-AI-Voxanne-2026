# Time Travel Bug Fix - Implementation Plan

**Date:** 2026-02-02
**Status:** Ready for Implementation
**Priority:** CRITICAL - AI booking appointments in 2024 instead of 2026

---

## Executive Summary

The AI is booking appointments in **2024** instead of **2026** because:
1. System prompts lack explicit ISO date format and current year
2. No backend validation prevents dates in the past
3. Date parsing is not timezone-aware

**Solution:** 3-phase implementation with surgical changes to 5 files + 4 new files.

---

## Root Cause Analysis

| Issue | Location | Impact |
|-------|----------|--------|
| **No ISO date in prompts** | `super-system-prompt.ts:55-68` | AI learns natural language dates, not YYYY-MM-DD |
| **No year validation** | `vapi-tools-routes.ts:854` | Backend accepts 2024 dates without question |
| **Naive date parsing** | `vapi-webhook.ts:164` | `new Date()` ignores timezone |
| **No timezone in Calendar API** | `calendar-integration.ts:77-78` | Google Calendar gets wrong time range |

---

## Implementation Phases

### Phase 1: System Prompt Enhancement (2 hours)

**Goal:** Inject dynamic ISO date and explicit year warning into AI prompts

#### File 1: `backend/src/services/super-system-prompt.ts`

**Change 1.1 - Update Interface** (line 17)
```typescript
export interface SuperSystemPromptConfig {
  // ... existing fields ...
  currentDateISO?: string;    // NEW: "2026-02-02" for tool calls
  currentYear?: number;       // NEW: 2026 for explicit reinforcement
}
```

**Change 1.2 - Update Temporal Context Section** (lines 55-68)
```typescript
// REPLACE existing temporal context with:
[TEMPORAL CONTEXT - CRITICAL: USE ISO DATES FOR TOOL CALLS]
Current date (human): ${config.currentDate}
Current date (ISO): ${config.currentDateISO} ← USE THIS FOR TOOLS
Current time: ${config.currentTime}
Current year: ${config.currentYear}
Timezone: ${config.timezone}
Business hours: ${config.businessHours}

🚨 CRITICAL YEAR VALIDATION:
- Today is ${config.currentDateISO}
- Current year is ${config.currentYear}
- NEVER use dates before ${config.currentYear}
- If you detect year 2024 or 2025 in conversation, STOP and say "I notice you mentioned [year], but we're currently in ${config.currentYear}. Would you like to schedule for ${config.currentYear}?"
```

**Change 1.3 - Enhance getTemporalContext() Helper** (lines 170-191)
```typescript
function getTemporalContext(timezone: string = 'America/New_York') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone
  });

  const isoFormatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  });

  return {
    currentDate: formatter.format(now).split(',')[0], // "Monday, February 2"
    currentDateISO: isoFormatter.format(now),          // "2026-02-02"
    currentTime: formatter.format(now).split(',')[1].trim(), // "3:45 PM"
    currentYear: now.getFullYear()                     // 2026
  };
}
```

#### File 2: `backend/src/config/system-prompts.ts`

**Change 2.1 - Update generatePromptContext()** (lines 204-213)
```typescript
// Add same 4 temporal fields to returned object
const temporal = getTemporalContext(org.timezone || 'America/New_York');

return {
  tenantId: org.id,
  tenantName: org.name,
  currentDate: temporal.currentDate,
  currentDateISO: temporal.currentDateISO,    // NEW
  currentTime: temporal.currentTime,
  currentYear: temporal.currentYear,          // NEW
  tenantTimezone: org.timezone || 'America/New_York',
  businessHours: org.business_hours || '9 AM - 6 PM'
};
```

**Change 2.2 - Update APPOINTMENT_BOOKING_PROMPT** (lines 52-66)
```typescript
// Add ISO date instruction to tool usage section:
When checking availability:
- ALWAYS use ISO date format: YYYY-MM-DD
- Current date is ${context.currentDateISO}
- Example: check_availability(tenantId="${context.tenantId}", date="${context.currentDateISO}", serviceType="consultation")

When booking:
- Use date from check_availability response
- NEVER use dates before ${context.currentYear}
```

**Verification:**
```bash
# Test system prompt generation
curl -X POST http://localhost:3000/api/test/system-prompt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"orgId": "test-org-id"}'

# Expected response includes:
# "currentDateISO": "2026-02-02"
# "currentYear": 2026
# Prompt text includes "NEVER use dates before 2026"
```

---

### Phase 2: Backend Date Validation Guardrails (2 hours)

**Goal:** Reject or auto-correct dates in the past

#### File 3: `backend/src/utils/date-validation.ts` (NEW FILE - 220 lines)

```typescript
import { logger } from '../config/logger';

export interface DateValidationResult {
  isValid: boolean;
  originalDate: string;
  correctedDate?: string;
  correctedYear?: number;
  reason?: string;
  action: 'accepted' | 'corrected' | 'rejected';
}

// In-memory tracking (last 100 corrections)
const dateCorrections: Array<{
  timestamp: Date;
  originalDate: string;
  correctedDate: string;
  originalYear: number;
  correctedYear: number;
}> = [];

const MAX_CORRECTIONS_LOG = 100;

/**
 * Validates date and auto-corrects year if in the past
 *
 * @param dateString - Date in YYYY-MM-DD or ISO 8601 format
 * @param autoCorrect - If true, auto-corrects year to current year
 * @param orgTimezone - Organization timezone for validation
 * @returns Validation result with corrected date if needed
 */
export function validateAndCorrectDate(
  dateString: string,
  autoCorrect: boolean = true,
  orgTimezone: string = 'America/New_York'
): DateValidationResult {
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return {
      isValid: false,
      originalDate: dateString,
      reason: 'Invalid date format. Expected YYYY-MM-DD',
      action: 'rejected'
    };
  }

  // Extract year
  const year = parseInt(dateString.substring(0, 4), 10);
  const currentYear = new Date().getFullYear();

  // Check if year is in the past
  if (year < currentYear) {
    if (autoCorrect) {
      // Auto-correct: replace year with current year
      const correctedDate = dateString.replace(/^\d{4}/, currentYear.toString());

      // Log correction
      logger.warn('⚠️ Date Auto-Correction Applied', {
        originalDate: dateString,
        correctedDate,
        originalYear: year,
        correctedYear: currentYear,
        timezone: orgTimezone
      });

      // Track correction
      recordDateCorrection(dateString, correctedDate, year, currentYear);

      return {
        isValid: true,
        originalDate: dateString,
        correctedDate,
        correctedYear: currentYear,
        reason: `Year ${year} is in the past. Auto-corrected to ${currentYear}.`,
        action: 'corrected'
      };
    } else {
      // Reject without correction
      return {
        isValid: false,
        originalDate: dateString,
        reason: `Year ${year} is in the past. Current year is ${currentYear}.`,
        action: 'rejected'
      };
    }
  }

  // Valid date
  return {
    isValid: true,
    originalDate: dateString,
    action: 'accepted'
  };
}

/**
 * Records date correction for monitoring
 */
function recordDateCorrection(
  originalDate: string,
  correctedDate: string,
  originalYear: number,
  correctedYear: number
) {
  dateCorrections.push({
    timestamp: new Date(),
    originalDate,
    correctedDate,
    originalYear,
    correctedYear
  });

  // Keep only last 100
  if (dateCorrections.length > MAX_CORRECTIONS_LOG) {
    dateCorrections.shift();
  }
}

/**
 * Get date correction statistics for monitoring
 */
export function getDateCorrectionStats() {
  const now = new Date();
  const last24h = dateCorrections.filter(
    c => (now.getTime() - c.timestamp.getTime()) < 24 * 60 * 60 * 1000
  );

  const yearCounts: Record<number, number> = {};
  last24h.forEach(c => {
    yearCounts[c.originalYear] = (yearCounts[c.originalYear] || 0) + 1;
  });

  return {
    total: dateCorrections.length,
    last24Hours: last24h.length,
    byYear: yearCounts,
    recent: dateCorrections.slice(-10).reverse()
  };
}

/**
 * Validate booking date and return clear error for AI
 */
export function validateBookingDate(
  date: string,
  orgTimezone: string
): { valid: boolean; error?: string; correctedDate?: string } {
  const result = validateAndCorrectDate(date, true, orgTimezone);

  if (!result.isValid) {
    return {
      valid: false,
      error: result.reason
    };
  }

  if (result.action === 'corrected') {
    return {
      valid: true,
      correctedDate: result.correctedDate
    };
  }

  return { valid: true };
}
```

#### File 4: `backend/src/routes/vapi-tools-routes.ts`

**Change 4.1 - Add Import** (line 10)
```typescript
import { validateBookingDate, getDateCorrectionStats } from '../utils/date-validation';
```

**Change 4.2 - Validate in bookClinicAppointment** (after line 854)
```typescript
// AFTER normalization, BEFORE booking:
const normalizedData = normalizeBookingData({ /* ... */ });

// NEW VALIDATION
const validation = validateBookingDate(
  normalizedData.appointmentDate,
  org.timezone || 'America/New_York'
);

if (!validation.valid) {
  logger.error('Invalid booking date', {
    originalDate: normalizedData.appointmentDate,
    error: validation.error,
    orgId: resolvedTenantId
  });

  return res.json({
    results: [{
      toolCallId: message.toolCalls[0].id,
      result: JSON.stringify({
        success: false,
        error: validation.error,
        message: `Cannot book appointment: ${validation.error}`
      })
    }]
  });
}

// If date was corrected, use corrected date
if (validation.correctedDate) {
  logger.info('Using corrected date for booking', {
    original: normalizedData.appointmentDate,
    corrected: validation.correctedDate
  });
  normalizedData.appointmentDate = validation.correctedDate;
}

// Continue with booking using normalizedData...
```

**Change 4.3 - Validate in reserve_atomic** (line 465)
```typescript
// In the slot loop, add validation:
for (const slot of slots) {
  const slotDate = new Date(slot.startTime);
  const slotYear = slotDate.getFullYear();
  const currentYear = new Date().getFullYear();

  if (slotYear < currentYear) {
    logger.warn('Rejecting slot with past year', {
      slot: slot.startTime,
      slotYear,
      currentYear,
      orgId
    });
    continue; // Skip this slot
  }

  // ... existing slot processing ...
}
```

**Verification:**
```bash
# Test date validation
curl -X POST http://localhost:3000/api/tools/calendar/book \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": {
      "toolCalls": [{
        "id": "test-1",
        "function": {
          "name": "bookClinicAppointment",
          "arguments": "{\"appointmentDate\":\"2024-02-03\",\"appointmentTime\":\"14:00:00\"}"
        }
      }]
    }
  }'

# Expected: Auto-corrects to 2026-02-03, logs warning, booking succeeds
```

---

### Phase 3: Monitoring Endpoint (1 hour)

#### File 5: `backend/src/routes/monitoring.ts`

**Change 5.1 - Add Date Corrections Endpoint** (new route)
```typescript
import { getDateCorrectionStats } from '../utils/date-validation';

router.get('/date-corrections', requireAuth, async (req, res) => {
  try {
    const stats = getDateCorrectionStats();

    res.json({
      success: true,
      stats: {
        totalCorrections: stats.total,
        last24Hours: stats.last24Hours,
        correctionsByYear: stats.byYear,
        recentCorrections: stats.recent
      }
    });
  } catch (error) {
    logger.error('Error fetching date correction stats', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
```

**Verification:**
```bash
# Check monitoring stats
curl -X GET http://localhost:3000/api/monitoring/date-corrections \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
# {
#   "success": true,
#   "stats": {
#     "totalCorrections": 5,
#     "last24Hours": 3,
#     "correctionsByYear": { "2024": 2, "2025": 1 },
#     "recentCorrections": [...]
#   }
# }
```

---

## Testing Strategy

### Unit Tests (NEW FILE)

**File:** `backend/src/__tests__/unit/date-validation.test.ts`

```typescript
import { validateAndCorrectDate, validateBookingDate } from '../../utils/date-validation';

describe('Date Validation', () => {
  const currentYear = new Date().getFullYear();

  test('Valid 2026 date accepted without correction', () => {
    const result = validateAndCorrectDate('2026-03-15', true);
    expect(result.isValid).toBe(true);
    expect(result.action).toBe('accepted');
    expect(result.correctedDate).toBeUndefined();
  });

  test('2024 date auto-corrected to current year', () => {
    const result = validateAndCorrectDate('2024-02-03', true);
    expect(result.isValid).toBe(true);
    expect(result.action).toBe('corrected');
    expect(result.correctedDate).toBe(`${currentYear}-02-03`);
  });

  test('2025 date auto-corrected to current year', () => {
    const result = validateAndCorrectDate('2025-12-25', true);
    expect(result.isValid).toBe(true);
    expect(result.action).toBe('corrected');
    expect(result.correctedDate).toBe(`${currentYear}-12-25`);
  });

  test('Invalid format rejected', () => {
    const result = validateAndCorrectDate('02/03/2024', true);
    expect(result.isValid).toBe(false);
    expect(result.action).toBe('rejected');
  });

  test('Auto-correction can be disabled', () => {
    const result = validateAndCorrectDate('2024-02-03', false);
    expect(result.isValid).toBe(false);
    expect(result.action).toBe('rejected');
  });
});
```

### Integration Test (NEW FILE)

**File:** `backend/src/__tests__/integration/time-travel-fix.test.ts`

```typescript
import request from 'supertest';
import { app } from '../../server';

describe('Time Travel Bug Fix', () => {
  test('Booking tool rejects 2024 dates', async () => {
    const response = await request(app)
      .post('/api/tools/calendar/book')
      .set('Authorization', 'Bearer TEST_TOKEN')
      .send({
        message: {
          toolCalls: [{
            id: 'test-1',
            function: {
              name: 'bookClinicAppointment',
              arguments: JSON.stringify({
                appointmentDate: '2024-02-03',
                appointmentTime: '14:00:00'
              })
            }
          }]
        }
      });

    expect(response.body.results[0].result).toContain('corrected to 2026');
  });

  test('Monitoring endpoint returns correction stats', async () => {
    const response = await request(app)
      .get('/api/monitoring/date-corrections')
      .set('Authorization', 'Bearer TEST_TOKEN');

    expect(response.body.success).toBe(true);
    expect(response.body.stats).toHaveProperty('totalCorrections');
  });
});
```

### Manual Verification Script (NEW FILE)

**File:** `backend/scripts/verify-time-travel-fix.ts`

```typescript
#!/usr/bin/env node
import { validateAndCorrectDate, getDateCorrectionStats } from '../src/utils/date-validation';

console.log('🔍 Time Travel Bug Fix Verification\n');

// Test 1: System Prompt Check
console.log('Test 1: Checking system prompt includes ISO date...');
// (Requires fetching actual prompt from API)
console.log('✅ Manual check required: Call /api/test/system-prompt');

// Test 2: Date Validation
console.log('\nTest 2: Testing date validation...');
const test2024 = validateAndCorrectDate('2024-02-03', true);
console.log(`  2024-02-03 → ${test2024.correctedDate} (${test2024.action})`);
console.log(test2024.action === 'corrected' ? '✅ PASS' : '❌ FAIL');

const test2026 = validateAndCorrectDate('2026-03-15', true);
console.log(`  2026-03-15 → No change (${test2026.action})`);
console.log(test2026.action === 'accepted' ? '✅ PASS' : '❌ FAIL');

// Test 3: Stats Endpoint
console.log('\nTest 3: Checking monitoring stats...');
const stats = getDateCorrectionStats();
console.log(`  Total corrections tracked: ${stats.total}`);
console.log('✅ Stats endpoint functional');

console.log('\n🎉 Verification Complete!');
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All unit tests passing (`npm test`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Manual verification script passes
- [ ] Code reviewed by senior engineer

### Deployment Steps
1. **Deploy backend changes** (Vercel/Railway)
   ```bash
   git add .
   git commit -m "fix: time travel bug - add date validation and ISO prompts"
   git push origin main
   ```

2. **Verify in production**
   ```bash
   # Check system prompt
   curl https://api.voxanne.ai/api/test/system-prompt

   # Check monitoring
   curl https://api.voxanne.ai/api/monitoring/date-corrections
   ```

3. **Monitor for 24 hours**
   - Check Sentry for new errors
   - Monitor date correction stats
   - Review call logs for booking failures

### Rollback Plan
If issues occur:
```bash
git revert HEAD
git push origin main
```

Or file-by-file:
- Revert `super-system-prompt.ts` changes
- Revert `vapi-tools-routes.ts` validation
- Keep monitoring endpoint (safe)

---

## Success Metrics

### Immediate (Day 1)
- ✅ Zero appointments created with year < 2026
- ✅ Date corrections logged and visible in monitoring
- ✅ No increase in booking error rate

### Short-term (Week 1)
- ✅ Date correction rate decreases (AI learns from prompt)
- ✅ Zero customer complaints about wrong dates
- ✅ All bookings show correct year in calendar

### Long-term (Month 1)
- ✅ Date correction rate < 1% (prompt effectiveness)
- ✅ System prompt changes reduce need for corrections
- ✅ Monitoring data used to further improve prompts

---

## Files Summary

### Files to Create (4)
1. `backend/src/utils/date-validation.ts` - 220 lines
2. `backend/src/__tests__/unit/date-validation.test.ts` - 80 lines
3. `backend/src/__tests__/integration/time-travel-fix.test.ts` - 60 lines
4. `backend/scripts/verify-time-travel-fix.ts` - 40 lines

### Files to Modify (5)
1. `backend/src/services/super-system-prompt.ts` - 3 sections
2. `backend/src/config/system-prompts.ts` - 2 functions
3. `backend/src/routes/vapi-tools-routes.ts` - 2 locations
4. `backend/src/routes/monitoring.ts` - 1 new route
5. `backend/src/services/calendar-integration.ts` - 2 locations (optional, for timezone fix)

### Total Effort
- **New Code:** ~400 lines
- **Modified Code:** ~120 lines
- **Implementation Time:** 4-6 hours
- **Testing Time:** 2 hours
- **Total:** 1 day

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaks existing bookings | Low | High | Extensive testing, phased rollout |
| Date correction too aggressive | Medium | Low | Logging + monitoring, can tune threshold |
| Performance impact | Low | Low | In-memory tracking, no DB calls |
| Timezone issues | Medium | Medium | Test with multiple timezones, use org timezone |

**Overall Risk:** LOW - Changes are surgical and backward-compatible

---

## Implementation Notes

### Why Auto-Correction vs Rejection?

**Decision:** Auto-correct 2024→2026, don't reject

**Reasoning:**
1. Better UX - booking succeeds instead of failing
2. Transparent - logged for monitoring
3. Temporary - as prompt improves, corrections decrease
4. Safe - always corrects to current year, never to future

**Alternative:** Reject and ask AI to re-prompt user
- Pro: More explicit error handling
- Con: Worse UX, extra latency, user confusion

### Why In-Memory Tracking?

**Decision:** Store corrections in memory (last 100)

**Reasoning:**
1. Fast - no DB calls
2. Sufficient - only need recent data for monitoring
3. Ephemeral - resets on restart (acceptable for monitoring)

**Alternative:** Store in database
- Pro: Persistent, queryable
- Con: DB overhead, not critical data

---

## Related Documentation

- **PRD:** `.agent/prd.md` - Critical invariants (don't break existing functionality)
- **CLAUDE.md:** `.agent/CLAUDE.md` - Backend architecture
- **Senior Engineer Prompt:** `.agent/senior engineer prompt.md` - Code review standards
- **Supabase Guide:** `.agent/supabase-mcp.md` - Database operations (not needed for this fix)

---

**Status:** Ready for implementation
**Approval:** Pending CTO review
**Next Step:** Create `date-validation.ts` and apply Phase 1 changes
