# Planning: VAPI Multi-Tenancy Fix & Agent Saving

## Goal Description

Resolve the "Error saving: Error: Vapi API key not configured" error preventing the user from saving Agent configuration. The error originates from the Backend API (`/api/founder-console/agent/behavior`), indicating that the VAPI API Key is missing from the Organization's configuration (DB `integrations` table). This violates the "Platform-Provided" VAPI architecture.

## Technical Requirements

- **Database**: `integrations` table (provider='vapi') must contain a valid `vapi_api_key`.
- **Backend**: `founder-console` routes must correctly fetch this key.
- **Key Source**: Use the validated VAPI Key: ...[REDACTED]... (from `.env`).

## Implementation Phases

### Phase 1: Diagnosis

- [ ] **Code Analysis**: Inspect `backend/src/routes/founder-console*` (likely `agent-config.ts` or `founder-console-v2.ts`) to locate the error message "Vapi API key not configured".
- [ ] **Data Analysis**: Check `integrations` table (provider='vapi') for presence of `vapi_api_key` in `config`.

### Phase 2: Data Repair

- [ ] **Update DB**: If the key is missing from DB but required by code, execute SQL to inject `vapi_api_key` into the `integrations` config for `provider='vapi'`.

### Phase 3: Verification

- [ ] **Frontend Retry**: User (or simulation) retries saving the Agent.
- [ ] **Success Criteria**: 200 OK from API and success message in UI.

## Testing Criteria

- **Backend Check**: API should not return 400 for missing key.
- **Frontend Check**: Save button should show "Saved!".
