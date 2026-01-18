# 🏗️ Multi-Tenant Webhook System Implementation Guide

## Current State Analysis

### ✅ What's Already Implemented
1. **Multi-tenant architecture exists**: Each org can have its own assistant
2. **Webhook routing works**: Single URL handles multiple assistants
3. **Database integration**: org_id tracking in agents table
4. **Configuration management**: Webhook URL configurable per request

### ❌ What Needs to Be Fixed
1. **Webhook URL not updated**: Still pointing to `http://localhost:3001` in your Vapi dashboard
2. **Assistant ID not persisted**: Each save might create new assistant instead of updating
3. **No webhook override on assistant update**: Need to refresh webhook URL when saving assistant

---

## Architecture: One URL, Multiple Assistants

```
┌─────────────────────────────────────────────────────────────────┐
│  VAPI Dashboard                                                  │
│  - Sarah (Inbound)                                              │
│  - Marcy (Follow-up)                                            │
│  - Outbound Campaign                                            │
│                                                                  │
│  All tools point to: https://ngrok-url/api/vapi/tools/*        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (POST with customer.metadata.org_id)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Backend Webhook Handlers (Single URL)                          │
│  POST /api/vapi/tools/bookClinicAppointment                    │
│  ├─ Extract org_id from customer.metadata                      │
│  ├─ Route to org-specific logic                                │
│  └─ Return org-specific response                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Multi-Tenant Schema                                   │
│  - organizations (org_id, name)                                 │
│  - agents (org_id, vapi_assistant_id, type)                    │
│  - appointments (org_id, contact_id, etc)                      │
│  - contacts (org_id, email, phone)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Get Your ngrok Auth Token Securely

1. Go to https://dashboard.ngrok.com
2. Click "Your Authtoken" in sidebar
3. Copy your auth token (keep it secret!)
4. Add to your `.env.local` (NOT `.env` which is in git):

```bash
# .env.local (NOT committed to git)
NGROK_AUTHTOKEN=35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU

# Your current ngrok URL
NGROK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

### Step 2: Update Backend Webhook URL in .env

```bash
# .env (can be in git - no secrets here)
BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
WEBHOOK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools
```

### Step 3: Create Assistant Update Handler

Create a new endpoint to update assistants with the correct webhook URL:

**File:** `backend/src/routes/vapi-setup.ts` (Add to existing file)

```typescript
/**
 * POST /api/vapi/setup/update-assistant-webhook
 * Updates an existing assistant with new webhook URL
 * Does NOT create a new assistant - reuses existing one
 */
vapiSetupRouter.post('/setup/update-assistant-webhook', requireAuth, async (req: Request, res: Response) => {
  try {
    const vapiApiKey = config.VAPI_PRIVATE_KEY;
    const { vapiAssistantId, webhookUrl } = req.body;
    const orgId = req.user?.orgId;

    if (!vapiAssistantId) {
      return res.status(400).json({ error: 'Vapi Assistant ID required' });
    }

    log.info('Vapi-Setup', '🔄 Updating assistant webhook URL', {
      assistantId: vapiAssistantId,
      orgId,
      webhookUrl
    });

    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // GET current assistant (don't create new one)
    const { data: assistant } = await vapiClient.get(`/assistant/${vapiAssistantId}`);

    // UPDATE webhook URL only (don't change other properties)
    const updatedAssistant = {
      ...assistant,
      serverUrl: webhookUrl || 'https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools'
    };

    const { data: updated } = await vapiClient.patch(
      `/assistant/${vapiAssistantId}`,
      updatedAssistant
    );

    log.info('Vapi-Setup', '✅ Assistant webhook updated', {
      assistantId: vapiAssistantId,
      newWebhookUrl: webhookUrl
    });

    res.json({
      success: true,
      assistantId: vapiAssistantId,
      webhookUrl: webhookUrl,
      message: 'Assistant webhook URL updated successfully'
    });
  } catch (error: any) {
    log.error('Vapi-Setup', 'Error updating assistant webhook', {
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});
```

### Step 4: Verify Assistant ID Persistence

**File:** `backend/src/routes/assistants.ts` (Check existing logic)

Make sure when you save an assistant:

```typescript
// ✅ CORRECT: Check if assistant already exists for org
const { data: existingAgent } = await supabase
  .from('agents')
  .select('vapi_assistant_id')
  .eq('org_id', orgId)
  .eq('type', 'inbound')  // or assistant type
  .single();

if (existingAgent?.vapi_assistant_id) {
  // UPDATE existing assistant in Vapi
  // Use PATCH /assistant/{id} to update
  // DO NOT create new one
  assistantId = existingAgent.vapi_assistant_id;
} else {
  // CREATE new assistant in Vapi
  // Only on first save
  assistantId = createNewAssistant();
}

// Store in database
await supabase
  .from('agents')
  .upsert({
    org_id: orgId,
    type: 'inbound',
    vapi_assistant_id: assistantId,  // Reuse same ID
    updated_at: new Date().toISOString()
  })
  .eq('org_id', orgId)
  .eq('type', 'inbound');
```

### Step 5: Create Multi-Tenant Webhook Interceptor

**File:** `backend/src/middleware/vapi-org-extractor.ts` (New file)

