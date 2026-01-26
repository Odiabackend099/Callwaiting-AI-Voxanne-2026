# 🚀 Server Startup & Vapi Webhook Configuration Rules

**Last Updated:** 2026-01-27
**Critical for:** Multi-tenant webhook URL management and environment-aware configuration

---

## The Golden Rule

### **The Backend is the Vapi Admin**

In Voxanne AI's multi-tenant architecture:
- **The Backend** holds the single master `VAPI_PRIVATE_KEY` in its environment
- **Organizations** are "passengers" - they don't know Vapi exists
- **All assistants** are created and managed by the backend using this master key
- **Organizations never provide Vapi credentials** - they don't have any

---

## Critical Rule: Dynamic Webhook URL Injection

### **The `serverUrl` is NOT Hardcoded**

The webhook URL must be **injected at runtime** based on the environment:

| Environment | BACKEND_URL | Webhook URL |
|---|---|---|
| **Development** | `https://xyz123.ngrok-free.app` | `https://xyz123.ngrok-free.app/api/vapi/webhook` |
| **Staging** | `https://staging.voxanne.ai` | `https://staging.voxanne.ai/api/vapi/webhook` |
| **Production** | `https://api.voxanne.ai` | `https://api.voxanne.ai/api/vapi/webhook` |

**Why?** In development, ngrok changes the URL on restart. In production, it's static. The code must handle both.

---

## Three Moments of Webhook Configuration

### **1. Creation (The "Birth" of an Assistant)**

**When it happens:**
- New organization signs up
- Admin creates a new assistant via Founder Console
- First-time assistant provisioning

**What happens:**
1. Backend reads `process.env.BACKEND_URL`
2. Constructs webhook URL: `${BACKEND_URL}/api/vapi/webhook`
3. Includes `serverUrl` in `POST /assistant` payload to Vapi
4. Assistant is born with correct webhook

**Code location:** `vapi-assistant-manager.ts` → `createAssistant()`

```typescript
const webhookUrl = `${process.env.BACKEND_URL}/api/vapi/webhook`;
const payload = {
  name: config.name,
  systemPrompt: config.systemPrompt,
  serverUrl: webhookUrl,  // ← Injected at creation time
  // ... other config
};
await vapi.post('/assistant', payload);
```

---

### **2. The "Save" Button (The "Heal" Action)**

**When it happens:**
- User clicks "Save Settings" on dashboard
- User clicks "Save Agent" in Founder Console
- Any assistant configuration is updated

**What happens:**
1. Backend fetches current assistant from Vapi
2. Backend reads `process.env.BACKEND_URL` (current environment)
3. Constructs fresh webhook URL
4. **ALWAYS** includes `serverUrl` in `PATCH` request, even if user didn't change it
5. Re-injects the webhook URL

**Why this matters:**
- If ngrok URL changed since assistant was created → **This heals it**
- If BACKEND_URL environment variable updated → **This heals it**
- Zero manual intervention needed - "save" operation inadvertently fixes stale URLs

**Code location:** `founder-console-settings.ts:317` & `founder-console-settings.ts:332`

```typescript
const webhookUrl = `${process.env.BACKEND_URL}/api/vapi/webhook`;
await configureVapiWebhook(vapiApiKey, assistantId);
// Which calls vapi-webhook-configurator.ts:
// const webhookUrl = getWebhookUrl();  // Uses BACKEND_URL
// await vapi.patch(`/assistant/${assistantId}`, {
//   serverUrl: webhookUrl  // ← Always re-injected
// });
```

---

### **3. The "Mass Sync" (Development Only)**

**When it happens:**
- Developer restarts ngrok and gets a new URL
- All existing assistants now point to the old ngrok address (broken)
- Developer runs manual sync script

**What happens:**
1. Script fetches all assistants in Vapi account
2. For each assistant: `PATCH /assistant` with new `BACKEND_URL`
3. All assistants heal in bulk

**Example script:**

```bash
# .scripts/vapi-sync-webhooks.sh
npm run vapi:sync-webhooks

# Or manual:
npx ts-node backend/src/scripts/sync-all-assistants.ts
```

