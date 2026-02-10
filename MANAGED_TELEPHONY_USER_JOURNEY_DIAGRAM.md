# Managed Telephony - Visual User Journey Diagrams

**Date:** February 9, 2026
**Purpose:** Visual representation of user flows for UX analysis

---

## Diagram 1: Current User Journey (With Bug)

```
                          START
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 📱 User navigates to /dashboard/telephony                    │
│                                                               │
│ State: Logged in, org_id: 46cf...                           │
│ View: Main telephony page with "Buy Number" section         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🔍 Pre-Flight API Call (Background)                          │
│                                                               │
│ GET /api/managed-telephony/phone-status                      │
│ Response: 403 Forbidden                                      │
│ Error: "Feature not enabled for your organization"           │
│                                                               │
│ ⚠️  Frontend: Error caught but NOT displayed to user         │
│    console.error() only - User sees nothing                  │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🖱️  User clicks "Buy Number" button                          │
│                                                               │
│ Action: BuyNumberModal opens                                 │
│ State: Country='US', NumberType='local', AreaCode=''        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🌍 User selects country: United Kingdom                      │
│                                                               │
│ View: Dropdown shows "🇬🇧 United Kingdom"                    │
│ State: Country='GB', AreaCode hint updates                   │
│ Hint: "3-5 digits (e.g., 020, 0161)"                        │
│                                                               │
│ ✅ Works correctly (frontend-only logic)                     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ ✏️  User enters area code: 020                               │
│                                                               │
│ Validation: Strips non-numeric, limits to 5 chars           │
│ State: areaCode='020'                                        │
│                                                               │
│ ✅ Works correctly                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🔎 User clicks "Search Available Numbers"                    │
│                                                               │
│ Frontend: setLoading(true), shows "Searching..."            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🌐 API Call: Search Numbers                                  │
│                                                               │
│ GET /api/managed-telephony/available-numbers                 │
│     ?country=GB&numberType=local&areaCode=020                │
│                                                               │
│ Middleware Chain:                                            │
│ 1. requireAuthOrDev → ✅ Pass (JWT valid)                   │
│ 2. requireFeature('managed_telephony')                       │
│    → ❌ FAIL (Flag not in database)                          │
│                                                               │
│ Response: 403 Forbidden                                      │
│ Body: { error: "Feature not enabled for your organization" } │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🔴 Frontend: Error State                                     │
│                                                               │
│ setLoading(false)                                            │
│ setError("Feature not enabled for your organization")       │
│                                                               │
│ View: Red error banner with AlertCircle icon                │
│ Text: "Feature not enabled for your organization"           │
│                                                               │
│ ❌ No retry button                                            │
│ ❌ No support link                                            │
│ ❌ No explanation of why or how to fix                        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ⛔ DEAD END ⛔
            User cannot proceed further


SUMMARY OF FAILURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Pre-flight check: Silent failure (403 not shown to user)
❌ Number search: 403 Forbidden (feature flag missing)
❌ No actionable error messaging
❌ No support escalation path
❌ User stuck in dead-end state
```

---

## Diagram 2: Expected User Journey (After Migration)