```typescript
import { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger';

/**
 * Extracts org_id from Vapi customer metadata
 * Makes it available to all webhook handlers
 */
export function extractVapiOrgId(req: Request, res: Response, next: NextFunction) {
  try {
    // Vapi sends customer metadata in request body
    const customer = req.body.customer || req.body.message?.customer || {};
    const metadata = customer.metadata || {};
    const orgId = metadata.org_id;

    if (orgId) {
      // Attach to request for use in handlers
      (req as any).orgId = orgId;
      (req as any).vapiCustomer = customer;

      log.debug('Vapi-OrgExtractor', 'Extracted org_id from Vapi metadata', {
        orgId,
        assistantId: req.body.assistantId
      });
    }

    next();
  } catch (error) {
    log.warn('Vapi-OrgExtractor', 'Could not extract org_id', {
      error: error instanceof Error ? error.message : String(error)
    });
    next(); // Continue even if extraction fails
  }
}
```

### Step 6: Update Server.ts to Use Middleware

**File:** `backend/src/server.ts` (Add after other middleware)

```typescript
import { extractVapiOrgId } from './middleware/vapi-org-extractor';

// After helmet, cors, express.json...
app.use('/api/vapi', extractVapiOrgId);
```

---

## Webhook URL Configuration

### In Your Vapi Dashboard

**For ALL Tools across ALL Assistants:**

1. Go to https://dashboard.vapi.ai → Assistants
2. For each assistant (Sarah, Marcy, etc):
   - Click "Edit" → "Tools"
   - For EACH tool (bookClinicAppointment, etc):
     - Set webhook URL to: `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/{toolName}`
     - Example: `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment`

3. **Ensure every assistant has customer metadata:**
   - Go to "Settings" → "Metadata"
   - Add: `org_id: "46cf2995-2bee-44e3-838b-24151486fe4e"`

### In Your Backend .env

```bash
# Production ngrok URL
BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
WEBHOOK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools

# ngrok auth token (in .env.local only, not committed)
NGROK_AUTHTOKEN=your-token-here
```

---

## Testing Multi-Tenant Setup

### Test 1: Webhook Reaches Backend

```bash
curl -X POST "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "metadata": {
        "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
      }
    },
    "message": {
      "toolCall": {
        "function": {
          "name": "bookClinicAppointment",
          "arguments": {
            "appointmentDate": "2026-01-20",
            "appointmentTime": "18:00",
            "patientEmail": "test@example.com",
            "patientName": "Test"
          }
        }
      }
    }
  }'
```

### Test 2: Verify org_id Extraction

Check logs:
```bash
tail -f backend/vapi-debug.log | grep "org_id\|MULTI-TENANT"
```

Should see:
```
Org ID extracted: 46cf2995-2bee-44e3-838b-24151486fe4e
Organization verified: voxanne@demo.com Organization
```

### Test 3: Multiple Orgs (Future)

For multiple organizations, test with different org_ids:
```json
{
  "customer": {
    "metadata": {
      "org_id": "OTHER-ORG-ID-HERE"
    }
  }
}
```

---

## Security Checklist

- [ ] ✅ ngrok auth token ONLY in `.env.local` (not committed)
- [ ] ✅ VAPI_PRIVATE_KEY only in `.env` (not exposed)
- [ ] ✅ org_id comes from Vapi customer metadata (not from request header)
- [ ] ✅ org_id validated against database before operations
- [ ] ✅ Webhook URL uses HTTPS (not HTTP)
- [ ] ✅ Same webhook URL for all assistants of same org
- [ ] ✅ Assistant IDs reused (not creating duplicates)

---

## Common Issues & Fixes

### Issue: Assistant ID Changes on Save
**Cause:** Creating new assistant instead of updating existing
**Fix:** Check for existing `vapi_assistant_id` in database before creating new one

### Issue: Webhook URL Still Shows localhost
**Cause:** Vapi dashboard cached old config
**Fix:** Click "Save" in Vapi assistant settings to refresh

### Issue: Different Assistants Have Different Webhook URLs
**Cause:** Manual configuration on each assistant
**Fix:** Use API to update all assistants with same URL at once

### Issue: org_id Not Reaching Backend
**Cause:** Vapi not sending customer metadata
**Fix:** Add metadata in Vapi assistant settings → Metadata section

---

## Next Steps

1. **Update .env with ngrok URL** (no secrets)
2. **Add webhook interceptor middleware** (code above)
3. **Update all Vapi assistant webhook URLs** in dashboard
4. **Verify org_id metadata in Vapi** for each assistant
5. **Test end-to-end booking** with Sarah

---

## Files Modified/Created

| File | Change |
|------|--------|
| `backend/src/routes/vapi-setup.ts` | Add update webhook endpoint |
| `backend/src/middleware/vapi-org-extractor.ts` | NEW - Extract org_id |
| `backend/src/server.ts` | Add middleware |
| `.env` | Update BACKEND_URL, WEBHOOK_URL |
| `.env.local` | Add NGROK_AUTHTOKEN (don't commit) |
| Vapi Dashboard | Update all tool webhook URLs |

---

## Result

✅ **Single webhook URL** for all assistants
✅ **Automatic org routing** via customer metadata
✅ **Reusable assistant IDs** (no duplicates)
✅ **Multi-tenant ready** for multiple organizations

