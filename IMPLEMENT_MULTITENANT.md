# ✅ Implementation Checklist - Multi-Tenant Webhook

## 0️⃣ Pre-Requisites
- [ ] ngrok is running: `ngrok http 3001`
- [ ] Backend is running: `npm run dev` in backend/
- [ ] Backend URL shows https://ngrok-url (not localhost)
- [ ] You have your ngrok auth token

---

## 1️⃣ Update Environment Variables

### Step 1.1: Update .env (in git)

**File:** `backend/.env`

```bash
# Change this:
BACKEND_URL=http://localhost:3001

# To this (use your actual ngrok URL):
BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev

# Add this line:
WEBHOOK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools
```

### Step 1.2: Create .env.local (NOT in git)

**File:** `backend/.env.local` (new file, add to .gitignore)

```bash
# ngrok auth token (NEVER commit this)
NGROK_AUTHTOKEN=35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU

# Your current ngrok URL
NGROK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

**Add to .gitignore:**
```
backend/.env.local
```

---

## 2️⃣ Add Middleware to Server.ts

**File:** `backend/src/server.ts`

Find this section (around line 53):
```typescript
import { vapiWebhookRouter } from './routes/vapi-webhook';
```

Add this line after the imports:
```typescript
import { extractVapiOrgId, debugVapiRequests } from './middleware/vapi-org-extractor';
```

Then find where routes are registered (around line 211):
```typescript
app.use('/api/vapi', vapiWebhookRouter);
```

**Change to:**
```typescript
// Multi-tenant Vapi middleware: Extract org_id from metadata
app.use('/api/vapi', extractVapiOrgId);
app.use('/api/vapi', debugVapiRequests); // Remove in production

// Vapi webhook and tool routes
app.use('/api/vapi', vapiWebhookRouter);
app.use('/api/vapi', vapiToolsRouter);
```

---

## 3️⃣ Verify Assistant ID Persistence

**File:** `backend/src/routes/assistants.ts` (if exists) or wherever assistants are created

Look for this pattern:
```typescript
// Creating a new assistant
const assistantId = await createVapiAssistant(...);
```

**Replace with:**
```typescript
// Check if assistant already exists for this org
const { data: existingAgent } = await supabase
  .from('agents')
  .select('vapi_assistant_id')
  .eq('org_id', orgId)
  .eq('type', 'inbound') // or your assistant type
  .maybeSingle();

let assistantId: string;

if (existingAgent?.vapi_assistant_id) {
  // Reuse existing assistant (update instead of create)
  assistantId = existingAgent.vapi_assistant_id;
  log.info('AssistantRouter', 'Using existing assistant', { assistantId, orgId });
} else {
  // Create new assistant only on first save
  assistantId = await createVapiAssistant(...);
  log.info('AssistantRouter', 'Created new assistant', { assistantId, orgId });
}

// Store in database (upsert to avoid duplicates)
await supabase
  .from('agents')
  .upsert({
    org_id: orgId,
    type: 'inbound',
    vapi_assistant_id: assistantId,
    updated_at: new Date().toISOString()
  })
  .eq('org_id', orgId)
  .eq('type', 'inbound');
```

---

## 4️⃣ Update Vapi Dashboard

### For Each Assistant (Sarah, Marcy, etc):

1. Go to https://dashboard.vapi.ai
2. Click **Assistants** in left sidebar
3. Click the assistant name (e.g., "CallWaiting AI Inbound")
4. Click **Edit** button (or pencil icon)

### 4.1: Update Metadata

1. Scroll to **Metadata** section
2. Click **Add Custom Metadata**
3. Add this metadata:
   ```json
   {
     "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
   }
   ```
4. Click **Save**

### 4.2: Update Tool Webhook URLs

1. Click **Tools** tab
2. For each tool (find "bookClinicAppointment"):
   - Click the tool to edit it
   - Find "Server URL" or "Webhook URL" field
   - Change from: `http://localhost:3001/...`
   - Change to: `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment`
   - Click **Save**

3. Click **Publish** button (top right)
4. Confirm publication

### 4.3: Repeat for ALL Assistants

