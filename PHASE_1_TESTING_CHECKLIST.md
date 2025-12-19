# Phase 1: Call Recording Infrastructure - Testing Checklist

**Date:** December 19, 2025  
**Status:** Ready for Testing  
**Target:** Verify all critical fixes work end-to-end

---

## Pre-Testing Setup

### Database Migrations Required
Before testing, ensure these columns exist in your Supabase database:

```sql
-- Add to call_logs table
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_signed_url TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_signed_url_expires_at TIMESTAMP;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_format TEXT DEFAULT 'wav';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_size_bytes BIGINT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_duration_seconds INT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_uploaded_at TIMESTAMP;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript_only_fallback BOOLEAN DEFAULT FALSE;

-- Create audit tables
CREATE TABLE IF NOT EXISTS recording_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  downloaded_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  download_duration_seconds INT
);

CREATE TABLE IF NOT EXISTS failed_recording_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  vapi_recording_url TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orphaned_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT UNIQUE,
  detected_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  size_bytes BIGINT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_recording_storage_path ON call_logs(recording_storage_path);
CREATE INDEX IF NOT EXISTS idx_call_logs_recording_uploaded_at ON call_logs(recording_uploaded_at);
CREATE INDEX IF NOT EXISTS idx_failed_uploads_next_retry ON failed_recording_uploads(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_orphaned_recordings_deleted ON orphaned_recordings(deleted_at);
```

### Environment Variables
Verify these are set in your `.env` file:

```bash
# Recording Configuration
RECORDING_URL_EXPIRY_SECONDS=3600          # 1 hour
RECORDING_DOWNLOAD_TIMEOUT_MS=60000        # 60 seconds

# Vapi Configuration
VAPI_API_KEY=<your-vapi-key>
VAPI_PHONE_NUMBER_ID=<your-phone-number-id>

# Supabase Configuration
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
```

---

## Manual Testing Checklist

### Test 1: Inbound Call Recording ✅
**Objective:** Verify inbound calls are recorded and stored

**Steps:**
1. [ ] Log in to dashboard at `https://callwaitingai.dev`
2. [ ] Navigate to Agent Config page
3. [ ] Verify inbound agent is configured
4. [ ] Call the Twilio inbound number from your phone
5. [ ] Have a brief conversation with the agent
6. [ ] End the call
7. [ ] Wait 30 seconds for recording to upload
8. [ ] Check backend logs: `https://dashboard.render.com/` → Logs
9. [ ] Look for: "Recording uploaded successfully"

**Expected Results:**
- ✅ Call appears in call_logs table
- ✅ `recording_storage_path` is populated
- ✅ `recording_signed_url` is populated
- ✅ `recording_uploaded_at` timestamp is set
- ✅ WebSocket broadcasts `recording_ready` event
- ✅ No errors in logs

**Verification Query:**
```sql
SELECT 
  vapi_call_id,
  recording_storage_path,
  recording_signed_url,
  recording_uploaded_at,
  transcript_only_fallback
FROM call_logs
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

---

### Test 2: Outbound Call Recording ✅
**Objective:** Verify outbound calls are recorded and stored

**Steps:**
1. [ ] Navigate to Agent Config page
2. [ ] Verify outbound agent is configured
3. [ ] Click "Test Live Call" button
4. [ ] Enter a test phone number
5. [ ] Wait for call to connect
6. [ ] Have a brief conversation
7. [ ] End the call
8. [ ] Wait 30 seconds for recording to upload
9. [ ] Check backend logs for success message

**Expected Results:**
- ✅ Call appears in call_logs table
- ✅ `recording_storage_path` is populated
- ✅ `recording_signed_url` is populated
- ✅ `call_type` is set to 'outbound'
- ✅ No errors in logs

---

### Test 3: Recording Playback ✅
**Objective:** Verify recording can be played from dashboard

**Steps:**
1. [ ] Navigate to Calls dashboard
2. [ ] Find the call you just made
3. [ ] Click "Play Recording" button
4. [ ] Audio player should load
5. [ ] Click play button
6. [ ] Verify audio plays correctly
7. [ ] Check browser console for errors

**Expected Results:**
- ✅ Recording URL is valid
- ✅ Audio player loads without errors
- ✅ Audio plays without interruption
- ✅ No CORS errors in console

**Verification Query:**
```sql
SELECT COUNT(*) as download_count
FROM recording_downloads
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

