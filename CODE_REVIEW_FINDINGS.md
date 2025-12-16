# Senior Engineer Code Review: Inbound/Outbound Agent Separation

## Executive Summary
The implementation is functionally complete but has several critical issues that should be addressed before production deployment. This review identifies 28 specific improvements across security, performance, error handling, and maintainability.

---

## 1. CRITICAL ISSUES (Must Fix Before Production)

### 1.1 Recording Download Timeout Risk
**File:** `call-recording-storage.ts:50-70`
**Issue:** 30-second timeout on recording download may be insufficient for large files
**Risk:** Calls with long recordings will fail silently, users won't know recording wasn't saved
**Fix:** 
- Make timeout configurable per environment
- Implement chunked download for large files
- Log timeout events explicitly
- Add file size validation before download

```typescript
// BEFORE (risky)
const response = await axios.get(recordingUrl, {
  responseType: 'arraybuffer',
  timeout: 30000 // May be too short
});

// AFTER (safer)
const MAX_RECORDING_SIZE = 500 * 1024 * 1024; // 500MB
const timeout = process.env.RECORDING_DOWNLOAD_TIMEOUT_MS || 60000;
const response = await axios.get(recordingUrl, {
  responseType: 'arraybuffer',
  timeout,
  maxContentLength: MAX_RECORDING_SIZE,
  maxBodyLength: MAX_RECORDING_SIZE
});
```

### 1.2 Missing Error Recovery in Webhook
**File:** `webhooks.ts:828-836`
**Issue:** If `calls` table update fails, webhook returns success but recording is orphaned
**Risk:** Recording stored but not linked to call, data inconsistency
**Fix:** Implement transaction-like behavior or retry logic

```typescript
// BEFORE (no recovery)
const { error: callsError } = await supabase
  .from('calls')
  .update({ call_type: callType, recording_storage_path: recordingStoragePath })
  .eq('vapi_call_id', call.id);

if (callsError) {
  console.error('[handleEndOfCallReport] Failed to update calls table:', callsError);
}

// AFTER (with recovery)
const { error: callsError } = await supabase
  .from('calls')
  .update({ call_type: callType, recording_storage_path: recordingStoragePath })
  .eq('vapi_call_id', call.id);

if (callsError) {
  logger.error('Failed to update calls table', { callId: call.id, error: callsError });
  // Attempt cleanup: delete orphaned recording
  if (recordingStoragePath) {
    await deleteRecording(recordingStoragePath);
  }
  throw new Error('Failed to link recording to call');
}
```

### 1.3 Call Type Detection Ambiguity
**File:** `call-type-detector.ts:45-75`
**Issue:** Phone number normalization may fail for international formats
**Risk:** Calls misclassified as wrong type, ending up in wrong dashboard tab
**Fix:** Use libphonenumber library for proper international support

```typescript
// BEFORE (fragile)
const normalizePhone = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, ''); // Removes all non-digits
};

// AFTER (robust)
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const normalizePhone = (phone?: string): string => {
  if (!phone) return '';
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed ? parsed.getNumberAfterDialingFormat() : phone.replace(/\D/g, '');
  } catch {
    return phone.replace(/\D/g, '');
  }
};
```

### 1.4 Missing Validation in Outbound Config
**File:** `outbound-agent-config.ts:30-40`
**Issue:** Twilio credentials not validated before saving
**Risk:** Invalid credentials saved, test calls fail later
**Fix:** Validate credentials with Twilio API before saving

```typescript
// ADD validation function
async function validateTwilioCredentials(
  accountSid: string,
  authToken: string,
  phoneNumber: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = twilio(accountSid, authToken);
    await client.api.accounts(accountSid).fetch();
    
    // Verify phone number exists in account
    const numbers = await client.incomingPhoneNumbers.list({ limit: 1 });
    const hasNumber = numbers.some(n => n.phoneNumber === phoneNumber);
    
    if (!hasNumber) {
      return { valid: false, error: 'Phone number not found in Twilio account' };
    }
    
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
```

---

## 2. SECURITY VULNERABILITIES

### 2.1 Signed URL Expiry Too Long
**File:** `call-recording-storage.ts:115, 158`
**Issue:** 1-hour signed URLs may be too long for sensitive calls
**Risk:** Leaked URL could be used for extended period
**Recommendation:** Make expiry configurable, default to 15 minutes

```typescript
// BEFORE
const { data: signedUrlData } = await supabase.storage
  .from('call-recordings')
  .createSignedUrl(storagePath, 3600); // 1 hour

// AFTER
const expirySeconds = parseInt(process.env.RECORDING_URL_EXPIRY_SECONDS || '900'); // 15 min default
const { data: signedUrlData } = await supabase.storage
  .from('call-recordings')
  .createSignedUrl(storagePath, expirySeconds);
```

