# Senior Engineer Review: Call Recording & Storage Infrastructure

**Date:** December 19, 2025  
**Scope:** End-to-end call recording system for inbound and outbound calls  
**Focus Areas:** User flow, logical correctness, edge cases, security, performance, scalability

---

## EXECUTIVE SUMMARY

The call recording infrastructure is **functionally sound** but has **critical gaps** in:
1. **Incomplete user flow** - Recording metadata not fully synced to dashboard
2. **Missing inbound call recording** - Only outbound calls are being recorded
3. **Orphaned recordings** - No cleanup for failed database updates
4. **Race conditions** - Recording URL might expire before dashboard loads
5. **No download tracking** - Can't audit who downloaded what when
6. **Missing error recovery** - Failed uploads not retried

---

## PART 1: USER FLOW ANALYSIS

### Current User Flow (Inbound Call → Recording → Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INBOUND CALL INITIATED                                       │
├─────────────────────────────────────────────────────────────────┤
│ • Customer calls Twilio number                                  │
│ • Twilio forwards to Vapi                                       │
│ • Vapi creates call with inbound agent                          │
│ • call.started webhook sent to backend                          │
│ • Call log created in database                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CALL IN PROGRESS                                             │
├─────────────────────────────────────────────────────────────────┤
│ • Agent and customer converse                                   │
│ • Vapi records audio to its servers                             │
│ • Real-time transcription happening                             │
│ • WebSocket broadcasts call status to dashboard (LIVE)          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CALL ENDS                                                    │
├─────────────────────────────────────────────────────────────────┤
│ • call.ended webhook sent                                       │
│ • Call status updated to 'completed'                            │
│ • Vapi generates end-of-call-report webhook                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RECORDING PROCESSING (handleEndOfCallReport)                 │
├─────────────────────────────────────────────────────────────────┤
│ • Webhook received with artifact.recording URL                  │
│ • Idempotency check (prevent duplicate processing)              │
│ • Download recording from Vapi (with 3 retries)                 │
│ • Upload to Supabase Storage (calls/{org}/{type}/{id}.wav)      │
│ • Generate signed URL (15 min expiry)                           │
│ • Update call_logs table with recording_url                     │
│ • Update calls table with recording_storage_path                │
│ • Broadcast update to dashboard via WebSocket                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. DASHBOARD DISPLAYS RECORDING                                 │
├─────────────────────────────────────────────────────────────────┤
│ • Dashboard fetches call_logs for recent calls                  │
│ • Shows recording_url in call details                           │
│ • User clicks "Play Recording"                                  │
│ • Frontend calls GET /api/calls/{callId}/recording              │
│ • Backend generates fresh signed URL (if needed)                │
│ • Audio player loads and plays recording                        │
│ • User can download recording (if implemented)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 2: CRITICAL ISSUES & IMPROVEMENTS

### Issue 1: Inbound Calls Not Being Recorded ❌

**Problem:**
- `handleEndOfCallReport` is called for all calls (inbound + outbound)
- But inbound calls may not have `artifact.recording` populated
- Vapi might not record inbound calls by default

**Evidence:**
- `webhooks.ts:1181` checks `if (artifact?.recording)` but doesn't log when missing
- No explicit configuration to enable recording on inbound agents
- No fallback mechanism if recording is missing

**Impact:**
- Business owner can't listen to inbound calls
- No audit trail of customer conversations
- Compliance risk (if required to record calls)

**Fix Required:**
```typescript
// 1. Ensure inbound agents have recording enabled in Vapi config
// 2. Add explicit logging when recording is missing
// 3. Implement fallback: use transcript if recording unavailable
// 4. Add monitoring alert if recording rate drops below threshold
```

**Recommendation:**
- ✅ Add `recordingEnabled: true` to inbound agent creation
- ✅ Log warning when recording missing: "Recording not available for inbound call {callId}"
- ✅ Store transcript as fallback in call_logs.transcript_only_fallback
- ✅ Add metric: "inbound_calls_without_recording" to track issues

---

### Issue 2: Recording URL Expiry Race Condition ⚠️

**Problem:**
- Signed URL expires in 15 minutes (`RECORDING_CONFIG.SIGNED_URL_EXPIRY_SECONDS = 900`)
- Dashboard might not load/refresh within 15 minutes
- User clicks "Play" → URL expired → 403 Forbidden error

**Evidence:**
- `call-recording-storage.ts:16` hardcodes 15-minute expiry
- `calls.ts:309` generates signed URL on-demand but doesn't handle expiry
- No refresh mechanism if URL expires