```
                          START
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 📱 User navigates to /dashboard/telephony                    │
│                                                               │
│ State: Logged in, org_id: 46cf...                           │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🔍 Pre-Flight API Call (Background)                          │
│                                                               │
│ GET /api/managed-telephony/phone-status                      │
│                                                               │
│ Middleware Chain:                                            │
│ 1. requireAuthOrDev → ✅ Pass                                │
│ 2. requireFeature('managed_telephony')                       │
│    → ✅ Pass (Flag exists, enabled=true, rollout=100%)      │
│                                                               │
│ Response: 200 OK                                             │
│ Body: { hasPhoneNumber: false, phoneNumberType: 'none' }    │
│                                                               │
│ ✅ Frontend: No existing number detected                     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🖱️  User clicks "Buy Number" button                          │
│                                                               │
│ Action: BuyNumberModal opens                                 │
│ State: Clean modal, no warnings                              │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🌍 User selects country: United Kingdom                      │
│ ✏️  User enters area code: 020                               │
│ 🔎 User clicks "Search Available Numbers"                    │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🌐 API Call: Search Numbers                                  │
│                                                               │
│ GET /api/managed-telephony/available-numbers                 │
│     ?country=GB&numberType=local&areaCode=020                │
│                                                               │
│ Middleware Chain:                                            │
│ 1. requireAuthOrDev → ✅ Pass                                │
│ 2. requireFeature('managed_telephony') → ✅ Pass             │
│                                                               │
│ Service Layer:                                               │
│ 1. Get/create Twilio subaccount for org                     │
│ 2. Create scoped Twilio client                               │
│ 3. Call Twilio API:                                          │
│    client.availablePhoneNumbers('GB').local.list({           │
│      areaCode: '020',                                        │
│      voiceEnabled: true,                                     │
│      limit: 5                                                │
│    })                                                        │
│                                                               │
│ Response: 200 OK                                             │
│ Body: {                                                      │
│   numbers: [                                                 │
│     {                                                        │
│       phoneNumber: "+442012345678",                          │
│       locality: "London",                                    │
│       region: "England"                                      │
│     },                                                       │
│     // ... 4 more numbers                                   │
│   ]                                                          │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ ✅ Frontend: Display Results                                 │
│                                                               │
│ View: List of 5 available UK numbers                        │
│ Each item shows:                                             │
│   - Phone number (formatted)                                 │
│   - Location: "London, England"                              │
│   - Clickable card to select                                 │
│                                                               │
│ State: availableNumbers = [...]                             │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🖱️  User clicks on number: +442012345678                     │
│                                                               │
│ Action: Modal transitions to confirmation step              │
│ View:                                                        │
│   - "You are about to purchase:"                            │
│   - Large display: +442012345678                             │
│   - Pricing: "$1.50/month + usage"                          │
│   - [Back] [Confirm Purchase] buttons                       │
│                                                               │
│ State: step='confirm', selectedNumber='+442012345678'       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🖱️  User clicks "Confirm Purchase"                           │
│                                                               │
│ Frontend: setProvisioning(true), shows "Provisioning..."    │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🌐 API Call: Provision Number                                │
│                                                               │
│ POST /api/managed-telephony/provision                        │
│ Body: {                                                      │
│   country: "GB",                                             │
│   numberType: "local",                                       │
│   areaCode: "020"                                            │
│ }                                                            │
│                                                               │
│ Middleware: ✅ Auth + Feature Flag pass                      │
│                                                               │
│ Service Layer (Multi-step process):                         │
│ 1. Get organization name from database                      │
│ 2. Get/create Twilio subaccount                              │
│ 3. Create scoped Twilio client                               │
│ 4. Search available numbers (same as search endpoint)       │
│ 5. Purchase first available number:                         │
│    subClient.incomingPhoneNumbers.create({                   │
│      phoneNumber: selectedNumber                             │
│    })                                                        │
│ 6. Import number to Vapi:                                    │
│    vapiClient.importTwilioNumber({                           │
│      twilioPhoneNumber: purchasedNumber.phoneNumber,         │
│      twilioAccountSid: MASTER_SID,                           │
│      twilioAuthToken: MASTER_TOKEN                           │
│    })                                                        │
│ 7. Save to database:                                         │
│    - managed_phone_numbers table                             │
│    - Update agents.vapi_phone_number_id for outbound agent  │
│ 8. Save via IntegrationDecryptor (single-slot gate)         │
│                                                               │
│ Response: 201 Created                                        │
│ Body: {                                                      │
│   success: true,                                             │
│   phoneNumber: "+442012345678",                              │
│   vapiPhoneId: "uuid-abc-123",                               │
│   subaccountSid: "AC123..."                                  │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ ✅ Frontend: Success State                                   │
│                                                               │
│ Action: Modal transitions to success step                   │
│ View:                                                        │
│   - Green checkmark icon (16x16 circle)                     │
│   - "Number Provisioned"                                     │
│   - Large display: +442012345678                             │
│   - [Done] button                                            │
│                                                               │
│ State: step='success', provisionedNumber='+442012345678'    │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 🖱️  User clicks "Done"                                        │
│                                                               │
│ Action: Modal closes, page refreshes number list            │
│ API Call: GET /api/managed-telephony/status                 │
│ Response: { numbers: [{ phoneNumber: "+442012345678", ... }] │
│                                                               │
│ View: Main page shows active managed number card            │
│       - Phone number display                                 │
│       - Status: "active"                                     │
│       - Vapi ID: "uuid-abc-123"                              │
│       - [Delete] button                                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ✅ SUCCESS ✅
        Number is ready for AI agent calls


SUMMARY OF SUCCESSES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pre-flight check: 200 OK (no existing number)
✅ Number search: 200 OK (5 UK numbers returned)
✅ Number provisioning: 201 Created (8-step process succeeds)
✅ Vapi integration: Number imported and linked
✅ Database persistence: All records saved
✅ UI updates: Active number displayed on main page
```