Repeat steps 4.1-4.2 for:
- [ ] Sarah (Inbound)
- [ ] Marcy (or other assistants)
- [ ] Any other assistants

---

## 5️⃣ Restart Backend

```bash
# Kill current backend process (Ctrl+C)
# Then restart:
cd backend
npm run dev

# You should see:
# ✅ App listening on port 3001
# ✅ Multi-tenant Vapi middleware initialized
```

---

## 6️⃣ Verify Setup

### Test 1: Check Backend URL

```bash
curl -s https://sobriquetical-zofia-abysmally.ngrok-free.dev/health
# Should return: { "status": "ok" }
```

### Test 2: Check org_id Extraction

```bash
bash test-booking-endpoint.sh
# Should see in output:
# ✅ Booking endpoint returned HTTP 200
# ✅ Response has toolResult field
# ✅ Response has content field
# ✅ Response has speech field
```

### Test 3: Check Backend Logs

```bash
tail -50 backend/vapi-debug.log | grep "org_id\|MULTI-TENANT"
# Should see: "Org ID extracted: 46cf2995-2bee-44e3-838b-24151486fe4e"
```

---

## 7️⃣ Make Test Call

1. Call your clinic phone number
2. Go through booking flow with Sarah
3. Listen for confirmation

**Expected result:**
- Sarah: "Let me confirm... [details]... correct?"
- You: "Yes"
- Sarah: "Perfect! I've scheduled your appointment for..."

---

## 8️⃣ Verify in Supabase

1. Go to https://supabase.com
2. Open your project
3. Go to **SQL Editor**
4. Run this query:

```sql
SELECT * FROM appointments
ORDER BY created_at DESC
LIMIT 5;
```

You should see:
- [ ] New appointment row
- [ ] `org_id`: 46cf2995-2bee-44e3-838b-24151486fe4e
- [ ] `contact_id`: (should be linked)
- [ ] `scheduled_at`: Your booking time
- [ ] `status`: confirmed

---

## 9️⃣ Troubleshooting

### Issue: Still getting "localhost" error in Vapi

**Solution:**
1. Hard refresh Vapi dashboard: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Logout and login to Vapi
3. Click "Publish" on assistant again

### Issue: org_id Not Extracted

**Check logs:**
```bash
tail -200 backend/vapi-debug.log | grep "org_id\|ERROR"
```

**Fix:**
1. Verify metadata is set in Vapi assistant (step 4.1)
2. Call Sarah again
3. Check logs for error messages

### Issue: New Assistant Created Instead of Reusing

**Check logs:**
```bash
tail -50 backend/vapi-debug.log | grep "Created new assistant\|Using existing"
```

**Fix:**
1. Check if `existingAssistant` logic is in place
2. Verify agents table has your assistant ID
3. Query database:
   ```sql
   SELECT * FROM agents WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
   ```

---

## ✅ Success Criteria

After completing all steps:

- [ ] ✅ Backend running on https://ngrok-url (not localhost)
- [ ] ✅ All Vapi assistants have metadata with org_id
- [ ] ✅ All tool webhooks point to https://ngrok-url/api/vapi/tools/*
- [ ] ✅ Backend logs show "Org ID extracted: 46c..."
- [ ] ✅ Booking endpoint returns HTTP 200 with toolResult
- [ ] ✅ Sarah successfully books appointment
- [ ] ✅ Appointment appears in Supabase with correct org_id
- [ ] ✅ Same assistant ID reused (no duplicates)

---

## 🔒 Security Reminders

- [ ] ✅ ngrok auth token ONLY in .env.local (not git)
- [ ] ✅ VAPI_PRIVATE_KEY never logged or exposed
- [ ] ✅ .env.local is in .gitignore
- [ ] ✅ org_id comes from Vapi metadata (not request header)
- [ ] ✅ Webhook URL uses HTTPS (not HTTP)
- [ ] ✅ No hardcoded org_ids in code

---

## Summary

You now have:
1. ✅ Multi-tenant webhook system
2. ✅ One URL for all assistants
3. ✅ Automatic org routing via metadata
4. ✅ Reusable assistant IDs (no duplicates)
5. ✅ Ready for multiple organizations

**Time to implement:** 15-20 minutes