**When to use:**
- ✅ After ngrok restart in development
- ❌ Not on every server boot (too slow, risky)
- ❌ Not in production (URL doesn't change)

---

## Implementation Requirements

### **Where BACKEND_URL is Read**

1. **`vapi-webhook-configurator.ts:20`** ← Primary source
```typescript
const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
return `${baseUrl}/api/vapi/webhook`;
```

2. **`vapi-assistant-manager.ts:285-290`** ← Creation time
```typescript
if (!config.serverUrl && process.env.BACKEND_URL) {
  updatePayload.serverUrl = `${process.env.BACKEND_URL}/api/vapi/webhook`;
}
```

3. **`founder-console-settings.ts:317 & 332`** ← Save time
```typescript
const inboundWebhookResult = await configureVapiWebhook(safeVapiKey, ensuredInboundAssistantId);
// Calls getWebhookUrl() which uses BACKEND_URL
```

### **Environment Variable Setup**

**Development (.env):**
```bash
# Auto-set by start-dev.sh or manually:
BACKEND_URL=https://xyz123.ngrok-free.app  # ngrok URL
```

**Production (.env or hosting platform):**
```bash
BACKEND_URL=https://api.voxanne.ai  # Your domain
```

**Must never be:**
```bash
# ❌ WRONG - Hardcoded localhost
BACKEND_URL=http://localhost:3001

# ❌ WRONG - Undefined (would default to localhost)
# (empty or missing)
```

---

## Development Workflow

### **Morning: Start Dev Environment**

1. **Terminal 1: Start Backend**
   ```bash
   cd backend
   npm run dev
   # Reads BACKEND_URL from .env
   ```

2. **Terminal 2: Start Frontend**
   ```bash
   npm run dev
   ```

3. **Terminal 3: Start Ngrok**
   ```bash
   ngrok http 3001
   # Get new URL: https://xyz123.ngrok-free.app
   ```

4. **Update .env with Ngrok URL**
   ```bash
   # Edit backend/.env
   BACKEND_URL=https://xyz123.ngrok-free.app
   ```

5. **Restart Backend**
   ```bash
   # Press Ctrl+C in Terminal 1
   npm run dev
   # Now reads correct BACKEND_URL
   ```

### **If Ngrok Restarts Mid-Day**

**Old ngrok URL:** `https://old123.ngrok-free.app`
**New ngrok URL:** `https://new456.ngrok-free.app`

**Step 1:** Update `.env`
```bash
BACKEND_URL=https://new456.ngrok-free.app
```

**Step 2:** Restart backend (automatic hot-reload won't work for env vars)
```bash
# Press Ctrl+C in Terminal 1
npm run dev
```

**Step 3:** Heal all assistants (optional but recommended)
```bash
# In a new terminal:
npx ts-node backend/src/scripts/sync-all-assistants.ts
# Updates all assistants with new webhook URL
```

---

## Key Rules & Constraints

### **DO ✅**

- ✅ **Always use `BACKEND_URL`** in webhook construction
- ✅ **Re-inject webhook URL on every save** - even if user didn't change it
- ✅ **Use correct endpoint:** `/api/vapi/webhook` (not `/api/webhooks/vapi`)
- ✅ **Set BACKEND_URL before server starts** - it's read at app startup
- ✅ **Manual sync when you know env changed** - restarts, deployments, etc.

### **DON'T ❌**

- ❌ **Don't hardcode webhook URLs** in code or database
- ❌ **Don't scan/patch all assistants on startup** - unnecessary, slow
- ❌ **Don't leave BACKEND_URL undefined** - always has a default
- ❌ **Don't require organizations to log into Vapi** - they have no credentials
- ❌ **Don't try to get Vapi credentials from org_credentials** - orgs don't have any

---

## Verification Checklist

### **Before Testing Webhooks**

- [ ] `BACKEND_URL` is set in backend/.env to your ngrok/production URL
- [ ] Backend is running: `npm run dev` reads the updated `.env`
- [ ] Frontend can reach backend on BACKEND_URL
- [ ] Test webhook endpoint: `curl https://YOUR_BACKEND_URL/api/vapi/webhook`
- [ ] Check assistant in Vapi dashboard - `serverUrl` field matches BACKEND_URL

### **After Ngrok Restart**

- [ ] Get new ngrok URL
- [ ] Update backend/.env with new BACKEND_URL
- [ ] Restart backend server
- [ ] (Optional) Run sync script: `npx ts-node backend/src/scripts/sync-all-assistants.ts`
- [ ] Verify: Assistant serverUrl in Vapi dashboard updated

---

## Troubleshooting

### **Problem: "Webhook returns 404"**

**Cause:** BACKEND_URL is wrong or missing
**Fix:**
```bash
# Check current value
grep BACKEND_URL backend/.env

# Should be: https://your-ngrok-or-domain-url
# NOT: http://localhost:3001 (can't reach from external)
```

### **Problem: "Webhook URL not updating in Vapi"**

**Cause:** Backend not restarted after .env change
**Fix:**
```bash
# Press Ctrl+C to stop backend
# Edit backend/.env with new BACKEND_URL
# Restart backend
npm run dev
# Then save agent config again to trigger PATCH
```

### **Problem: "Multiple assistants have stale webhook URLs"**

**Cause:** Ngrok restarted but backend didn't heal them
**Fix:**
```bash
# Update BACKEND_URL in .env to new ngrok URL
# Restart backend
npm run dev
# Run sync script
npx ts-node backend/src/scripts/sync-all-assistants.ts
```

---

## Code References

**Critical Files:**

- [vapi-webhook-configurator.ts:15-22](../backend/src/services/vapi-webhook-configurator.ts#L15-L22) - Where webhook URL is constructed
- [vapi-assistant-manager.ts:285-290](../backend/src/services/vapi-assistant-manager.ts#L285-L290) - Creation-time injection
- [founder-console-settings.ts:317](../backend/src/routes/founder-console-settings.ts#L317) - Save-time healing

---

## Summary

| Moment | Trigger | Action | Location |
|--------|---------|--------|----------|
| **Creation** | New assistant provisioned | Inject BACKEND_URL as serverUrl | `vapi-assistant-manager.ts` |
| **Save** | User saves settings | Re-inject BACKEND_URL (healing) | `founder-console-settings.ts` |
| **Mass Sync** | Manual intervention | Patch all assistants with current BACKEND_URL | `sync-all-assistants.ts` script |

**The core principle:** The backend always injects its current environment's URL into Vapi, automatically healing stale webhooks through the save operation.