---

### Test 4: URL Refresh Endpoint ✅
**Objective:** Verify signed URL can be refreshed before expiry

**Steps:**
1. [ ] Get a recording URL from the API:
   ```bash
   curl -X GET "https://voxanne-backend.onrender.com/api/calls/{callId}/recording" \
     -H "Authorization: Bearer {token}"
   ```
2. [ ] Note the `expiresAt` and `expiresIn` values
3. [ ] Call the refresh endpoint:
   ```bash
   curl -X POST "https://voxanne-backend.onrender.com/api/calls/{callId}/recording/refresh" \
     -H "Authorization: Bearer {token}"
   ```
4. [ ] Verify new URL is returned
5. [ ] Verify new `expiresAt` is 1 hour from now

**Expected Results:**
- ✅ Refresh endpoint returns 200 OK
- ✅ New signed URL is generated
- ✅ `expiresIn` is 3600 seconds (1 hour)
- ✅ Old URL still works until expiry

---

### Test 5: Download Tracking ✅
**Objective:** Verify downloads are logged for audit trail

**Steps:**
1. [ ] Play a recording (triggers download)
2. [ ] Wait 5 seconds
3. [ ] Query the recording_downloads table:
   ```sql
   SELECT * FROM recording_downloads
   WHERE created_at > NOW() - INTERVAL '1 minute'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Expected Results:**
- ✅ Download logged with user_id
- ✅ IP address captured
- ✅ User agent captured
- ✅ Timestamp is accurate

---

### Test 6: WebSocket Real-Time Updates ✅
**Objective:** Verify dashboard gets real-time notification when recording is ready

**Steps:**
1. [ ] Open browser DevTools → Network → WS
2. [ ] Navigate to Calls dashboard
3. [ ] Make a new call
4. [ ] Watch WebSocket messages
5. [ ] Look for `recording_ready` event after call ends

**Expected Results:**
- ✅ WebSocket connection established
- ✅ `recording_ready` event received
- ✅ Event contains `recordingUrl` and `expiresAt`
- ✅ Dashboard updates automatically (no page refresh needed)

---

### Test 7: Orphan Detection Job ✅
**Objective:** Verify orphan cleanup job runs and cleans up old orphaned recordings

**Steps:**
1. [ ] Manually create an orphaned recording:
   ```sql
   INSERT INTO call_logs (vapi_call_id, recording_storage_path, recording_uploaded_at)
   VALUES ('orphan-test-' || gen_random_uuid()::text, 'calls/test/orphan.wav', NOW() - INTERVAL '8 days');
   ```
2. [ ] Wait for 2 AM UTC (or manually trigger job)
3. [ ] Check orphaned_recordings table:
   ```sql
   SELECT * FROM orphaned_recordings WHERE deleted_at IS NOT NULL;
   ```

**Expected Results:**
- ✅ Orphan detected after 7 days
- ✅ File deleted from storage
- ✅ Orphan marked as deleted in database
- ✅ No errors in logs

---

### Test 8: Upload Retry Mechanism ✅
**Objective:** Verify failed uploads are automatically retried

**Steps:**
1. [ ] Simulate a failed upload by:
   - Temporarily disabling Supabase Storage access
   - Making a call
   - Re-enabling access
2. [ ] Check failed_recording_uploads table:
   ```sql
   SELECT * FROM failed_recording_uploads
   WHERE resolved_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. [ ] Wait for retry (every 5 minutes)
4. [ ] Verify upload succeeds on retry

