# 📋 VERIFICATION PLAN INDEX - Quick Reference

**Status**: 🟢 Ready to execute  
**Last Updated**: 2026-01-18  
**Deployment Phase**: Path A (Go-Live Today)

---

## 🎯 What to Verify Before Deployment

You need to verify THREE things before deploying booking to production:

1. **Automated Tests** - Run curl commands to test backend
2. **Vapi Integration** - Verify AI tool is correctly configured
3. **Manual Tests** - Make a real call to verify end-to-end flow

---

## 📚 Verification Documents

### Document 1: VERIFICATION_PLAN_AUTOMATED_MANUAL.md
**Purpose**: Complete automated & manual testing guide  
**Contains**: 7 curl tests, manual verification steps, troubleshooting  
**Time**: 15-20 minutes to complete  
**Key Sections**:
- ✅ Test 1: Backend health check
- ✅ Test 2: Valid booking request
- ✅ Test 3: Duplicate prevention (most important)
- ✅ Test 4: Invalid email handling
- ✅ Test 5: Multi-tenant isolation
- ✅ Test 6: Data normalization
- ✅ Test 7: Database verification
- ✅ Manual: Live call test
- ✅ Troubleshooting guide

**How to Use**:
```bash
# Option A: Read the full guide
less VERIFICATION_PLAN_AUTOMATED_MANUAL.md

# Option B: Run automated test script
./verify_booking_system.sh

# Option C: Manual - copy/paste individual curl commands
```

---

### Document 2: VAPI_INTEGRATION_VERIFICATION.md
**Purpose**: Verify Vapi assistant is correctly configured  
**Contains**: 7-part verification flow for Vapi setup  
**Time**: 10-15 minutes to complete  
**Key Sections**:
- ✅ Get Vapi assistant ID
- ✅ Verify tool is registered
- ✅ Verify tool server endpoint
- ✅ Test tool execution during call
- ✅ Verify authentication & security
- ✅ Troubleshooting common Vapi issues
- ✅ Performance monitoring

**How to Use**:
```bash
# Get your Vapi API key
export VAPI_API_KEY="your-key-here"

# Follow the curl commands in the guide to verify each component
```

---

### Document 3: verify_booking_system.sh (Executable Script)
**Purpose**: Automated verification suite  
**Run Time**: ~2 minutes  
**Exit Code**: 
- 0 = All tests passed ✅
- 1 = Some tests failed ❌

**Usage**:
```bash
# Make it executable (already done)
chmod +x verify_booking_system.sh

# Run it
./verify_booking_system.sh

# Run against different backend URL
./verify_booking_system.sh http://production.example.com:3001
```

**What It Tests**:
1. Backend health check
2. Valid booking request
3. Duplicate slot prevention (advisory locks)
4. Invalid email handling
5. Data normalization
6. Response time performance

---

## 🚀 Quick Verification Workflow

### Timeline: ~30 minutes total

```
Start
  │
  ├─ (2 min) Run automated script
  │   ./verify_booking_system.sh
  │   └─ If fails: Debug and fix, rerun
  │
  ├─ (5 min) Verify Vapi configuration
  │   - Get assistant ID
  │   - Confirm tool registered
  │   - Test endpoint reachability
  │
  ├─ (10 min) Make live test call
  │   - Call your AI phone number
  │   - Request booking
  │   - Verify in database
  │
  ├─ (3 min) Test duplicate prevention
  │   - Call again for same slot
  │   - Verify rejection
  │
  ├─ (5 min) Review logs
  │   - Backend logs clean
  │   - No errors
  │   - All timestamps correct
  │
  └─ (5 min) Final sign-off
      All checks pass → Ready to deploy ✅
```

---

## ✅ Pre-Deployment Checklist

Use this checklist before deploying:

### Automated Tests
- [ ] Run `./verify_booking_system.sh` - all pass
- [ ] Backend responds to health check
- [ ] Valid booking creates record
- [ ] Duplicate booking rejected
- [ ] Invalid email handled
- [ ] Data normalization working
- [ ] Response time < 300ms

### Vapi Integration
- [ ] Vapi assistant exists and is active
- [ ] bookClinicAppointment tool registered
- [ ] All 5 parameters defined correctly
- [ ] Vapi can reach your backend (HTTPS)
- [ ] JWT validation active
- [ ] Tool test call succeeds

### Manual Verification
- [ ] Make test call to your clinic number
- [ ] AI responds and asks for details
- [ ] After confirming, booking appears in database
- [ ] All fields normalized (name: title case, email: lowercase, phone: +1 format)
- [ ] Call again for same time → rejected
- [ ] Backend logs show success