### 2.2 No Rate Limiting on Config Endpoints
**File:** `outbound-agent-config.ts`
**Issue:** No rate limiting on POST/PUT/DELETE operations
**Risk:** Brute force attacks, config spam
**Fix:** Add rate limiting middleware

```typescript
import rateLimit from 'express-rate-limit';

const configLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many configuration changes, please try again later'
});

router.post('/', configLimiter, requireAuthOrDev, async (req, res) => {
  // ... existing code
});
```

### 2.3 Sensitive Data in Logs
**File:** `call-recording-storage.ts:45, 80`
**Issue:** Recording URL logged (may contain sensitive info)
**Risk:** URLs exposed in log aggregation services
**Fix:** Log only first 50 chars of URL

```typescript
// BEFORE
logger.info('uploadCallRecording', 'Starting download', {
  recordingUrl: recordingUrl.substring(0, 50) + '...'
});

// AFTER (better)
const maskedUrl = recordingUrl.substring(0, 30) + '...[redacted]';
logger.info('uploadCallRecording', 'Starting download', {
  recordingUrl: maskedUrl,
  urlLength: recordingUrl.length
});
```

### 2.4 Missing CORS Validation for Signed URLs
**File:** `call-recording-storage.ts`
**Issue:** Signed URLs could be accessed from any origin
**Risk:** Recordings accessible from unauthorized domains
**Fix:** Configure Supabase Storage CORS properly and validate origin in frontend

---

## 3. LOGICAL ERRORS & EDGE CASES

### 3.1 Race Condition in Call Type Detection
**File:** `call-type-detector.ts:20-45`
**Issue:** If both configs exist but phone numbers match neither, returns null
**Risk:** Call not saved to `calls` table, only to `call_logs`
**Fix:** Add explicit logging and fallback strategy

```typescript
// BEFORE (silent failure)
if (inboundConfig && toNumberNormalized === inboundPhoneNormalized) {
  return { callType: 'inbound', ... };
}
if (outboundConfig && fromNumberNormalized === outboundPhoneNormalized) {
  return { callType: 'outbound', ... };
}
return null; // Silent failure

// AFTER (explicit handling)
if (inboundConfig && toNumberNormalized === inboundPhoneNormalized) {
  return { callType: 'inbound', ... };
}
if (outboundConfig && fromNumberNormalized === outboundPhoneNormalized) {
  return { callType: 'outbound', ... };
}

// Explicit fallback with logging
logger.warn('detectCallType', 'No matching config found, using heuristic', {
  orgId,
  toNumber: toNumberNormalized,
  fromNumber: fromNumberNormalized,
  hasInboundConfig: !!inboundConfig,
  hasOutboundConfig: !!outboundConfig
});

// Heuristic: if only one config exists, use it
if (inboundConfig && !outboundConfig) {
  return { callType: 'inbound', ... };
}
if (outboundConfig && !inboundConfig) {
  return { callType: 'outbound', ... };
}

// Both configs exist but no match - default to outbound (safer)
return { callType: 'outbound', reason: 'No matching number, defaulting to outbound' };
```

### 3.2 Missing Null Checks in Webhook
**File:** `webhooks.ts:756-760`
**Issue:** `callLog` could be null, causing crash on line 770
**Risk:** Webhook fails, call not processed
**Fix:** Explicit null check before using callLog

```typescript
// BEFORE
const { data: callLog } = await supabase
  .from('call_logs')
  .select('agent_id, org_id, lead_id, to_number')
  .eq('vapi_call_id', call.id)
  .single();

if (!callLog) {
  console.error('[handleEndOfCallReport] Call log not found:', call.id);
  return;
}

// AFTER (same, but add validation)
const { data: callLog, error: callLogError } = await supabase
  .from('call_logs')
  .select('agent_id, org_id, lead_id, to_number')
  .eq('vapi_call_id', call.id)
  .single();

if (callLogError && callLogError.code !== 'PGRST116') {
  logger.error('Failed to fetch call log', { callId: call.id, error: callLogError });
  return;
}

if (!callLog) {
  logger.warn('Call log not found, creating minimal entry', { callId: call.id });
  // Consider creating a minimal call_logs entry for orphaned recordings
  return;
}
```

### 3.3 Frontend Tab State Not Persisted
**File:** `/src/app/dashboard/calls/page.tsx:49`
**Issue:** Active tab resets to 'inbound' on page refresh
**Risk:** Poor UX, users lose context
**Fix:** Persist tab state to URL or localStorage

