# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** voxanne-backend
- **Date:** 2025-12-18
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** post api webhooks vapi webhook processing
- **Status:** ❌ Failed
- **Error:** 400 Bad Request
- **Analysis / Findings:**
  - The endpoint `/api/webhooks/vapi` rejected the request with "Invalid event structure".
  - **Root Cause:** The test payload was missing required fields enforced by the Zod schema in `webhooks.ts`. Specifically, `call.id` is required but likely missing or the structure `message.call` vs `call` was incorrect.
  - **Correction:** Update test payload to match `VapiEventValidationSchema`.

#### Test TC002
- **Test Name:** post api calls start outbound call initiation
- **Status:** ❌ Failed
- **Error:** 400 Bad Request
- **Analysis / Findings:**
  - The endpoint `/api/calls/start` rejected the request.
  - **Root Cause:** The payload validation requires `leads` (or `leadIds`), `vapiAgentId`, and `selectedVoice`. The test generated payload likely missed one or more of these required fields.
  - **Correction:** Ensure test payload includes all required fields.

#### Test TC003
- **Test Name:** get api calls dashboard retrieve call logs
- **Status:** ❌ Failed
- **Error:** Assertion Error: Response JSON should be a list
- **Analysis / Findings:**
  - The endpoint `/api/calls-dashboard` (or `/api/calls/logs`) returned an object (likely an error) instead of a list.
  - **Root Cause:** Likely returned 401 Unauthorized or 500 Error due to missing Supabase/DB credentials or context in the test environment.
  - **Correction:** Ensure authentication headers (if required) and DB connection are valid.

#### Test TC004
- **Test Name:** get post api assistants manage ai assistants
- **Status:** ❌ Failed
- **Error:** 404 Not Found
- **Analysis / Findings:**
  - Failed on `POST /api/assistants`.
  - **Root Cause:** The route `POST /api/assistants` does not exist. The actual route for creating/syncing assistants is `POST /api/assistants/:agentId/sync`.
  - **Correction:** Update test to use the correct endpoint.

#### Test TC005
- **Test Name:** post api knowledge base upload document
- **Status:** ❌ Failed
- **Error:** 404 Not Found
- **Analysis / Findings:**
  - Failed on `POST /api/knowledge-base/upload`.
  - **Root Cause:** The route likely differs. `knowledge-base.ts` might use `/upload` but `knowledge-base-rag.ts` uses `/chunk`. Need to verify `src/routes/knowledge-base.ts`.
  - **Correction:** Verify exact route path.

#### Test TC006
- **Test Name:** post api knowledge base query knowledge base
- **Status:** ❌ Failed
- **Error:** 404 Not Found
- **Analysis / Findings:**
  - Failed on `POST /api/knowledge-base/query`.
  - **Root Cause:** The actual route is `/api/knowledge-base/search` (as seen in `knowledge-base-rag.ts`).
  - **Correction:** Update test to use `/api/knowledge-base/search`.

#### Test TC007
- **Test Name:** post api vapi setup integration setup
- **Status:** ❌ Failed
- **Error:** 404 Not Found
- **Analysis / Findings:**
  - Failed on `POST /api/vapi/setup`.
  - **Root Cause:** The actual route is `/api/vapi/setup/configure-webhook` (as seen in `vapi-setup.ts`).
  - **Correction:** Update test to use correct path.

#### Test TC008
- **Test Name:** post api inbound config update inbound call handling
- **Status:** ❌ Failed
- **Error:** 404 Not Found
- **Analysis / Findings:**
  - Failed on `POST /api/inbound/config`.
  - **Root Cause:** The actual route is `/api/inbound/setup` (as seen in `inbound-setup.ts`).
  - **Correction:** Update test to use correct path.

#### Test TC009
- **Test Name:** get api founder console settings retrieve settings
- **Status:** ✅ Passed
- **Analysis / Findings:**
  - The endpoint `/api/founder-console/settings` is correctly implemented and reachable.

---

## 3️⃣ Coverage & Matching Metrics

- **11.11%** of tests passed (1/9)

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|-------------|-------------|-----------|-----------|
| Webhooks | 1 | 0 | 1 |
| Calls | 2 | 0 | 2 |
| Assistants | 1 | 0 | 1 |
| Knowledge Base | 2 | 0 | 2 |
| Vapi Setup | 1 | 0 | 1 |
| Inbound Config | 1 | 0 | 1 |
| Founder Console | 1 | 1 | 0 |

---

## 4️⃣ Key Gaps / Risks

1.  **Route Mismatches**: High number of 404s indicates the API documentation/summary used to generate tests does not match the actual code routes.
2.  **Environment Configuration**: 500 errors suggest the test environment lacks necessary secrets (Supabase keys, Vapi keys).
3.  **Payload Validation**: Strict validation on webhooks and calls endpoints requires precise test data generation matching the schemas.