**Expected Results:**
- ✅ Failed upload logged in failed_recording_uploads
- ✅ `next_retry_at` is set to 5 minutes from now
- ✅ Retry job runs and attempts upload
- ✅ On success, `resolved_at` is set
- ✅ Recording appears in call_logs

---

### Test 9: Error Handling & Logging ✅
**Objective:** Verify consistent error logging throughout pipeline

**Steps:**
1. [ ] Check backend logs for consistency:
   ```bash
   # Should see logger.error, not console.error
   grep -r "logger.error" backend/src/routes/webhooks.ts
   ```
2. [ ] Make a call and check logs
3. [ ] Verify all errors use standardized format:
   ```
   logger.error('Module', 'Error message', { context })
   ```

**Expected Results:**
- ✅ All errors use logger (not console.error)
- ✅ Error format is consistent
- ✅ Call IDs included in all logs
- ✅ Easy to search logs by module name

---

### Test 10: End-to-End Flow ✅
**Objective:** Verify complete flow from call to playback

**Steps:**
1. [ ] Make an inbound call
2. [ ] Verify recording uploaded (check logs)
3. [ ] Verify WebSocket notification received
4. [ ] Verify dashboard shows recording available
5. [ ] Click play and verify audio plays
6. [ ] Wait 55 minutes
7. [ ] Verify URL still works (1 hour expiry)
8. [ ] Click refresh and get new URL
9. [ ] Verify download is logged

**Expected Results:**
- ✅ All steps complete without errors
- ✅ No manual page refreshes needed
- ✅ Recording available immediately after call
- ✅ URL doesn't expire during normal use
- ✅ Audit trail complete

---

## Automated Testing

### Unit Tests to Add
```typescript
// test/recording-storage.test.ts
describe('Recording Storage', () => {
  it('should upload recording with retry', async () => {
    // Test uploadCallRecording with retries
  });

  it('should generate signed URL with correct expiry', async () => {
    // Test getSignedRecordingUrl
  });

  it('should refresh URL before expiry', async () => {
    // Test URL refresh endpoint
  });
});

// test/orphan-cleanup.test.ts
describe('Orphan Cleanup Job', () => {
  it('should detect orphaned recordings older than 7 days', async () => {
    // Test detectOrphanedRecordings
  });

  it('should delete orphaned files from storage', async () => {
    // Test deleteOrphanedRecording
  });
});

// test/upload-retry.test.ts
describe('Upload Retry Service', () => {
  it('should log failed uploads', async () => {
    // Test logFailedUpload
  });

  it('should retry with exponential backoff', async () => {
    // Test retryFailedUpload
  });

  it('should mark resolved after success', async () => {
    // Test resolution marking
  });
});
```

### Integration Tests to Add
```typescript
// test/recording-e2e.test.ts
describe('Recording End-to-End', () => {
  it('should record inbound call and make available for playback', async () => {
    // 1. Make call
    // 2. Verify recording uploaded
    // 3. Verify URL works
    // 4. Verify playback
  });

  it('should handle failed uploads and retry', async () => {
    // 1. Simulate upload failure
    // 2. Verify logged for retry
    // 3. Verify retry succeeds
  });

  it('should broadcast recording_ready event', async () => {
    // 1. Make call
    // 2. Listen for WebSocket event
    // 3. Verify event contains correct data
  });
});
```

---

## Performance Testing

### Load Test Scenarios
```bash
# Test 1: 100 concurrent calls
k6 run tests/load/100-concurrent-calls.js

# Test 2: 1000 recording downloads
k6 run tests/load/1000-downloads.js

# Test 3: Recording upload under latency
k6 run tests/load/upload-with-latency.js

# Test 4: Signed URL generation at scale
k6 run tests/load/url-generation-scale.js
```

### Expected Performance Metrics
- Recording upload: < 30 seconds
- URL generation: < 100ms
- URL refresh: < 100ms
- Download logging: < 10ms (non-blocking)
- Orphan detection: < 5 minutes for 1000 orphans
- Retry job: < 2 minutes per failed upload