---

## Diagram 3: Error Handling Flow (Feature Flag Missing)

```
┌───────────────────────────────────────────────────────────────┐
│                   REQUEST LIFECYCLE                            │
└───────────────────────────────────────────────────────────────┘

Frontend (BuyNumberModal.tsx)
    │
    │ authedBackendFetch('/api/managed-telephony/available-numbers')
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ authedBackendFetch (authed-backend-fetch.ts)                 │
│                                                               │
│ 1. Get JWT token from Supabase auth                          │
│    → token = "eyJhbGc..."                                    │
│                                                               │
│ 2. Build request headers:                                    │
│    Authorization: Bearer eyJhbGc...                          │
│    x-request-id: req_abc123                                  │
│    Content-Type: application/json                            │
│                                                               │
│ 3. Send HTTP GET request                                     │
│    → fetch('http://localhost:3001/api/managed-telephony/...') │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: Express Router (server.ts)                          │
│                                                               │
│ app.use('/api/managed-telephony', managedTelephonyRouter)   │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Middleware #1: requireAuthOrDev (auth.ts)                    │
│                                                               │
│ 1. Extract token from Authorization header                   │
│    → token = "eyJhbGc..."                                    │
│                                                               │
│ 2. Validate with Supabase Auth:                              │
│    const { user, error } = await supabase.auth.getUser(token) │
│                                                               │
│ 3. Extract org_id from user metadata:                        │
│    req.user = {                                              │
│      id: "user-uuid",                                        │
│      email: "voxanne@demo.com",                              │
│      orgId: "46cf2995-2bee-44e3-838b-24151486fe4e"          │
│    }                                                         │
│                                                               │
│ ✅ Result: next() → Pass to next middleware                  │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Middleware #2: requireFeature('managed_telephony')           │
│                                                               │
│ 1. Get orgId from request:                                   │
│    orgId = "46cf2995-2bee-44e3-838b-24151486fe4e"           │
│                                                               │
│ 2. Query FeatureFlagService.isFeatureEnabled():              │
│    a. Check org-specific override:                           │
│       SELECT enabled FROM org_feature_flags                  │
│       WHERE org_id = '46cf...'                               │
│         AND feature_name = 'managed_telephony'               │
│       → Result: null (no override)                           │
│                                                               │
│    b. Check global flag:                                     │
│       SELECT enabled, rollout_percentage                     │
│       FROM feature_flags                                     │
│       WHERE name = 'managed_telephony'                       │
│       → Result: null (flag doesn't exist in database!)       │
│                                                               │
│ 3. Return false (flag not found)                             │
│                                                               │
│ ❌ Result: Middleware blocks request                          │
│    res.status(403).json({                                    │
│      error: "Feature not enabled for your organization"      │
│    })                                                        │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ HTTP Response: 403 Forbidden                                 │
│                                                               │
│ Status: 403                                                  │
│ Headers:                                                     │
│   Content-Type: application/json                             │
│   x-request-id: req_abc123                                   │
│                                                               │
│ Body:                                                        │
│   {                                                          │
│     "error": "Feature not enabled for your organization"     │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ authedBackendFetch: Error Handling                           │
│                                                               │
│ 1. Check response.ok:                                        │
│    → res.ok = false (status 403)                             │
│                                                               │
│ 2. Read response body:                                       │
│    const json = await res.json()                             │
│    → json = { error: "Feature not enabled..." }             │
│                                                               │
│ 3. Create Error object:                                      │
│    const err = new Error(json.error)                         │
│    err.status = 403                                          │
│    err.response = json                                       │
│    err.requestId = 'req_abc123'                              │
│                                                               │
│ 4. Check if retryable:                                       │
│    isRetryable = (status >= 500 || status === 429)          │
│    → false (403 is client error, not retryable)              │
│                                                               │
│ ❌ Result: throw err (no retry)                               │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend: Catch Block (BuyNumberModal.tsx line 92-94)       │
│                                                               │
│ catch (err: any) {                                           │
│   setError(                                                  │
│     err.message || 'Failed to search numbers'                │
│   );                                                         │
│   // err.message = "Feature not enabled for your org..."    │
│ }                                                            │
│                                                               │
│ State Update:                                                │
│   loading = false                                            │
│   error = "Feature not enabled for your organization"       │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ React Render: Error Banner (line 401-407)                   │
│                                                               │
│ {error && (                                                  │
│   <div className="rounded-lg border border-red-200...">     │
│     <AlertCircle className="w-4 h-4 text-red-500" />        │
│     <p className="text-sm text-red-700">                     │
│       Feature not enabled for your organization              │
│     </p>                                                     │
│   </div>                                                     │
│ )}                                                           │
│                                                               │
│ ⚠️  Issues:                                                  │
│   - No "why" explanation                                     │
│   - No "how to fix" guidance                                 │
│   - No support link                                          │
│   - No retry button                                          │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│              USER SEES RED ERROR BANNER                       │
│                                                               │
│      "Feature not enabled for your organization"             │
│                                                               │
│                    No next steps                             │
│                    Dead-end state                            │
└──────────────────────────────────────────────────────────────┘


ERROR PROPAGATION SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database         → Feature flag 'managed_telephony' not found
                   ↓
Middleware       → FeatureFlagService.isFeatureEnabled() returns false
                   ↓
Express Router   → requireFeature() returns 403 Forbidden
                   ↓
HTTP Response    → { error: "Feature not enabled..." }
                   ↓
authedBackendFetch → Parses error, throws Error with message
                   ↓
Component        → catch block sets error state
                   ↓
React Render     → Red banner displays error message
                   ↓
User             → Sees error, cannot proceed, no resolution path
```

