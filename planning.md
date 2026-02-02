# Final Hardening Sprint — Mariah Protocol Gaps (Planning)

## Problem Statement
We need to close 3 demo-critical gaps identified in the Mariah Protocol gap analysis, without regressing existing certified flows:

1. **Latency masking (filler phrase)**: prevent dead air during 1.5–3s calendar operations.
2. **Phantom booking rollback**: if Google Calendar write succeeds but the booking transaction fails afterward, automatically delete the created Google event.
3. **Alternative slots verification**: ensure that when a requested slot is busy, the system reliably returns **3 alternative times**, with an automated test to prevent regression.

## Scope / Non-Goals
- In scope: prompt text updates + server-side booking rollback logic + integration test coverage.
- Out of scope (explicitly deferred): hybrid telephony deployment, AMD, KB confidence thresholds, caller personalization logic changes.

## Inputs / Outputs / Constraints
### Inputs
- Existing prompts:
  - `backend/src/config/system-prompts.ts`
  - `backend/src/services/super-system-prompt.ts`
- Booking handler:
  - `backend/src/routes/vapi-tools-routes.ts` (`/tools/bookClinicAppointment`)
- Calendar integration:
  - `backend/src/services/calendar-integration.ts`
- Integration test suite:
  - `backend/src/__tests__/integration/mariah-protocol.test.ts`

### Outputs
- **Prompt behavior**: allow exactly one short filler phrase before calling availability tool, while still enforcing tool usage and zero-hallucination.
- **Booking behavior**: calendar event is deleted if created and a subsequent critical step fails.
- **Test**: automated test that asserts 3 alternative slots are produced for a busy requested slot.

### Constraints / Invariants
- Do not weaken existing guardrails:
  - must not hallucinate times
  - must call tools in correct order
  - must not introduce new long pauses/timeouts
- Keep changes localized and low-risk.
- Do not add/remove comments unless necessary (prefer minimal edits).

## Implementation Phases

### Phase 1 — Latency Masking (Prompt)
**Goal**: remove the explicit prohibition of a filler phrase and replace with a controlled, single filler phrase that does not delay tool calling.

- Update `backend/src/config/system-prompts.ts`
  - Replace the “DO NOT say \"Let me check\"” instruction with:
    - allow one short phrase (e.g., “Let me check the schedule for you…”) and then immediately call `check_availability`.
- Update `backend/src/services/super-system-prompt.ts`
  - Clarify that the filler phrase is permitted but must be followed immediately by the tool call.

**Acceptance Criteria**:
- Prompt text no longer forbids filler phrases.
- Prompt explicitly instructs “say X, then immediately call tool”.

### Phase 2 — Phantom Booking Rollback (Calendar Compensating Action)
**Goal**: implement compensating delete for a calendar event created during booking if a subsequent critical failure occurs.

Current reality in code:
- `/tools/bookClinicAppointment` creates the DB booking via `book_appointment_atomic` **first**, then creates a calendar event in a best-effort block.

Plan:
- Refactor booking handler to capture calendar event id if created.
- Persist the calendar event id onto the appointment record (if schema supports it) OR at minimum include it in logs.
- Add `deleteCalendarEvent(orgId, eventId)` to `calendar-integration.ts` if missing.
- Add rollback flow:
  - if calendar event created AND a later step throws (e.g., appointment update/persist fails), attempt delete.

**Acceptance Criteria**:
- If the post-booking calendar persist step fails, we attempt rollback deletion.
- Rollback failure is logged but does not crash the server.

### Phase 3 — Alternative Slots Integration Test
**Goal**: add a deterministic test ensuring 3 alternatives are produced when the requested slot is busy.

Plan:
- Extend `backend/src/__tests__/integration/mariah-protocol.test.ts`:
  - Pre-book a specific time slot in `appointments` for the test org.
  - Exercise the availability path and assert:
    - requested slot is unavailable
    - 3 alternatives are returned (format validated)

**Acceptance Criteria**:
- Test fails if alternatives are not length 3.
- Test cleans up its inserted records.

### Phase 4 — Regression Verification
**Goal**: ensure no regressions.

Verification steps (commands to run locally):
- `npm run test:unit`
- `npm run test:integration -- mariah-protocol`
- `npx tsc --noEmit`

**Acceptance Criteria**:
- All tests pass.
- No new TypeScript errors introduced by these changes.

## Open Questions (Must Resolve Before Phase 2/3)
1. In `/tools/bookClinicAppointment`, do we currently store any calendar event id on the appointment row? (Initial grep suggests **no**.)
2. What is the canonical “alternatives” shape we want from the busy-slot scenario? (Current `/tools/calendar/check` returns `alternatives` as alternative days, not “3 times”.)
3. Which path is actually used in production when a slot is busy: availability tool or booking RPC conflict response?

Once we confirm (1)-(3), we can implement Phase 2 and Phase 3 safely.
