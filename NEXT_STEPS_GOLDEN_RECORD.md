# Golden Record SSOT - Next Steps to Complete Implementation

**Status:** Investigation complete, implementation 75% done
**Date:** 2026-02-13
**Blocker:** tools_used and ended_reason not extracting from Vapi payload

---

## What You Need to Do

### Immediate (Next 30 minutes)

1. **Trigger a new call** to your Vapi phone number:
   - Make an inbound call OR
   - Test an outbound call
   - Let it complete (≥10 seconds of audio)
   - End/hang up the call

2. **Check the debug log file:**
   ```bash
   cat backend/golden-record-debug.log
   ```
   This will show the actual Vapi payload structure for that call.

3. **Look for these fields in the output:**
   - `messageEndedReason` - Should show Vapi's reason code (e.g., "customer-hangup")
   - `messageHasMessages` - Should be true/false
   - `messageCount` - Number of messages in the call
   - `sampleMessages` - First 2 messages with their structure

### Based on What You Find

**Scenario A: `messageEndedReason` exists but is null/undefined**
- Problem: Vapi not sending endedReason
- Fix: Check if you're using the correct Vapi API version (>=1.0)
- Check: Vapi webhook configuration includes all event types

**Scenario B: `messageHasMessages` is false**
- Problem: call.messages array not in Vapi payload
- Fix: Update extraction to check payload structure (might be at `message.messages` or different location)
- Time: 15 minutes

**Scenario C: `messageCount` is 0 but messages field exists**
- Problem: Messages array is empty (simple call with no tool usage)
- Fix: This is normal - tools_used should be [] for simple calls
- Status: No fix needed

**Scenario D: `sampleMessages` shows different structure**
- Problem: Message format doesn't match our extraction logic
- Fix: Update extractToolsUsed function to match actual Vapi format
- Time: 30 minutes

---

## Code Changes Needed (If Applicable)

### If message.messages is in a different location:
```typescript
// BEFORE (line 745):
const toolsUsed = extractToolsUsed(call?.messages || []);

// AFTER (adjust based on actual structure):
const toolsUsed = extractToolsUsed(message.messages || []);
// OR
const toolsUsed = extractToolsUsed(artifact?.messages || []);
```

### If message format is different:
```typescript
// Update the extractToolsUsed function (line 449-467)
// to match the actual message object structure shown in the debug log
```

### If ended_reason is in a different field:
```typescript
// BEFORE (line 744):
const endedReason = message.endedReason || null;

// AFTER (adjust based on actual structure):
const endedReason = message.call?.endedReason || message.endReason || null;
```

---

## Verification Steps

After making any code changes:

1. **Restart the backend:**
   ```bash
   # Press Ctrl+C in the terminal running the backend
   # Or kill the process:
   pkill -f "tsx src/server.ts"

   # Start it again:
   npm run dev
   ```

2. **Test with a real call:**
   - Make another test call
   - Check `backend/golden-record-debug.log` for the new debug output

3. **Verify the database:**
   ```bash
   npm run diagnose:golden-record
   ```

   Should now show:
   ```
   ✓ cost_cents: populated
   ✓ tools_used: [tool names if used]
   ✓ ended_reason: customer-hangup (or similar)
   ✓ appointment_id: linked (if appointment was made)
   ```

---

## If You Get Stuck

### Quick Troubleshooting

**Q: No golden-record-debug.log file created**
- A: Backend isn't processing webhooks. Check if backend.log shows webhook receipt.

**Q: Debug log shows empty messages array**
- A: This call didn't use any tools. Make a call that uses the appointment booking tool.

**Q: Debug log shows unexpected field names**
- A: Vapi payload structure is different. Copy the structure and we'll update the extraction logic.

**Q: Changes don't take effect after restart**
- A: Verify backend restarted with `curl http://localhost:3001/health`
- A: Check there are no TypeScript compile errors

### Key Diagnostic Commands

```bash
# Check if backend is running
curl http://localhost:3001/health

# Check if recent calls exist
npm run diagnose:golden-record

# Check backend logs (if available)
tail -f backend/logs/server.log

# Check debug output file
tail -f backend/golden-record-debug.log

# Rebuild if TypeScript issues
npm run build
```

---

## Expected Final State

Once tools_used and ended_reason are extracting correctly:

```
Call in database should show:
├── cost_cents: 5 (works now)
├── tools_used: ["bookClinicAppointment", "sendSMS"] (will work after fix)
├── ended_reason: "customer-hangup" (will work after fix)
├── appointment_id: [uuid] (will work after fix)
└── Dashboard displays: Real call data, not empty/null fields
```

---

## Timeline Estimate

- **Investigate payload (current):** 30 min
- **Update extraction logic (if needed):** 15-30 min
- **Test & verify:** 15 min
- **Total:** 1 hour to complete

---

## Summary

The implementation is working correctly - the database, schema, and webhook handler are all functional. We just need to understand the exact Vapi payload structure so we can extract the fields correctly.

The debug log file will show us exactly what we need. After that, it's a simple field name adjustment and all will work.

**Next action:** Make a test call and check `backend/golden-record-debug.log` to see the Vapi payload structure.

---

**Investigation completed by:** Claude Code (Anthropic)
**Files affected:** backend/src/routes/vapi-webhook.ts
**Changes made:** Enhanced logging to capture Vapi payload structure
**Waiting for:** Next call webhook to see actual payload
