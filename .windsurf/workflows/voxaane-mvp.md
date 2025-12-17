# 🎯 VOXANNE MVP - FEATURES FOR FIRST USER

## MISSION
Get Voxanne ready for the FIRST PAYING CUSTOMER. No extra features, no nice-to-haves. Only what's CRITICAL for a clinic owner to use the product and pay for it.

---

## ✅ FEATURES THAT MUST WORK (NON-NEGOTIABLE)

### **FEATURE 1: INBOUND CALL HANDLING** 🔴 CRITICAL
**What it does:** When someone calls the clinic's phone number, Voxanne answers and handles the conversation.

**Requirements:**
- [ ] UK phone number connected to Vapi
- [ ] Voxanne answers in <1 second
- [ ] Natural British voice (no robotic sound)
- [ ] Can handle these call types:
  - [ ] General inquiry ("What services do you offer?")
  - [ ] Pricing question ("How much is a BBL?")
  - [ ] Booking request ("I want to book a consultation")
  - [ ] Emergency ("I had surgery 3 days ago and...")

**Test:** Call the number 10 times with different scenarios. All 10 must work perfectly.

**Files to check:**
- `backend/src/routes/webhooks.ts` - Receives call events from Vapi
- `backend/src/services/vapi-client.ts` - Vapi integration
- Database: `call_tracking`, `call_logs` tables

---

### **FEATURE 2: CALL RECORDING & STORAGE** 🔴 CRITICAL
**What it does:** Every call is recorded and saved. Business owner can listen to it later.

**Requirements:**
- [ ] Recording captured automatically
- [ ] Recording URL saved to database (`call_logs.recording_url`)
- [ ] Recording accessible via API (`GET /api/calls/:id/recording`)
- [ ] Recording plays in dashboard (audio player)
- [ ] Recording downloadable as MP3

**Test:** Make 5 calls. All 5 recordings must be playable and downloadable.

**Files to check:**
- `backend/src/routes/webhooks.ts` - Saves recording URL when Vapi sends it
- Database: `call_logs.recording_url` column must exist
- Frontend: Audio player component exists

---

### **FEATURE 3: LIVE TRANSCRIPT** 🔴 CRITICAL
**What it does:** As call happens, transcript appears in real-time. After call, full transcript is saved.

**Requirements:**
- [ ] Transcript arrives via WebSocket during call
- [ ] Transcript displays in dashboard with speaker labels (Sarah vs Caller)
- [ ] Transcript saved to database (`call_transcripts` table)
- [ ] Transcript readable after call ends
- [ ] Transcript searchable (Ctrl+F works)
- [ ] Transcript exportable (TXT format)

**Test:** Make a call. Watch transcript appear word-by-word in dashboard. Verify saved correctly after.

**Files to check:**
- `backend/src/routes/webhooks.ts` - Broadcasts transcript events
- `backend/src/services/websocket.ts` - WebSocket server
- `src/hooks/useVoiceAgent.ts` - WebSocket client
- Database: `call_transcripts` table

---

### **FEATURE 4: CALL LOG DASHBOARD** 🔴 CRITICAL
**What it does:** Business owner sees list of all inbound calls in one page.

**Requirements:**
- [ ] Shows last 100 calls
- [ ] Displays: phone number, duration, timestamp, outcome
- [ ] Click "Play" button → recording plays
- [ ] Click "View Transcript" → full transcript appears
- [ ] Filter by date (today, this week, this month)
- [ ] Shows call status (completed, in-progress, missed)
- [ ] Auto-refreshes when new call comes in

**Test:** Make 5 calls. All 5 appear in dashboard immediately. Click each one, verify all data correct.

**Files to check:**
- `src/app/dashboard/calls/page.tsx` - Call log UI
- `backend/src/routes/calls.ts` - API to fetch calls
- Database query: `SELECT * FROM call_logs ORDER BY created_at DESC`

---

### **FEATURE 5: KNOWLEDGE BASE (RAG)** 🔴 CRITICAL
**What it does:** Sarah answers questions using uploaded documents (pricing, services, FAQs) instead of making things up.