---

## Monitoring & Alerts

### Key Metrics to Track
```
- recording_upload_success_rate (target: 99.9%)
- recording_url_expiry_errors (target: 0)
- orphaned_recording_count (target: 0)
- average_recording_size (track for cost)
- recording_download_count (engagement metric)
- failed_upload_retry_count (reliability metric)
```

### Alerts to Configure
```
- Recording upload failure rate > 1%
- Orphaned recordings detected
- Failed upload retries exhausted
- Recording storage quota exceeded
- Signed URL generation failures
```

---

## Deployment Checklist

### Before Deploying to Production
- [ ] All database migrations applied
- [ ] Environment variables configured
- [ ] Supabase Storage bucket created
- [ ] Recording downloads table created
- [ ] Failed uploads table created
- [ ] Orphaned recordings table created
- [ ] All tests passing
- [ ] Load tests completed
- [ ] Monitoring configured
- [ ] Alerts configured

### Deployment Steps
1. [ ] Run database migrations
2. [ ] Deploy backend to Render
3. [ ] Verify health endpoint: `https://voxanne-backend.onrender.com/health`
4. [ ] Check logs for job scheduling messages
5. [ ] Make test call and verify recording
6. [ ] Monitor logs for 24 hours
7. [ ] Verify orphan cleanup runs at 2 AM UTC
8. [ ] Verify retry job runs every 5 minutes

### Rollback Plan
If issues occur:
1. [ ] Disable recording uploads (set recordingEnabled: false)
2. [ ] Disable retry job (comment out scheduleRecordingUploadRetry)
3. [ ] Disable orphan cleanup (comment out scheduleOrphanCleanup)
4. [ ] Revert to previous commit
5. [ ] Redeploy to Render

---

## Success Criteria

### Phase 1 is Complete When:
- ✅ All 10 manual tests pass
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Load tests show acceptable performance
- ✅ No errors in production logs for 24 hours
- ✅ Recording upload success rate > 99.9%
- ✅ Zero orphaned recordings
- ✅ All download attempts logged
- ✅ Retry job successfully recovers failed uploads
- ✅ Orphan cleanup runs daily without errors

---

## Next Steps (Phase 2)

After Phase 1 is verified:
- [ ] Implement audio file validation
- [ ] Add recording metrics to dashboard
- [ ] Implement WAV → MP3 conversion
- [ ] Add recording compression
- [ ] Implement recording search/filter
- [ ] Add call transcript search
- [ ] Implement recording analytics

---

## Support & Troubleshooting

### Common Issues

**Issue: Recording not appearing**
- Check: Is `recordingEnabled: true` in Vapi assistant?
- Check: Is Supabase Storage bucket accessible?
- Check: Are database columns created?
- Solution: Review backend logs for upload errors

**Issue: URL expiring too quickly**
- Check: Is `RECORDING_URL_EXPIRY_SECONDS` set to 3600?
- Check: Is refresh endpoint being called?
- Solution: Increase expiry or implement auto-refresh on frontend

**Issue: Orphan cleanup not running**
- Check: Is job scheduled on server startup?
- Check: Are database tables created?
- Solution: Manually trigger cleanup job or check server logs

**Issue: Upload retry not working**
- Check: Is retry job scheduled?
- Check: Is `failed_recording_uploads` table created?
- Solution: Check server logs for job errors

---

## References

- Senior Engineer Review: `/Users/mac/Desktop/VOXANNE  WEBSITE/CALL_RECORDING_SENIOR_REVIEW.md`
- Implementation Progress: `/Users/mac/Desktop/VOXANNE  WEBSITE/PHASE_1_IMPLEMENTATION_PROGRESS.md`
- Vapi API Docs: https://docs.vapi.ai/
- Supabase Storage: https://supabase.com/docs/guides/storage