**Impact:**
- User can't play recording after 15 minutes
- Poor UX: "Recording unavailable" error
- Requires page refresh to regenerate URL

**Fix Required:**
```typescript
// 1. Increase default expiry to 1 hour (3600s)
// 2. Implement URL refresh endpoint
// 3. Add client-side URL refresh before expiry
// 4. Cache signed URL in frontend with expiry tracking
```

**Recommendation:**
- ✅ Change `SIGNED_URL_EXPIRY_SECONDS` to 3600 (1 hour)
- ✅ Add `POST /api/calls/{callId}/recording/refresh` endpoint
- ✅ Frontend: refresh URL 5 minutes before expiry
- ✅ Add `expiresAt` to recording response for client tracking

---

### Issue 3: Incomplete Recording Metadata Sync ❌

**Problem:**
- Recording uploaded to Supabase Storage
- Storage path saved to `calls.recording_storage_path`
- But `call_logs.recording_url` still points to original Vapi URL
- Dashboard might display stale/expired Vapi URL instead of storage URL

**Evidence:**
- `webhooks.ts:1213` saves `artifact?.recording` (Vapi URL) to call_logs
- `webhooks.ts:1228` saves `recordingStoragePath` to calls table
- Two different tables, two different URLs → inconsistency

**Impact:**
- Dashboard shows expired Vapi URL
- User clicks → 403 error
- Storage path is available but not used

**Fix Required:**
```typescript
// Update call_logs to use storage path instead of Vapi URL
const { error: callLogsError } = await supabase
  .from('call_logs')
  .update({
    outcome: 'completed',
    recording_storage_path: recordingStoragePath,  // Add this
    recording_url: recordingSignedUrl,              // Use signed URL
    transcript: artifact?.transcript || null,
    cost: call.cost || 0
  })
  .eq('vapi_call_id', call.id);
```

**Recommendation:**
- ✅ Add `recording_storage_path` column to `call_logs` table
- ✅ Save both storage path AND signed URL to call_logs
- ✅ Update calls.ts to read from call_logs (single source of truth)
- ✅ Deprecate direct Vapi URL usage

---

### Issue 4: No Download Tracking or Audit Trail ❌

**Problem:**
- Recording can be downloaded but no tracking
- Can't answer: "Who downloaded what when?"
- No audit trail for compliance/security

**Evidence:**
- `calls.ts:280-323` serves recording but doesn't log download
- No `recording_downloads` table
- No user identification on download endpoint