---

## Diagram 4: Recommended Improved Error Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Middleware #2: requireFeature (Enhanced Version)             │
│                                                               │
│ ❌ Feature flag not found                                     │
│                                                               │
│ res.status(403).json({                                       │
│   error: "Managed phone numbers require account activation", │
│   errorCode: "FEATURE_NOT_ENABLED",                          │
│   details: "This feature is not available on your current plan.", │
│   actionable: {                                              │
│     message: "Upgrade to Business plan or contact support", │
│     supportEmail: "support@voxanne.ai",                      │
│     helpUrl: "https://docs.voxanne.ai/managed-telephony",   │
│     upgradeUrl: "/dashboard/billing/upgrade"                │
│   }                                                          │
│ })                                                           │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend: Enhanced Error Display                             │
│                                                               │
│ {error && (                                                  │
│   <div className="rounded-lg border border-red-200...">     │
│     <div className="flex items-start gap-2 mb-3">           │
│       <AlertCircle className="w-5 h-5" />                    │
│       <div className="flex-1">                               │
│         <p className="font-medium">                          │
│           {err.error}                                        │
│         </p>                                                 │
│         <p className="text-sm mt-1">                         │
│           {err.details}                                      │
│         </p>                                                 │
│       </div>                                                 │
│     </div>                                                   │
│                                                               │
│     <div className="flex gap-2">                             │
│       <a href={err.actionable.supportEmail}                  │
│          className="btn btn-outline">                        │
│         Contact Support                                      │
│       </a>                                                   │
│       <a href={err.actionable.upgradeUrl}                    │
│          className="btn btn-primary">                        │
│         Upgrade Plan                                         │
│       </a>                                                   │
│     </div>                                                   │
│   </div>                                                     │
│ )}                                                           │
│                                                               │
│ ✅ User has clear next steps                                 │
│ ✅ Actionable resolution paths                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Report Complete ✅

**Total Diagrams:** 4
1. Current user journey (with bug)
2. Expected user journey (after migration)
3. Error handling flow (detailed trace)
4. Recommended improved error flow

**Purpose:** Visual aids for UX analysis and stakeholder communication