```typescript
// BEFORE
const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound');

// AFTER
const router = useRouter();
const searchParams = useSearchParams();

const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(() => {
  const param = searchParams.get('tab');
  return (param === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound';
});

const handleTabChange = (tab: 'inbound' | 'outbound') => {
  setActiveTab(tab);
  router.push(`/dashboard/calls?tab=${tab}`, { scroll: false });
};
```

### 3.4 Missing Handling for Incomplete Recordings
**File:** `call-recording-storage.ts`
**Issue:** No check if recording is complete/valid before upload
**Risk:** Corrupted recordings stored
**Fix:** Validate recording before upload

```typescript
// ADD validation
async function validateRecording(buffer: Buffer): Promise<boolean> {
  // Check minimum size (at least 1KB for valid audio)
  if (buffer.length < 1024) {
    return false;
  }
  
  // Check for WAV header if applicable
  if (buffer.toString('ascii', 0, 4) === 'RIFF') {
    return true; // Valid WAV
  }
  
  // Check for MP3 header
  if ((buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) {
    return true; // Valid MP3
  }
  
  return false;
}
```

---

## 4. PERFORMANCE ISSUES

### 4.1 N+1 Query Problem in Call Type Detection
**File:** `call-type-detector.ts:20-30`
**Issue:** Makes 2 separate database queries every time
**Risk:** Slow webhook processing with many calls
**Fix:** Combine into single query

```typescript
// BEFORE (2 queries)
const { data: inboundConfig } = await supabase
  .from('inbound_agent_config')
  .select('id, twilio_phone_number')
  .eq('org_id', orgId)
  .single();

const { data: outboundConfig } = await supabase
  .from('outbound_agent_config')
  .select('id, twilio_phone_number')
  .eq('org_id', orgId)
  .single();

// AFTER (1 query with caching)
const cacheKey = `agent_configs:${orgId}`;
let configs = cache.get(cacheKey);

if (!configs) {
  const [inbound, outbound] = await Promise.all([
    supabase.from('inbound_agent_config').select('id, twilio_phone_number').eq('org_id', orgId).single(),
    supabase.from('outbound_agent_config').select('id, twilio_phone_number').eq('org_id', orgId).single()
  ]);
  
  configs = { inbound: inbound.data, outbound: outbound.data };
  cache.set(cacheKey, configs, 3600); // Cache for 1 hour
}
```

### 4.2 Inefficient Recording Download
**File:** `call-recording-storage.ts:50-70`
**Issue:** Downloads entire file into memory before upload
**Risk:** High memory usage for large recordings, potential OOM
**Fix:** Stream directly to Supabase Storage

```typescript
// BEFORE (memory inefficient)
const response = await axios.get(recordingUrl, {
  responseType: 'arraybuffer',
  timeout: 30000
});
recordingBuffer = Buffer.from(response.data);

// AFTER (streaming)
const response = await axios.get(recordingUrl, {
  responseType: 'stream',
  timeout: 30000
});

const { data: uploadData } = await supabase.storage
  .from('call-recordings')
  .upload(storagePath, response.data, {
    contentType: 'audio/wav',
    upsert: false
  });
```

### 4.3 Missing Database Indexes
**File:** Database schema
**Issue:** No index on `calls.vapi_call_id` for webhook lookups
**Risk:** Slow webhook processing as table grows
**Fix:** Add index

```sql
CREATE INDEX idx_calls_vapi_call_id ON public.calls(vapi_call_id);
CREATE INDEX idx_calls_org_id_call_type ON public.calls(org_id, call_type);
```

### 4.4 Frontend Fetches Config on Every Tab Switch
**File:** `/src/app/dashboard/test/page.tsx:100-131`
**Issue:** Reloads outbound config every time phone tab is clicked
**Risk:** Unnecessary API calls
**Fix:** Cache config with proper invalidation

```typescript
// BEFORE
useEffect(() => {
  const loadOutboundConfig = async () => {
    // Fetches every time activeTab changes
  };
  if (activeTab === 'phone' && user) {
    loadOutboundConfig();
  }
}, [activeTab, user]);

// AFTER
const [outboundConfigCache, setOutboundConfigCache] = useState<any>(null);
const [configLoadedAt, setConfigLoadedAt] = useState<number>(0);

useEffect(() => {
  const loadOutboundConfig = async () => {
    const now = Date.now();
    // Only reload if cache is older than 5 minutes
    if (outboundConfigCache && (now - configLoadedAt) < 5 * 60 * 1000) {
      return;
    }
    // ... fetch logic
    setConfigLoadedAt(now);
  };
  if (activeTab === 'phone' && user) {
    loadOutboundConfig();
  }
}, [activeTab, user, outboundConfigCache, configLoadedAt]);
```

