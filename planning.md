# Planning - API Key Cleanup and Server Startup

## Implementation Phases

### Phase 1: Scan and Cleanup

1. **Search**: Scan the codebase for `VAPI_PRIVATE_KEY`, `VAPI_PUBLIC_KEY`, and any potential hardcoded UUIDs that look like Vapi keys.
2. **Validate**: Compare found keys with the provided correct keys.
3. **Remediate**: Update `backend/.env` (if needed) and any other config files. Remove hardcoded keys from source code.

### Phase 2: Server Startup

1. **Backend**: Start the backend server (`npm run dev` in `backend/`).
2. **Frontend**: Start the frontend server (`npm run dev` in root or `frontend/`).
3. **Tunnel**: Start ngrok to expose the backend.

## Technical Requirements

- **Keys**:
  - Private: `fc4cee8a-a616-4955-8a76-78fb5c6393bb`
  - Public: `625488bf-113f-442d-a74c-95861a794250`
- **Environment**: Node.js, Ngrok.

## Testing Criteria

- **Clean Scan**: No occurrences of old keys in the codebase.
- **Server Status**: Backend and Frontend accessible via localhost.
- **Tunnel Status**: Ngrok URL pointing to backend.
