# Planning: Clean Vapi Sync Implementation

## Problem Statement

The current Vapi agent synchronization logic is fragile, leading to "Voice Mismatch" errors (Status 400) because legacy voices are no longer supported. Additionally, the `IntegrationDecryptor` fails to find credentials for some organizations, lacking a fallback. The system also lacks robust idempotency. The Vapi API circuit breaker is currently open due to repeated failures.

## Goals

1. **Robust Voice Normalization:** Automatically map legacy voices to a supported default (Azure/Jenny) to prevent 400 errors.
2. **Reliable Credential Retrieval:** Use `IntegrationSettingsService` which supports fallback to platform-level keys.
3. **Idempotent Synchronization:** Ensure agents are created only once and updated via PATCH thereafter.
4. **Circuit Breaker Management:** Ensure the circuit breaker is reset.
5. **Clean Code:** Follow "Senior Engineer" standards.

## Technical Requirements

### 1. `VapiAssistantManager` Refactor

- **Location:** `backend/src/services/vapi-assistant-manager.ts`
- **Dependencies:** `VapiClient`, `IntegrationSettingsService`, `supabase-client`.
- **Logic:**
  - Use `IntegrationSettingsService.getVapiCredentials(orgId)` for keys.
  - Implement `normalizeVoiceConfig(config)` to handle legacy voices.
  - Implement `ensureAssistant` with check-then-upsert logic.
  - Handle 404s from Vapi by recreating the assistant.

### 2. `IntegrationSettingsService` Verification

- **Location:** `backend/src/services/integration-settings.ts`
- **Logic:** Ensure `getVapiCredentials` correctly falls back to `process.env.VAPI_PRIVATE_KEY` if DB lookup fails.

### 3. Verification Script

- **Location:** `backend/src/scripts/verify-vapi-sync.ts` (New, Clean)
- **Logic:**
  - Simulate an inbound agent save.
  - Verify voice normalization.
  - Verify idempotency.
  - Verify credential fallback.

## Implementation Phases

### Phase 1: Core Service Refactor

- Refactor `VapiAssistantManager` to be cleaner and more robust.
- Ensure `IntegrationSettingsService` is used.
- Add comprehensive logging.

### Phase 2: Verification

- Create `verify-vapi-sync.ts`.
- Restart backend to reset circuit breaker.
- Run verification script.

### Phase 3: Cleanup

- Remove any temporary files.
- Update documentation.