---

## 5. NAMING & CODE QUALITY

### 5.1 Inconsistent Naming Conventions
**Issues:**
- `call_type` (snake_case) vs `callType` (camelCase) - inconsistent across codebase
- `recording_storage_path` vs `recordingStoragePath`
- `twilio_phone_number` vs `twilioPhoneNumber`

**Fix:** Standardize on camelCase for TypeScript, snake_case for database

### 5.2 Missing Type Definitions
**File:** `call-type-detector.ts`
**Issue:** Return type not explicitly defined
**Fix:**
```typescript
interface CallTypeDetectionResult {
  callType: 'inbound' | 'outbound';
  twilioNumber: string;
  configId: string;
  reason: string;
}

export async function detectCallType(
  orgId: string,
  toNumber?: string,
  fromNumber?: string
): Promise<CallTypeDetectionResult | null> {
  // ...
}
```

### 5.3 Magic Numbers Without Constants
**File:** `call-recording-storage.ts:42, 47, 58`
**Issues:**
- `3600` (1 hour) for signed URL expiry
- `3` for max retries
- `[1000, 2000, 4000]` for retry delays

**Fix:** Extract to constants

```typescript
const RECORDING_CONFIG = {
  SIGNED_URL_EXPIRY_SECONDS: 3600,
  MAX_DOWNLOAD_RETRIES: 3,
  RETRY_DELAYS_MS: [1000, 2000, 4000],
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024,
  DOWNLOAD_TIMEOUT_MS: 30000
} as const;
```

### 5.4 Unclear Function Names
**File:** `call-type-detector.ts:20`
**Issue:** `normalizePhone` doesn't indicate it's for comparison
**Fix:** Rename to `normalizePhoneForComparison`

---

## 6. DOCUMENTATION GAPS

### 6.1 Missing JSDoc Comments
**File:** All service files
**Issue:** Complex functions lack documentation
**Fix:** Add comprehensive JSDoc

```typescript
/**
 * Uploads a call recording to Supabase Storage with retry logic
 * 
 * @param params - Upload parameters
 * @param params.orgId - Organization ID for storage path
 * @param params.callId - Call ID for storage path
 * @param params.callType - 'inbound' or 'outbound' for path organization
 * @param params.recordingUrl - URL to download recording from (Vapi/Twilio)
 * @param params.vapiCallId - Vapi call ID for logging
 * 
 * @returns Upload result with storage path and signed URL
 * @throws Error if download fails after all retries
 * 
 * @example
 * const result = await uploadCallRecording({
 *   orgId: 'org-123',
 *   callId: 'call-456',
 *   callType: 'outbound',
 *   recordingUrl: 'https://vapi.com/recording.wav',
 *   vapiCallId: 'vapi-789'
 * });
 */
export async function uploadCallRecording(
  params: UploadRecordingParams
): Promise<RecordingUploadResult> {
```

### 6.2 Missing Architecture Documentation
**Issue:** No explanation of call type detection strategy
**Fix:** Add to README or separate doc

```markdown
## Call Type Detection Strategy

The system determines if a call is inbound or outbound by comparing phone numbers:

1. **Inbound**: If the "to" number matches the inbound agent's Twilio number
2. **Outbound**: If the "from" number matches the outbound agent's Twilio number
3. **Fallback**: If both configs exist but no match, defaults to outbound
4. **Single Config**: If only one config exists, uses that type

This approach requires both agents to have distinct Twilio phone numbers.
```

---

## 7. MISSING ERROR HANDLING

### 7.1 No Handling for Supabase Storage Bucket Missing
**File:** `call-recording-storage.ts:95`
**Issue:** If `call-recordings` bucket doesn't exist, upload fails cryptically
**Fix:** Check bucket exists on startup

```typescript
async function ensureRecordingsBucketExists() {
  try {
    await supabase.storage.getBucket('call-recordings');
  } catch (error) {
    logger.error('call-recordings bucket not found, creating...');
    await supabase.storage.createBucket('call-recordings', {
      public: false,
      fileSizeLimit: 500 * 1024 * 1024 // 500MB
    });
  }
}
```

### 7.2 No Handling for Network Errors During Recording Download
**File:** `call-recording-storage.ts:50-70`
**Issue:** Network errors not distinguished from timeout errors
**Fix:** Add specific error handling