### System Health
- [ ] No errors in backend logs
- [ ] Database connections working
- [ ] All timestamps in correct timezone
- [ ] No partial/orphaned records
- [ ] Multi-tenant isolation verified

---

## 🔍 Debugging Flows

### If Automated Tests Fail

1. **"Test returns 404 Not Found"**
   ```bash
   # Backend not running
   cd backend && npm run dev
   ```

2. **"Booking succeeds but doesn't appear in database"**
   ```bash
   # Check database connection
   echo $SUPABASE_SERVICE_ROLE_KEY
   # Should not be empty
   
   # Verify env var is set
   psql "postgresql://..." -c "SELECT 1"
   ```

3. **"Duplicate prevention NOT working"**
   ```bash
   # CRITICAL ISSUE - Check advisory locks
   psql -c "SELECT routine_definition FROM information_schema.routines 
     WHERE routine_name='book_appointment_atomic'" | grep "pg_advisory"
   
   # If empty: Advisory locks are MISSING - don't deploy
   ```

### If Vapi Tests Fail

1. **"Tool not found"**
   ```bash
   # Register tool in Vapi dashboard
   # Or contact Vapi support
   ```

2. **"Tool times out"**
   ```bash
   # Increase timeout or check network latency
   ping your-backend.com
   ```

3. **"Assistant doesn't call tool"**
   ```bash
   # Update system prompt to instruct tool usage
   # Or check model supports function calling (gpt-4)
   ```

### If Manual Call Fails

1. **"AI doesn't respond"**
   - Check Vapi assistant is active
   - Verify phone number is correct
   - Check logs for errors

2. **"Booking not created"**
   - Check backend is running
   - Check SUPABASE_SERVICE_ROLE_KEY is set
   - Check database is accessible

3. **"Booking appears but fields are wrong"**
   - Check normalization function is called
   - Verify data transformation logic
   - Review database schema

---

## 📊 Success Metrics

After deployment, monitor these for 24 hours:

| Metric | Target | How to Check |
|--------|--------|--------------|
| API Response Time | <300ms | Backend logs or Sentry APM |
| Booking Success Rate | >99% | Count database records |
| Double-Booking Rate | 0% | Query for duplicate slots |
| Data Accuracy | 100% | Review dashboard entries |
| Error Rate | <1% | Check logs for exceptions |
| Uptime | 100% | Health check endpoint |

---

## 🎬 Next Steps After Verification Passes

1. **Distribute Staff SOP** - Share STAFF_SOP_PHASE_1_GO_LIVE.md with clinic team
2. **Deploy to Production** - Push code to production environment
3. **Monitor First Hour** - Watch logs and database continuously
4. **Announce to Clinic** - "AI booking is now live!"
5. **Collect Feedback** - Note any issues for Phase 2 improvements
6. **Plan Phase 2** - SMS automation (this week)

---

## 📖 Document Quick Links

| Document | Purpose | Read Time |
|----------|---------|-----------|
| VERIFICATION_PLAN_AUTOMATED_MANUAL.md | Full testing guide with curl commands | 15 min |
| VAPI_INTEGRATION_VERIFICATION.md | Vapi configuration verification | 10 min |
| verify_booking_system.sh | Automated test script | 2 min to run |
| STAFF_SOP_PHASE_1_GO_LIVE.md | Staff procedures during Phase 1 | 10 min |
| DEPLOYMENT_DECISION_TREE.md | Path A vs Path B comparison | 5 min |
| COMPLETE_HONESTY_REPORT.md | What IS/ISN'T done in detail | 20 min |

---

## ⚡ TL;DR - Quick Start

```bash
# 1. Run automated tests (2 min)
./verify_booking_system.sh

# 2. Make a test call (5 min)
# Call your clinic AI number, request booking

# 3. Verify in database (2 min)
psql "postgresql://..." -c "SELECT * FROM appointments ORDER BY created_at DESC LIMIT 1"

# All pass? ✅ Deployment approved
# Any fail? ❌ Fix issues and retest
```

---

## 🆘 Getting Help

**Backend Issues**:
- Check logs: `tail -f /var/log/backend.log`
- Health check: `curl http://localhost:3001/health`
- Database: Verify SUPABASE_SERVICE_ROLE_KEY is set

**Vapi Issues**:
- Check logs: Vapi dashboard → Logs
- Test tool: Use Vapi API test endpoint
- Contact Vapi support if tool not found

**Database Issues**:
- Test connection: `psql "postgresql://..."`
- Check advisory locks: `SELECT * FROM pg_locks`
- Review RLS policies: Supabase dashboard

---

**Ready to verify?** Start with: `./verify_booking_system.sh`

✅ When all tests pass → You're cleared for deployment!
