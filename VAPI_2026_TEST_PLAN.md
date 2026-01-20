# TEST PLAN - Vapi 2026 Voice Migration

## Status
✅ All code changes deployed  
✅ Backend restarted with new VOICE_REGISTRY (3 active voices only)  
✅ Frontend updated with new VOICE_MANIFEST (3 active voices only)  
✅ Database migration completed (legacy voice remapping)  
✅ Environment variable updated (VAPI_DEFAULT_VOICE=Rohan)  

---

## Pre-Test Verification

### Backend Health
- Port: 3001
- Status: Running with new code
- VOICE_REGISTRY: Rohan, Elliot, Savannah (3 voices)
- DEFAULT_VOICE: Rohan
- Environment: VAPI_DEFAULT_VOICE=Rohan

**Verify**: 
```bash
curl http://localhost:3001/api/founder-console/voices
# Expected: { "voices": [{ "id": "Rohan", ... }, { "id": "Elliot", ... }, { "id": "Savannah", ... }] }
```

### Frontend Health
- Port: 3000
- Status: Running
- VOICE_MANIFEST: Rohan, Elliot, Savannah (3 voices only in dropdown)
- DEFAULT: Rohan

**Verify**: 
```bash
# Browser DevTools → Network tab → when /api/founder-console/voices loads
# Should show only 3 voices in dropdown
```

---

## Test Scenarios

### CRITICAL TEST: Agent Save with Active Voices

**Scenario 1: Save agent with Rohan voice**
1. Go to http://localhost:3000/dashboard/settings (or agent settings page)
2. Select voice dropdown
3. Choose "Rohan (Professional)"
4. Fill other required fields (system prompt, language, etc.)
5. Click "Save Agent"
6. **Expected Result**: ✅ Agent saves successfully (HTTP 200)
7. **Backend Log Check**: Look for:
   ```
   POST /api/founder-console/agent/behavior
   "voice": "Rohan"
   [CREATE payload being sent to VAPI]
   "voiceId": "Rohan"
   ```
8. **Bad Result** ❌ If you see: `"The Rohan voice is part of a legacy voice set..."` → Backend NOT restarted with new code

**Scenario 2: Save agent with Elliot voice**
1. Change dropdown to "Elliot (Calm)"
2. Click Save
3. **Expected**: ✅ Success
4. **Log should show**: `"voiceId": "Elliot"`

**Scenario 3: Save agent with Savannah voice**
1. Change dropdown to "Savannah (Friendly)"
2. Click Save
3. **Expected**: ✅ Success
4. **Log should show**: `"voiceId": "Savannah"`

---

## Regression Tests

### Old/Legacy Voices Should NOT Appear
**Scenario 4: Verify frontend dropdown doesn't show legacy voices**
1. Open voice dropdown on agent settings
2. Look for: Neha, Paige, Harry, Hana, Lily, Cole, Spencer, Leo, Dan, etc.
3. **Expected**: ❌ None of these should appear
4. **Bad Result** ✅ If old voices appear → frontend not reloaded with new VOICE_MANIFEST

### Legacy Voice in Database Should Auto-Convert
**Scenario 5: Load existing agent with legacy voice (if one exists)**
1. Open existing agent from database
2. Agent shows voice as something like "Harry" or "Neha"
3. Click Save again
4. **Expected**: Backend converts to active voice via convertToVapiVoiceId()
5. **Backend Log Check**:
   ```
   "voice": "Harry" → converts to "Rohan"
   "voice": "Neha" → converts to "Savannah"
   ```

---

## Success Criteria (All Must Pass ✅)

1. ✅ Frontend dropdown shows ONLY 3 voices (Rohan, Elliot, Savannah)
2. ✅ Saving with any of 3 voices succeeds (HTTP 200)
3. ✅ NO "legacy voice set" errors from Vapi API
4. ✅ Backend logs show correct active voice being sent to Vapi
5. ✅ Default voice selected is "Rohan" (not "Neha")
6. ✅ Old voices not in dropdown (regression check)

---

## Failure Troubleshooting

### If Test Fails with "legacy voice set" error:
**Diagnosis**: Backend wasn't restarted

**Fix**:
```bash
pkill -f "tsx src/server.ts"  # Kill old process
cd backend && npm run dev      # Start with new code
```

**Verify**:
```bash
# Backend logs should show:
# VOICE_REGISTRY = [3 voices]
# DEFAULT_VOICE = 'Rohan'
```

### If Frontend still shows 19 voices:
**Diagnosis**: Frontend not reloaded

**Fix**:
```bash
# Hard refresh in browser
Cmd+Shift+R (Mac)  or  Ctrl+Shift+R (Windows)
```

### If agent save returns HTTP 500:
**Diagnosis**: Likely still getting Vapi 400 error

**Check Backend Logs**:
```
[ERROR] [VapiClient] Vapi request failed {"route":"POST /assistant","error":"Request failed with status code 400",...}
```

**If error message mentions voice deprecation**:
- Backend process hasn't been restarted with new VOICE_REGISTRY
- Kill and restart backend

---

## Performance Expectations

- **Agent Save Time**: Should be <5 seconds
- **Vapi API Response**: <2 seconds
- **No timeout errors**: All requests complete
- **Memory**: No memory leaks (monitor backend process)

---

## Post-Test Actions

### If All Tests Pass ✅
1. Document test results
2. Deploy to production
3. Monitor Supabase logs for any errors
4. Check Vapi webhook events for new assistants
5. Announce voice migration to clinic staff

### If Tests Fail ❌
1. Check specific error message
2. Follow troubleshooting steps above
3. Verify file contents were actually saved:
   ```bash
   grep -n "const DEFAULT_VOICE" backend/src/routes/founder-console-v2.ts  # Should show 'Rohan'
   grep -n "voiceId:" backend/src/services/vapi-client.ts  # Should show 'Rohan' fallback
   grep VOICE_MANIFEST src/lib/voice-manifest.ts | head  # Should show only 3 voices
   ```

---

## Browser Console Cleanup

Before testing, clear browser cache to ensure new frontend code loads:

1. Open DevTools (F12)
2. Settings → Clear site data
3. Hard refresh (Cmd+Shift+R)
4. Verify in Network tab that voice-manifest is loaded from src/ (not cached)

---

## Timeline

- **Current**: All changes deployed, both servers running
- **Next 5 min**: Run Test Scenarios 1-3 (active voice saves)
- **Next 10 min**: Run Regression Tests 4-5 (frontend/legacy checks)
- **Decision Point**: All pass? → Ready for production

---

**Test Date**: January 20, 2026  
**Prepared By**: Copilot  
**Status**: READY FOR EXECUTION