**Impact:**
- Compliance risk (can't prove who accessed recordings)
- Security risk (no detection of unauthorized access)
- No analytics on recording engagement

**Fix Required:**
```typescript
// Add download tracking
interface RecordingDownloadLog {
  id: uuid;
  call_id: uuid;
  user_id: uuid;
  downloaded_at: timestamp;
  ip_address: string;
  user_agent: string;
}

// Log every download
await supabase.from('recording_downloads').insert({
  call_id: callId,
  user_id: req.user.id,
  downloaded_at: new Date(),
  ip_address: req.ip,
  user_agent: req.headers['user-agent']
});
```

**Recommendation:**
- ✅ Create `recording_downloads` audit table
- ✅ Log every GET /api/calls/{callId}/recording request
- ✅ Include user_id, timestamp, IP, user_agent
- ✅ Add download count to dashboard call details

---

### Issue 5: Orphaned Recordings on Database Failure ⚠️

**Problem:**
- Recording uploaded to storage successfully
- Database update fails → orphaned file in storage
- File takes up space, costs money, never cleaned up

**Evidence:**
- `webhooks.ts:1236-1253` attempts cleanup but might fail
- No retry mechanism for failed cleanup
- No scheduled job to find orphaned files

**Impact:**
- Storage bloat over time
- Unnecessary costs
- Compliance issue (data retention)

**Fix Required:**
```typescript
// 1. Implement orphan detection job
// 2. Add orphan_detected flag to calls table
// 3. Implement cleanup job that runs daily
// 4. Add metrics for orphaned file count
```

**Recommendation:**
- ✅ Add `orphan_detected` boolean to calls table
- ✅ Mark as orphan if recording_storage_path exists but call_logs.recording_url is null
- ✅ Implement daily cleanup job: find orphans older than 7 days, delete
- ✅ Add monitoring alert: "Orphaned recordings detected"

---

### Issue 6: No Retry Mechanism for Failed Uploads ❌

**Problem:**
- If recording upload fails, no automatic retry
- User never gets recording
- Manual intervention required

**Evidence:**
- `call-recording-storage.ts:43-198` has download retries but not upload retries
- `webhooks.ts:1200-1204` logs error but doesn't retry
- No queue system for failed uploads

**Impact:**
- Some calls lose recordings permanently
- Poor reliability (should be 99.9%+)
- Manual debugging required

**Fix Required:**
```typescript
// Implement upload retry with exponential backoff
// Add failed_uploads table for manual recovery
interface FailedUpload {
  id: uuid;
  call_id: uuid;
  vapi_recording_url: string;
  error_message: string;
  retry_count: number;
  next_retry_at: timestamp;
  created_at: timestamp;
}
```

**Recommendation:**
- ✅ Add upload retry logic (3 attempts, exponential backoff)
- ✅ Create `failed_uploads` table for tracking
- ✅ Implement background job: retry failed uploads every 5 minutes
- ✅ Alert if retry count exceeds 3

---

### Issue 7: Missing Real-Time Dashboard Updates ⚠️

**Problem:**
- Recording processed asynchronously
- Dashboard doesn't know when recording is ready
- User sees "No recording available" then has to refresh

**Evidence:**
- `webhooks.ts:1258-1262` logs completion but doesn't broadcast
- No WebSocket update sent to dashboard
- No polling mechanism on frontend

**Impact:**
- Poor UX: user doesn't know recording is ready
- Requires manual page refresh
- Doesn't match real-time expectations

**Fix Required:**
```typescript
// Broadcast recording ready event
await wsBroadcast({
  type: 'recording_ready',
  callId: call.id,
  recordingUrl: recordingSignedUrl,
  storagePath: recordingStoragePath,
  timestamp: new Date()
});
```

**Recommendation:**
- ✅ Add WebSocket broadcast when recording uploaded
- ✅ Frontend listens for `recording_ready` event
- ✅ Auto-refresh call details when event received
- ✅ Show "Recording ready" toast notification

---

### Issue 8: Inconsistent Error Handling ⚠️

**Problem:**
- Mix of `console.error`, `logger.error`, and silent failures
- Some errors throw, others return null
- Inconsistent error messages

**Evidence:**
- `webhooks.ts:1130` uses `console.error`
- `webhooks.ts:1144` uses `console.error`
- `call-recording-storage.ts:192` uses `logger.error`
- `calls.ts:292` uses `console.error`

**Impact:**
- Hard to debug issues
- Errors might be missed in logs
- Inconsistent monitoring

**Fix Required:**
```typescript
// Use logger consistently everywhere
// Standardize error format:
logger.error('Module', 'Operation failed', {
  callId,
  error: error.message,
  code: error.code,
  context: { /* relevant data */ }
});
```

**Recommendation:**
- ✅ Replace all `console.error` with `logger.error`
- ✅ Standardize error context object
- ✅ Include error codes for monitoring
- ✅ Add error metrics to dashboard

---

### Issue 9: No Validation of Recording File Integrity ⚠️

**Problem:**
- Recording downloaded but not validated
- Corrupted file could be uploaded to storage
- User tries to play → playback fails silently

**Evidence:**
- `call-recording-storage.ts:78-85` checks size but not format
- No audio format validation
- No checksum verification

**Impact:**
- Corrupted recordings in storage
- Poor user experience
- Wasted storage space

**Fix Required:**
```typescript
// Validate audio file
function validateAudioFile(buffer: Buffer): boolean {
  // Check WAV header: RIFF....WAVE
  const header = buffer.toString('ascii', 0, 4);
  if (header !== 'RIFF') return false;
  
  const format = buffer.toString('ascii', 8, 12);
  if (format !== 'WAVE') return false;
  
  return true;
}
```

**Recommendation:**
- ✅ Validate audio format (WAV/MP3 header)
- ✅ Check file duration (should be > 0 seconds)
- ✅ Verify bitrate is reasonable (8-320 kbps)
- ✅ Reject corrupted files and retry

---

### Issue 10: No Compression or Format Optimization ⚠️

**Problem:**
- Recording stored as raw WAV (large files)
- 1 hour call = ~250MB uncompressed
- Storage costs scale linearly with call volume

**Evidence:**
- `call-recording-storage.ts:146` hardcodes `contentType: 'audio/wav'`
- No compression mentioned
- No format conversion

**Impact:**
- High storage costs
- Slow downloads
- Bandwidth waste

**Fix Required:**
```typescript
// Convert to MP3 (10x smaller)
// 1 hour WAV: ~250MB → 1 hour MP3: ~25MB
// Use ffmpeg or similar
```

**Recommendation:**
- ✅ Convert WAV to MP3 (128kbps) before storage
- ✅ Reduces storage by 90%
- ✅ Faster downloads
- ✅ Better compatibility (plays everywhere)

---

## PART 3: DATABASE SCHEMA IMPROVEMENTS

### Recommended Schema Changes

```sql
-- Add columns to call_logs table
ALTER TABLE call_logs ADD COLUMN (
  recording_storage_path TEXT,           -- Path in Supabase Storage
  recording_signed_url TEXT,             -- Current signed URL
  recording_signed_url_expires_at TIMESTAMP,  -- When URL expires
  recording_format TEXT,                 -- 'wav', 'mp3', etc
  recording_size_bytes BIGINT,           -- File size for analytics
  recording_duration_seconds INT,        -- Call duration
  recording_uploaded_at TIMESTAMP,       -- When uploaded to storage
  transcript_only_fallback BOOLEAN       -- True if no recording, only transcript
);

-- Audit trail for downloads
CREATE TABLE recording_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  downloaded_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  download_duration_seconds INT
);

-- Track failed uploads for retry
CREATE TABLE failed_recording_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  vapi_recording_url TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Orphaned file detection
CREATE TABLE orphaned_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT UNIQUE,
  detected_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  size_bytes BIGINT
);
```

---

## PART 4: IMPLEMENTATION PRIORITY

### Phase 1: Critical (This Week)
- [ ] Enable recording on inbound agents (Vapi config)
- [ ] Fix recording metadata sync (call_logs vs calls table)
- [ ] Implement WebSocket broadcast for recording_ready
- [ ] Add URL refresh endpoint and client-side refresh logic
- [ ] Replace console.error with logger.error (consistency)
- [ ] Add `recording_storage_path` to call_logs table

### Phase 2: Important (Next Week)
- [ ] Implement download tracking (recording_downloads table)
- [ ] Add orphan detection and cleanup job
- [ ] Implement upload retry mechanism
- [ ] Add audio file validation
- [ ] Add recording metrics to dashboard

### Phase 3: Enhancement (Following Week)
- [ ] Implement WAV → MP3 conversion
- [ ] Add recording compression
- [ ] Implement recording search/filter
- [ ] Add call transcript search
- [ ] Implement recording analytics

---

## PART 5: TESTING STRATEGY

### Unit Tests
```typescript
// Test recording upload with retries
// Test signed URL generation and expiry
// Test orphan detection logic
// Test audio file validation
// Test download tracking
```

### Integration Tests
```typescript
// Test end-to-end: call → recording → dashboard
// Test recording expiry and refresh
// Test failed upload retry
// Test concurrent recording uploads
// Test storage quota limits
```

### Load Tests
```
// 100 concurrent calls
// 1000 recording downloads
// Recording upload under network latency
// Signed URL generation at scale
```

---

## PART 6: MONITORING & ALERTING

### Key Metrics
```
- recording_upload_success_rate (target: 99.9%)
- recording_url_expiry_errors (target: 0)
- orphaned_recording_count (target: 0)
- average_recording_size (track for cost)
- recording_download_count (engagement metric)
- failed_upload_retry_count (reliability metric)
```

### Alerts
```
- Recording upload failure rate > 1%
- Orphaned recordings detected
- Failed upload retries exhausted
- Recording storage quota exceeded
- Signed URL generation failures
```

---

## SUMMARY TABLE

| Issue | Severity | Impact | Fix Effort | Priority |
|-------|----------|--------|-----------|----------|
| Inbound calls not recorded | CRITICAL | No inbound recordings | Medium | P0 |
| URL expiry race condition | HIGH | User can't play after 15min | Low | P1 |
| Metadata sync incomplete | HIGH | Dashboard shows wrong URL | Low | P1 |
| No download tracking | MEDIUM | Compliance risk | Low | P2 |
| Orphaned recordings | MEDIUM | Storage bloat | Medium | P2 |
| No upload retry | HIGH | Lost recordings | Medium | P1 |
| Missing real-time updates | MEDIUM | Poor UX | Low | P2 |
| Inconsistent error handling | MEDIUM | Hard to debug | Low | P2 |
| No file validation | MEDIUM | Corrupted files | Low | P2 |
| No compression | LOW | High costs | High | P3 |

---

## CONCLUSION

The recording infrastructure has a **solid foundation** but needs **critical fixes** before production:

1. **Enable inbound recording** - Currently missing
2. **Fix metadata sync** - Two tables, inconsistent data
3. **Add real-time updates** - Dashboard doesn't know when recording is ready
4. **Implement retries** - Failed uploads are permanent
5. **Add monitoring** - Can't track reliability

**Estimated effort:** 2-3 weeks for all phases  
**Business impact:** High - directly affects user experience and compliance  
**Recommended start:** Phase 1 immediately (critical path)
