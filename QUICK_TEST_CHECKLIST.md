# ⚡ Quick Test Checklist (6 Minutes)

## Setup (1 min)
```bash
cd backend && pm2 restart all
```
Wait for: `[PM2] [voxanne-backend](0) ✓`

---

## Test 1: Browser Test - Inbound Agent (3 min)

1. Open: `http://localhost:3000/dashboard/agent-config`
2. Login: `voxanne@demo.com` / `demo123`
3. Click: **"Test in Browser"**
4. Listen: Should be **MALE voice (Rohan)** + **Medspa message**

**✅ PASS:** Male voice, Medspa message
**❌ FAIL:** Female voice, generic message

### Check Logs:
```bash
cd backend && tail -100 logs/*.log | grep "org_id" | tail -5
```
Expected: `"org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"`

---

## Test 2: Live Call Test - Outbound Agent (3 min)

1. Open: `http://localhost:3000/dashboard/outbound-config`
2. Click: **"Test Live Call"**
3. Enter: Your test phone number
4. Answer: The call that comes in
5. Listen: Voice should match outbound config

**✅ PASS:** Call connects, voice matches config
**❌ FAIL:** Call fails or wrong voice

### Check Logs:
```bash
cd backend && tail -100 logs/*.log | grep "Live Call Test" | tail -10
```
Expected: `"org_id": "46cf2995..."`, `"agent_role": "outbound"`

---

## Quick Debugging

**Cache issue?**
```bash
# Open browser DevTools → Application → Clear Storage → Clear All
```

**Backend not restarted?**
```bash
ps aux | grep tsx | grep server.ts
# Should show recent process (started within last 5 minutes)
```

**Database issue?**
```bash
cd backend && npx tsx -e "
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: inbound } = await supabase.from('agents').select('voice').eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e').eq('role', 'inbound').single();
  const { data: outbound } = await supabase.from('agents').select('voice').eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e').eq('role', 'outbound').single();
  console.log('Inbound voice:', inbound?.voice || 'NOT FOUND');
  console.log('Outbound voice:', outbound?.voice || 'NOT FOUND');
})();
"
```

---

## Success Criteria (All 8 Must Pass)

### Inbound Agent
- [ ] Browser test plays male (Rohan) voice
- [ ] Browser test speaks Medspa first message
- [ ] Logs show correct org_id (`46cf2995...`)
- [ ] No backend errors

### Outbound Agent
- [ ] Live call connects to test phone
- [ ] Voice matches outbound configuration
- [ ] First message matches outbound config
- [ ] Logs show correct org_id (`46cf2995...`)

**All checked?** ✅ Both agents working correctly!

---

## Report Results

Post results in this format:

```
INBOUND TEST: ✅ PASS / ❌ FAIL
- Voice: [male/female]
- Message: [Medspa/generic]
- Org ID: [paste from logs]

OUTBOUND TEST: ✅ PASS / ❌ FAIL
- Connected: [yes/no]
- Voice: [describe]
- Org ID: [paste from logs]

OVERALL: ✅ / ❌
```

---

**Full Documentation:** See `TESTING_INSTRUCTIONS_BOTH_AGENTS.md`