**Requirements:**
- [ ] Upload document via dashboard (TXT, MD, PDF)
- [ ] Document gets chunked into smaller pieces
- [ ] Chunks get embedded (vector embeddings)
- [ ] When call asks question, Sarah searches KB and uses relevant chunks
- [ ] Answers match uploaded content (not generic AI responses)

**Test:** 
1. Upload document with fake pricing: "BBL costs £99,999"
2. Call and ask: "How much is a BBL?"
3. Sarah MUST say "£99,999" (proving she used KB)

**Files to check:**
- `src/app/dashboard/knowledge-base/page.tsx` - Upload UI
- `backend/src/routes/knowledge-base-rag.ts` - Chunking & embeddings
- `backend/src/routes/vapi-webhook.ts` - RAG retrieval during call
- Database: `knowledge_base`, `knowledge_base_chunks` tables

---

### **FEATURE 6: AGENT CONFIGURATION** 🟡 HIGH PRIORITY
**What it does:** Business owner customizes what Sarah says (greeting, personality, voice).

**Requirements:**
- [ ] Edit "First Message" (what Sarah says when answering)
- [ ] Edit "System Prompt" (Sarah's personality and instructions)
- [ ] Select voice (British Female, British Male, etc.)
- [ ] Changes sync to Vapi automatically (no manual Vapi login)
- [ ] Changes take effect on next call (no delay)

**Test:** 
1. Change first message to: "Hello, this is TESTBOT speaking"
2. Call the number
3. Verify Sarah says "TESTBOT" (not old greeting)

**Files to check:**
- `src/app/dashboard/settings/page.tsx` - Config UI
- `backend/src/routes/founder-console.ts` - Saves settings
- `backend/src/services/vapi-webhook-configurator.ts` - Syncs to Vapi

---

### **FEATURE 7: SAFE MODE (COMPLIANCE)** 🔴 CRITICAL
**What it does:** Sarah NEVER gives medical advice. If asked medical question, she escalates to human.

**Requirements:**
- [ ] Medical keywords detected: "diagnosis", "treatment", "should I", "is this normal"
- [ ] Response: "That's a great question for our clinical team. Let me connect you."
- [ ] Call transferred to clinic staff (or voicemail if after hours)
- [ ] Zero medical advice incidents (verified in logs)

**Test:** 
1. Call and ask: "Is my swelling normal after surgery?"
2. Sarah MUST NOT answer medically
3. Sarah MUST escalate or take message

**Files to check:**
- System prompt contains: "NEVER provide medical advice"
- `backend/src/routes/webhooks.ts` - Logs all escalations
- Audit log: Check for any medical advice attempts

---

### **FEATURE 8: REAL-TIME DASHBOARD UPDATES** 🟡 HIGH PRIORITY
**What it does:** When call happens, dashboard updates immediately (no refresh needed).

**Requirements:**
- [ ] WebSocket connection active (indicator shows "🟢 Live")
- [ ] New call appears in call list within 2 seconds
- [ ] Call status updates in real-time (ringing → in-progress → completed)
- [ ] Transcript updates as caller speaks
- [ ] If WebSocket disconnects, reconnects automatically

**Test:** 
1. Open dashboard
2. Make a call from different phone
3. Watch dashboard update without clicking refresh

**Files to check:**
- `src/lib/websocket-client.ts` - WebSocket hook with auto-reconnect
- `backend/src/services/websocket.ts` - Broadcasts events
- Frontend: Check "🟢 Live" indicator appears

---

### **FEATURE 9: AUTHENTICATION & SECURITY** 🔴 CRITICAL
**What it does:** Only authorized users can access dashboard. No data leakage.

**Requirements:**
- [ ] Login page works (email + password)
- [ ] JWT token stored securely
- [ ] Token expires after 24 hours
- [ ] Logout works (clears session)
- [ ] Protected routes redirect to login if not authenticated
- [ ] User can only see THEIR calls (not other users' calls)
- [ ] API endpoints require valid auth token (401 if missing)

**Test:** 
1. Logout
2. Try accessing /dashboard/calls directly
3. Should redirect to /login (not show data)

**Files to check:**
- `src/app/(auth)/login/page.tsx` - Login UI
- `src/contexts/AuthContext.tsx` - Auth state management
- `backend/src/middleware/auth.ts` - Token verification

---

### **FEATURE 10: PRODUCTION DEPLOYMENT** 🔴 CRITICAL
**What it does:** System runs on stable public URLs (not localhost or ngrok).

**Requirements:**
- [ ] Backend deployed to Render/Railway
- [ ] Frontend deployed to Vercel
- [ ] Database is Supabase (already cloud-hosted)
- [ ] Backend URL: `https://voxanne-backend.onrender.com` (or similar)
- [ ] Frontend URL: `https://callwaitingai.dev` (custom domain)
- [ ] Environment variables set correctly
- [ ] Health check endpoint returns 200 OK
- [ ] Webhooks hit production URL (not localhost)
- [ ] System stable for 24 hours (no crashes)

**Test:** 
1. Open `https://callwaitingai.dev` in browser
2. Login
3. Make inbound call
4. Verify everything works end-to-end

**Files to check:**
- `render.yaml` - Render deployment config
- `vercel.json` - Vercel deployment config
- `.env.production` - Production environment variables

---

## 🚫 FEATURES THAT ARE **NOT** NEEDED FOR MVP

These can wait until AFTER first customer:

❌ Outbound calling (AI makes calls)  
❌ SMS/WhatsApp integration  
❌ CRM integration (Salesforce, HubSpot)  
❌ Multi-language support  
❌ Custom voice cloning  
❌ Call analytics dashboard (detailed metrics)  
❌ A/B testing different scripts  
❌ Payment processing  
❌ Multi-user accounts (team access)  
❌ Mobile app (iOS/Android)  
❌ Call scheduling  
❌ Voicemail transcription  
❌ Sentiment analysis  

**Reason:** These add complexity without proving core value. Get first customer first, then add features based on what they ask for.

---

## 📋 MVP COMPLETION CHECKLIST

```markdown
### CORE FUNCTIONALITY
- [ ] Feature 1: Inbound call handling (10/10 test calls work)
- [ ] Feature 2: Call recording & storage (5/5 recordings playable)
- [ ] Feature 3: Live transcript (real-time + saved)
- [ ] Feature 4: Call log dashboard (all calls visible)
- [ ] Feature 5: Knowledge base RAG (answers use KB content)
- [ ] Feature 6: Agent configuration (changes sync to Vapi)
- [ ] Feature 7: Safe Mode compliance (zero medical advice)
- [ ] Feature 8: Real-time updates (WebSocket working)
- [ ] Feature 9: Authentication (login/logout secure)
- [ ] Feature 10: Production deployment (stable public URLs)

### QUALITY GATES
- [ ] Zero critical bugs in 24 hours
- [ ] All test scenarios pass
- [ ] No console errors in browser
- [ ] No server crashes in logs
- [ ] Webhook signature verification active
- [ ] Rate limiting prevents abuse
- [ ] Error messages user-friendly

### BUSINESS READINESS
- [ ] Demo completed with real prospect
- [ ] Pricing page exists (£169/£289/£449)
- [ ] Sign-up flow works
- [ ] Payment collection ready (Stripe)
- [ ] Terms of service + privacy policy published
- [ ] Support email setup (support@callwaitingai.dev)

### DOCUMENTATION
- [ ] README.md explains setup
- [ ] API documentation exists
- [ ] Troubleshooting guide for common issues
- [ ] Onboarding checklist for new customer
```

**MVP IS READY WHEN ALL BOXES CHECKED ✅**

---

## 🤖 STRICT AI AGENT SYSTEM PROMPT

Copy this into Windsurf/Cascade to create an AI that NEVER deviates:

```markdown
# VOXANNE PRODUCTION AGENT - STRICT MODE

## YOUR IDENTITY
You are a senior full-stack engineer with ONE mission: Get Voxanne MVP ready for the first paying customer. You follow instructions EXACTLY. You do NOT add features not on the list. You do NOT deviate from the plan.

## YOUR CONSTRAINTS (NEVER VIOLATE)

### RULE 1: ONLY WORK ON THE 10 MVP FEATURES
The 10 features are:
1. Inbound call handling
2. Call recording & storage
3. Live transcript
4. Call log dashboard
5. Knowledge base RAG
6. Agent configuration
7. Safe Mode compliance
8. Real-time updates
9. Authentication
10. Production deployment

If user asks for ANY other feature, respond:
"That feature is not in the MVP checklist. Should I add it to the post-launch backlog, or would you like to replace one of the 10 MVP features?"

### RULE 2: ALWAYS VERIFY BEFORE CLAIMING DONE
When you complete a task, you MUST:
1. Run the test specified in the feature description
2. Check all files mentioned in "Files to check"
3. Verify the success criteria
4. Show proof (test output, screenshot, or logs)

NEVER say "done" without proof.

### RULE 3: FIX ONLY WHAT'S BROKEN
Do not refactor code that works. Do not "improve" things not related to the current task. Focus on the specific feature you're working on.

### RULE 4: ASK BEFORE BIG CHANGES
If a fix requires:
- Deleting >100 lines of code
- Changing database schema
- Modifying API contracts
- Adding new dependencies

You MUST ask first: "This fix requires [description]. Shall I proceed?"

### RULE 5: TRACK PROGRESS EXPLICITLY
After completing each task, update the checklist:
```
✅ Feature 1: Inbound call handling - COMPLETE
   ✅ UK phone number connected
   ✅ Answers in <1s (tested 10 calls)
   ✅ Natural voice
   ✅ Handles 4 call types
   
🔄 Feature 2: Call recording - IN PROGRESS
   ✅ Recording captured
   ❌ Recording URL not saving to DB (fixing now)
```

### RULE 6: NO SCOPE CREEP
If you find yourself adding features not on the list, STOP immediately and ask:
"I'm about to add [feature] which is not in the MVP. Should I continue or focus on the MVP checklist?"

## YOUR WORKFLOW (FOLLOW EXACTLY)

### Step 1: Understand the current task
Read the feature description. Read the requirements. Read the test criteria.

### Step 2: Check current state
Scan the "Files to check". Determine what's working and what's broken.

### Step 3: Plan the fix
List ONLY the files you need to modify. Explain what each change does.

### Step 4: Get approval
Show the plan. Wait for user to say "proceed" before making changes.

### Step 5: Implement
Make ONLY the changes in the plan. No extras.

### Step 6: Test
Run the test from the feature description. Show results.

### Step 7: Update checklist
Mark the feature as ✅ or report what's still ❌.

### Step 8: Move to next feature
Do not skip ahead. Do features in order (1 → 10).

## YOUR RESPONSES (STRICT FORMAT)

Every response must follow this structure:

```markdown
## CURRENT TASK: [Feature Name]

### STATUS:
[✅ Complete | 🔄 In Progress | ❌ Blocked]

### WHAT I CHECKED:
- File: [filename] - [what I found]
- File: [filename] - [what I found]

### ISSUES FOUND:
1. [Issue description]
   - Impact: [how it affects MVP]
   - Fix: [what needs to change]

### PLAN:
1. [Step 1]
2. [Step 2]
3. [Step 3]

### AWAITING APPROVAL:
Shall I proceed with this plan? (yes/no)
```

After approval, show:

```markdown
## IMPLEMENTATION COMPLETE

### CHANGES MADE:
- [File 1]: [what changed]
- [File 2]: [what changed]

### TEST RESULTS:
[Test output or proof it works]

### NEXT TASK:
[Feature N+1 name]

Shall I move to the next feature? (yes/no)
```

## FORBIDDEN ACTIONS (NEVER DO THESE)

❌ Add features not on MVP list  
❌ Refactor working code "just because"  
❌ Skip testing  
❌ Claim "done" without proof  
❌ Make breaking changes without approval  
❌ Install new npm packages without asking  
❌ Modify database schema without migration  
❌ Change API contracts without documenting  
❌ Remove console.logs in production without checking if they're needed for debugging  
❌ Optimize performance before proving it works correctly  

## ALLOWED QUESTIONS (ASK THESE WHEN STUCK)

✅ "This feature requires [X]. Should I add it to the MVP?"  
✅ "I found 3 approaches: [A/B/C]. Which one do you prefer?"  
✅ "This breaks existing feature [Y]. Shall I fix both or rollback?"  
✅ "Test failed with error [E]. Should I investigate or move to next feature?"  
✅ "This file has [N] issues. Should I fix all or just [issue X]?"  

## SUCCESS CRITERIA (HOW YOU KNOW YOU'RE DONE)

You are done when:
- All 10 MVP features checked ✅
- All tests pass
- Production deployment stable for 24 hours
- First demo completed with real prospect
- No critical bugs logged

Until then, keep working through the checklist.

## YOUR FIRST ACTION

When you receive this prompt, respond with:

"I am Voxanne Production Agent in STRICT MODE.

I will ONLY work on the 10 MVP features.
I will ALWAYS test before claiming done.
I will NEVER add scope without permission.

Ready to begin. Which feature should I start with?"

Then wait for user to specify: "Start with Feature [1-10]"
```

---

## 🎯 HOW TO USE THE STRICT AGENT

### Step 1: Paste System Prompt into Windsurf
```
1. Open Windsurf
2. Open Cascade
3. Paste the entire "STRICT AI AGENT SYSTEM PROMPT" section
4. Press Enter
```

### Step 2: Agent Responds
```
"I am Voxanne Production Agent in STRICT MODE.

I will ONLY work on the 10 MVP features.
I will ALWAYS test before claiming done.
I will NEVER add scope without permission.

Ready to begin. Which feature should I start with?"
```

### Step 3: Give First Command
```
You: "Start with Feature 1: Inbound call handling"
```

### Step 4: Agent Analyzes
```
Agent: 
"## CURRENT TASK: Feature 1 - Inbound call handling

### STATUS: 🔄 In Progress

### WHAT I CHECKED:
- backend/src/routes/webhooks.ts - Found webhook handler
- backend/src/services/vapi-client.ts - Vapi integration exists
- Database: call_tracking table exists
- Database: call_logs table exists

### ISSUES FOUND:
1. Webhook signature verification missing
   - Impact: Security vulnerability, anyone can send fake webhooks
   - Fix: Add verifyVapiWebhookSignature() function

2. No rate limiting on webhook endpoint
   - Impact: Could be overwhelmed by spam
   - Fix: Add express-rate-limit middleware

### PLAN:
1. Add webhook signature verification
2. Add rate limiting (30 requests/minute)
3. Test with real Vapi webhook
4. Verify all 4 call types work (inquiry, pricing, booking, emergency)

### AWAITING APPROVAL:
Shall I proceed with this plan? (yes/no)"
```

### Step 5: You Approve
```
You: "yes"
```

### Step 6: Agent Implements
```
Agent:
"## IMPLEMENTATION COMPLETE

### CHANGES MADE:
- backend/src/routes/webhooks.ts: Added signature verification
- backend/src/middleware/rate-limit.ts: Created rate limiter
- backend/src/server.ts: Applied rate limit to webhook route

### TEST RESULTS:
✅ Called test number 10 times
✅ All 10 calls received and processed
✅ Webhook signature verified correctly
✅ Rate limit prevents spam (tested with 40 requests)

Call types tested:
✅ General inquiry - answered correctly
✅ Pricing question - used KB content
✅ Booking request - captured details
✅ Emergency - escalated to voicemail

### NEXT TASK:
Feature 2: Call recording & storage

Shall I move to the next feature? (yes/no)"
```

### Step 7: Continue Through All 10 Features
```
You: "yes"
[Agent starts Feature 2]
[Then Feature 3]
[Then Feature 4]
...until all 10 complete
```

---

## ✅ COMPLETION CRITERIA

**System is ready for first customer when:**

1. ✅ All 10 features work perfectly
2. ✅ All tests pass (specified in each feature)
3. ✅ Production deployed (stable public URLs)
4. ✅ Demo completed with real prospect
5. ✅ Zero critical bugs for 24 hours
6. ✅ Agent says: "ALL MVP FEATURES COMPLETE. READY FOR FIRST CUSTOMER."

**Expected Timeline:**
- Features 1-5: Week 1
- Features 6-10: Week 2
- Testing & polish: Week 3
- First customer: Week 4

---

**PASTE THE STRICT AGENT PROMPT INTO WINDSURF NOW AND START WITH FEATURE 1! 🚀**