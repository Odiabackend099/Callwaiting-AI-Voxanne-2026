# Agent CRUD - Quick Test Reference

**Quick validation for agent naming and deletion features**

---

## 5-Minute Smoke Test

### 1. Create/Name Agent
```
1. Navigate to Dashboard → Agent Configuration
2. Go to Inbound tab
3. Enter name: "Test Receptionist"
4. Fill in:
   - System Prompt: "You are a helpful receptionist"
   - First Message: "Hello, how can I help?"
   - Voice: Select any voice
   - Language: English (US)
   - Max Duration: 600 seconds
5. Click "Save Changes"
6. Verify: Button shows "Saved" checkmark
7. Reload page
8. Verify: Name "Test Receptionist" still appears
```

### 2. Update Agent Name
```
1. Change name to "Front Desk Assistant"
2. Click "Save Changes"
3. Verify: Name updated in system
4. Check VAPI dashboard
5. Verify: Assistant name updated there too
```

### 3. Delete Agent
```
1. Click "Delete Agent" button (bottom right)
2. Verify: Red confirmation modal appears
3. Review modal content:
   - ✓ "What will be deleted" section
   - ✓ "What will be preserved" section
4. Click "Cancel"
5. Verify: Modal closes, agent still exists
6. Click "Delete Agent" again
7. This time, click "Delete Agent" in modal
8. Verify: Agent removed from UI
9. Reload page
10. Verify: Agent still deleted (not restored)
```

### 4. Verify VAPI Cleanup
```
1. Go to VAPI dashboard
2. Verify: Deleted assistant no longer appears in list
3. Check phone numbers
4. Verify: Phone number is unassigned (if was assigned)
```

---

## API Testing (cURL)

### Create/Update Agent with Name
```bash
curl -X POST https://api.yourdomain.com/api/founder-console/agent/behavior \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "name": "Receptionist Robin",
      "systemPrompt": "You are a helpful receptionist",
      "firstMessage": "Hello, how can I help?",
      "voiceId": "en-US-JennyNeural",
      "language": "en",
      "maxDurationSeconds": 600
    }
  }'

# Expected response:
# { "success": true, ... }
```

### Get Agent Config (includes name)
```bash
curl https://api.yourdomain.com/api/founder-console/agent/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
# {
#   "inbound": {
#     "name": "Receptionist Robin",
#     "systemPrompt": "...",
#     ...
#   }
# }
```

### Delete Agent
```bash
curl -X DELETE https://api.yourdomain.com/api/founder-console/agent/inbound \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response (success):
# { "success": true, "message": "Inbound agent deleted successfully" }

# Expected response (active calls):
# { "error": "Cannot delete agent with active calls..." }
```

---

## Database Verification

### Check Agent Name
```sql
SELECT id, role, name, system_prompt
FROM agents
WHERE org_id = 'YOUR_ORG_ID';

-- Should show: Receptionist Robin | Inbound Agent
```

### Verify Deletion
```sql
SELECT COUNT(*) FROM agents
WHERE org_id = 'YOUR_ORG_ID' AND role = 'inbound';

-- Should be 0 after deletion
```

### Check Audit Log
```sql
SELECT * FROM audit_logs
WHERE action = 'agent.deleted'
ORDER BY created_at DESC
LIMIT 1;

-- Should show: deletion event with full details
```

### Verify Phone Number Unassigned
```sql
SELECT phone_number_id, assistant_id
FROM vapi_phone_numbers
WHERE phone_number_id = 'YOUR_PHONE_ID';

-- Should show: assistant_id = NULL after deletion
```

---

## Common Issues & Solutions

### Issue: Delete button not showing
**Cause:** Agent doesn't exist yet
**Solution:** Create agent first, then delete button appears

### Issue: Name not saving
**Cause:** Name validation error (too long, special chars)
**Solution:**
- Max 100 characters
- No special characters needed
- Use simple names like "Receptionist Robin"

### Issue: Delete blocked with "active calls" error
**Cause:** There's an active call in the system
**Solution:**
- Wait for call to complete
- Or check call_logs table for orphaned calls
- Mark call as completed if stuck

### Issue: Name not updating in VAPI
**Cause:** VAPI API timeout or network issue
**Solution:**
- Check Sentry error logs
- Retry save operation
- Contact support if persists

### Issue: Agent deleted but appears in VAPI
**Cause:** VAPI API was unreachable during deletion
**Solution:**
- Delete manually in VAPI dashboard
- Check error logs for details

---

## Success Criteria Checklist

- [ ] Name field appears in UI
- [ ] Can create agent with custom name
- [ ] Name persists after reload
- [ ] Name updates when changed
- [ ] Name syncs to VAPI dashboard
- [ ] Delete button appears for existing agents
- [ ] Delete button hidden for new agents
- [ ] Confirmation modal shows on delete click
- [ ] Cancel closes modal without deleting
- [ ] Delete removes agent from database
- [ ] Delete removes agent from VAPI
- [ ] Phone number unassigned on delete
- [ ] Audit log shows deletion event
- [ ] Rate limiting works (10 deletes/hour)
- [ ] Multi-tenant isolation maintained
- [ ] No regressions in other features

---

## Monitoring After Deployment

### Error Logs (Sentry)
```
Monitor for:
- "Failed to delete assistant" errors
- "Cannot delete agent with active calls" (expected behavior)
- "Too many agent deletions" (rate limiting - expected)
```

### Database Audit
```sql
-- Daily: Check deletion audit trail
SELECT COUNT(*) FROM audit_logs
WHERE action = 'agent.deleted'
AND created_at > NOW() - INTERVAL '24 hours';

-- Monthly: Cleanup test data
DELETE FROM agents
WHERE name LIKE 'Test%'
AND created_at < NOW() - INTERVAL '30 days';
```

### User Feedback
- Monitor support channels for deletion-related issues
- Track successful delete operations
- Note any "agent stuck in VAPI" reports

---

## Rollback Checklist (if needed)

If major issues discovered:

1. **Frontend Rollback** (2 min)
   ```bash
   vercel rollback
   # OR
   git revert <commit> && git push
   ```

2. **Backend Rollback** (5 min)
   ```bash
   git revert <commit> && git push
   # Automatic re-deployment via GitHub Actions
   ```

3. **Database Rollback** (not needed)
   - Migration only adds data, doesn't remove
   - Can be left in place

4. **Verify Rollback** (5 min)
   - Test agent creation
   - Verify delete button gone
   - Check Sentry for errors

---

## Performance Benchmarks

Expected operation times:

| Operation | Expected Time | Maximum Time |
|-----------|---------------|--------------|
| Create agent | <500ms | 2s |
| Update name | <500ms | 2s |
| Delete agent | <2s | 10s |
| Load agent config | <500ms | 2s |
| Rate limit check | <50ms | 100ms |

If operations exceed maximum time, investigate database performance.

---

## Production Rollout Plan

**Recommended Timeline:**

- **Day 1:** Deploy to staging, run full test suite
- **Day 2:** Internal testing with team
- **Day 3:** Gradual rollout to 10% of customers
- **Day 4:** Rollout to 50% of customers
- **Day 5:** Full rollout to 100% (if no issues)

**Monitoring During Rollout:**
- Error rate should stay <0.1%
- Delete operation latency <2s P99
- No increase in support tickets
- No database performance degradation

---

## Questions or Issues?

See main implementation guide: `AGENT_CRUD_IMPLEMENTATION_COMPLETE.md`