```typescript
try {
  const response = await axios.get(recordingUrl, { ... });
} catch (error: any) {
  if (error.code === 'ECONNABORTED') {
    logger.error('Recording download timeout', { callId, timeout });
  } else if (error.code === 'ENOTFOUND') {
    logger.error('Recording URL unreachable', { callId, url: recordingUrl });
  } else if (error.response?.status === 404) {
    logger.error('Recording not found at URL', { callId, url: recordingUrl });
  } else {
    logger.error('Recording download failed', { callId, error: error.message });
  }
  throw error;
}
```

---

## 8. TESTING GAPS

### 8.1 No Unit Tests for Call Type Detection
**Issue:** Complex logic with no test coverage
**Risk:** Edge cases not caught
**Fix:** Add test suite

```typescript
describe('detectCallType', () => {
  it('should detect inbound call when toNumber matches inbound config', async () => {
    // Test implementation
  });
  
  it('should detect outbound call when fromNumber matches outbound config', async () => {
    // Test implementation
  });
  
  it('should handle international phone numbers', async () => {
    // Test implementation
  });
  
  it('should fallback to outbound when no match found', async () => {
    // Test implementation
  });
});
```

### 8.2 No Integration Tests for Recording Upload
**Issue:** Recording storage not tested end-to-end
**Risk:** Failures only discovered in production
**Fix:** Add integration tests

---

## 9. SCALABILITY CONCERNS

### 9.1 No Pagination for Config Fetch
**File:** `call-type-detector.ts`
**Issue:** If org has multiple agents, only first is fetched
**Risk:** Doesn't scale to multiple agents per type
**Fix:** Design for multiple agents per org

### 9.2 Recording Storage Path Not Unique Enough
**File:** `call-recording-storage.ts:85`
**Issue:** Path is `calls/{org_id}/{call_type}/{call_id}/{timestamp}.wav`
**Risk:** If same call_id used twice, overwrites previous
**Fix:** Add UUID to path

```typescript
const uuid = crypto.randomUUID();
const storagePath = `calls/${orgId}/${callType}/${callId}/${timestamp}-${uuid}.wav`;
```

### 9.3 No Cleanup Strategy for Old Recordings
**Issue:** Recordings accumulate indefinitely
**Risk:** Storage costs grow unbounded
**Fix:** Implement retention policy

```typescript
// Add to database schema
ALTER TABLE public.calls ADD COLUMN retention_days INTEGER DEFAULT 90;

// Add cleanup job
async function cleanupOldRecordings() {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const { data: oldCalls } = await supabase
    .from('calls')
    .select('recording_storage_path')
    .lt('created_at', cutoffDate.toISOString())
    .not('recording_storage_path', 'is', null);
  
  for (const call of oldCalls || []) {
    await deleteRecording(call.recording_storage_path);
  }
}
```

---

## 10. DEPLOYMENT ISSUES

### 10.1 No Migration Rollback Plan
**Issue:** If deployment fails, no clear rollback
**Fix:** Document rollback steps

### 10.2 No Feature Flag for Gradual Rollout
**Issue:** All users get inbound/outbound separation at once
**Fix:** Add feature flag

```typescript
const FEATURE_FLAGS = {
  INBOUND_OUTBOUND_SEPARATION: process.env.ENABLE_INBOUND_OUTBOUND_SEPARATION === 'true'
};

if (FEATURE_FLAGS.INBOUND_OUTBOUND_SEPARATION) {
  // Use new logic
} else {
  // Use old logic
}
```

---

## SUMMARY OF IMPROVEMENTS

| Category | Count | Priority |
|----------|-------|----------|
| Critical Security Issues | 4 | HIGH |
| Logical Errors | 4 | HIGH |
| Performance Issues | 4 | MEDIUM |
| Code Quality | 4 | MEDIUM |
| Documentation Gaps | 2 | MEDIUM |
| Error Handling | 2 | HIGH |
| Testing Gaps | 2 | MEDIUM |
| Scalability | 3 | MEDIUM |
| Deployment | 2 | MEDIUM |
| **TOTAL** | **27** | - |

---

## RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Before Production)
1. Add Twilio credential validation
2. Fix webhook error recovery
3. Improve call type detection with libphonenumber
4. Add rate limiting to config endpoints
5. Fix recording download timeout handling

### Phase 2: Important Improvements (First Sprint)
1. Add unit tests for call type detection
2. Implement config caching
3. Add database indexes
4. Improve error messages
5. Add JSDoc documentation

### Phase 3: Scalability & Optimization (Second Sprint)
1. Implement recording cleanup policy
2. Add feature flags for gradual rollout
3. Stream recording downloads instead of buffering
4. Add integration tests
5. Implement recording retention

