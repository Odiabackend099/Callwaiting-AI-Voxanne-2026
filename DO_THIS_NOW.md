# ⚡ DO THIS NOW (13 Minutes to Working System)

## Copy-Paste Instructions

### Step 1: Update .env File (1 min)

Open: `backend/.env`

Find this line:
```bash
BACKEND_URL=http://localhost:3001
```

Replace with:
```bash
BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

Save the file.

---

### Step 2: Update Vapi Dashboard (5 min)

#### 2.1: Go to Vapi
- Open: https://dashboard.vapi.ai
- Click: **Assistants** (left sidebar)
- Find: **"CallWaiting AI Inbound"**
- Click the assistant name

#### 2.2: Edit the Booking Tool
- Click: **Edit** (pencil icon)
- Click: **Tools** tab
- Find: **"bookClinicAppointment"** tool
- Click on it to edit

#### 2.3: Update Webhook URL
Look for a field called:
- "Server URL" or
- "Webhook URL" or
- "URL"

Clear it and paste:
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment
```

#### 2.4: Save
- Click: **Save** button
- Click: **Publish** button (top right, green button)
- Wait for it to say "Published"

---

### Step 3: Restart Backend (2 min)

In your terminal:

```bash
# 1. Kill current backend (press Ctrl+C)

# 2. Then run:
cd backend
npm run dev

# 3. Wait for:
# ✅ App listening on port 3001
```

---

### Step 4: Test with Sarah (5 min)

#### 4.1: Call Your Clinic
- Call your clinic phone number (the inbound number)
- Wait for Sarah to answer

#### 4.2: Follow the Flow
- Sarah: "Hi! How can I help you?"
- You: "I want to book an appointment"
- Sarah: "Sure! What's your name?"
- You: "Samuel"
- Sarah: "What's your email?"
- You: "samuel@test.com"
- Sarah: "What service would you like?"
- You: "Botox"
- Sarah: "When would you like to come in?"
- You: "Monday at 6 PM"
- Sarah: "Let me confirm. You'd like to book [service] for [date] at [time]. Correct?"
- You: "Yes"

#### 4.3: Expected Result
Sarah says: **"Perfect! I've scheduled your appointment for..."**

✅ **YOU'RE DONE!**

---

### Step 5: Verify It Worked (2 min)

#### 5.1: Check Supabase
1. Go to: https://supabase.com
2. Open your project
3. Click: **SQL Editor**
4. Paste this query:
```sql
SELECT * FROM appointments ORDER BY created_at DESC LIMIT 1;
```
5. Click: **Run**
6. You should see your appointment in the results

#### 5.2: Check Logs
```bash
# In another terminal, check backend logs
tail -50 backend/vapi-debug.log | grep -i "booking\|appointment"
```

You should see: `Appointment created successfully`

---

## Troubleshooting (If It Doesn't Work)

### Issue: Sarah says "technical issue"

**Check 1:** Backend URL in Vapi
- https://dashboard.vapi.ai → Assistants → Sarah → Tools → bookClinicAppointment
- Confirm URL is: `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment`
- NOT localhost

**Check 2:** Backend is running
- You should see: "✅ App listening on port 3001"
- If not, run: `cd backend && npm run dev`

**Check 3:** ngrok is running
- Open: http://127.0.0.1:4040
- Check that ngrok shows green status

### Issue: Webhook URL error in Vapi dashboard

**Fix:** Click **Publish** after saving
- The URL needs to be published for Vapi to use it

### Issue: Supabase shows no appointment

**Check logs:**
```bash
tail -100 backend/vapi-debug.log | grep -i "error\|failed"
```

Look for error messages and report them.

---

## What Happens Next

After this works:

1. ✅ Sarah books appointments
2. ✅ Appointments go in Supabase
3. ✅ Knowledge base queries (optional, later)
4. ✅ SMS confirmations (optional, later)
5. ✅ Google Calendar sync (optional, later)

But the core system works!

---

## Summary

```
Step 1: Update .env → 1 minute
Step 2: Update Vapi → 5 minutes
Step 3: Restart backend → 2 minutes
Step 4: Test with Sarah → 5 minutes
Step 5: Verify → 2 minutes

Total: 15 minutes
```

Then you have a **working booking system** ✅

---

## Questions?

If something doesn't work:
1. Check the troubleshooting section above
2. Check backend logs
3. Look at Vapi dashboard for error messages
4. Let me know what you see

Good luck! 🚀

