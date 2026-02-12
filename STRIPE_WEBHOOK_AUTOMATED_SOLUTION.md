# 🤖 Stripe Webhook Automation - Programmatic Solution

**Status:** RESEARCH & IMPLEMENTATION PLAN  
**Goal:** Eliminate manual Stripe Dashboard configuration  
**Target:** Works locally (ngrok) + production (real domain)

---

## 🎯 Three-Layer Solution

### Layer 1: Automated Webhook Endpoint Registration (Stripe API)

Backend startup automatically:
1. Detects environment (local/staging/production)
2. Determines webhook URL based on environment
3. Queries Stripe API to list existing endpoints
4. Creates new endpoint if not found
5. Stores webhook signing secret in environment

**Advantages:**
- ✅ Zero manual Stripe Dashboard configuration
- ✅ Works for local development (ngrok) and production
- ✅ Automatic secret rotation support
- ✅ Scalable to multiple environments

**Implementation:**
```typescript
// backend/src/scripts/setup-stripe-webhooks.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function ensureWebhookEndpoint() {
  const webhookUrl = getWebhookUrlForEnvironment();
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // List existing endpoints
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  
  // Check if endpoint already exists
  const existing = endpoints.data.find(ep => ep.url === webhookUrl);
  
  if (existing && signingSecret) {
    console.log('✅ Webhook endpoint already configured');
    return;
  }
  
  // Create new endpoint
  const newEndpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      'checkout.session.completed',
      'payment_intent.succeeded',
      'customer.created'
    ],
    version: '2023-10-16'
  });
  
  console.log('✅ Created webhook endpoint:', newEndpoint.url);
  console.log('📝 Webhook Secret: whsec_...', newEndpoint.secret.substring(0, 20));
  
  // Store secret in environment
  await storeWebhookSecret(newEndpoint.secret);
}
```

### Layer 2: Programmatic Webhook Testing

Direct webhook delivery testing without Stripe Dashboard:
1. Generate valid webhook signatures programmatically
2. Send test webhook events to backend
3. Verify balance updates automatically
4. Document results in test reports

**Advantages:**
- ✅ Automated E2E testing
- ✅ Reproducible test scenarios
- ✅ No manual intervention needed
- ✅ Integrates with CI/CD pipeline

**Implementation:**
```typescript
// backend/src/scripts/test-webhook-delivery.ts
import Stripe from 'stripe';
import crypto from 'crypto';

export async function testWebhookDelivery() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  // Create test event payload
  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_abc123',
        client_reference_id: 'org_id_here',
        amount_total: 5000,
        currency: 'gbp'
      }
    }
  };
  
  // Generate valid webhook signature
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateWebhookSignature(event, timestamp, webhookSecret);
  
  // Send to backend webhook endpoint
  const response = await fetch('http://localhost:3001/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature
    },
    body: JSON.stringify(event)
  });
  
  console.log('✅ Webhook delivered:', response.status);
  
  // Verify balance updated
  const balance = await queryWalletBalance('org_id_here');
  console.log('✅ Wallet balance updated to:', balance);
}

function generateWebhookSignature(
  event: any,
  timestamp: number,
  secret: string
): string {
  const payload = `${timestamp}.${JSON.stringify(event)}`;
  const hmac = crypto.createHmac('sha256', secret);
  const signature = hmac.update(payload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
```

### Layer 3: Environment Detection & Configuration

Automatic setup based on deployment context:

**Local Development:**
- ✅ Uses ngrok tunnel URL
- ✅ Auto-creates webhook endpoint
- ✅ Stores secret in .env dynamically
- ✅ Runs webhook tests programmatically

**Staging:**
- ✅ Uses staging domain
- ✅ Creates separate webhook endpoint
- ✅ Stores secret in Vercel environment variables
- ✅ Health checks for webhook delivery

**Production:**
- ✅ Uses production domain
- ✅ Reuses webhook endpoint
- ✅ Secrets in secure vault (AWS Secrets Manager or similar)
- ✅ Monitoring and alerting on webhook failures

**Implementation:**
```typescript
// backend/src/config/stripe-webhook-config.ts

export function getWebhookUrlForEnvironment(): string {
  const nodeEnv = process.env.NODE_ENV;
  const ngrokUrl = process.env.NGROK_AUTH_TOKEN ? 'sobriquetical-zofia-abysmally.ngrok-free.dev' : null;
  const productionDomain = process.env.PRODUCTION_DOMAIN || 'api.voxanne.ai';
  const stagingDomain = process.env.STAGING_DOMAIN || 'staging-api.voxanne.ai';
  
  if (nodeEnv === 'development' && ngrokUrl) {
    return `https://${ngrokUrl}/api/webhooks/stripe`;
  }
  
  if (nodeEnv === 'staging') {
    return `https://${stagingDomain}/api/webhooks/stripe`;
  }
  
  return `https://${productionDomain}/api/webhooks/stripe`;
}

export async function initializeStripeWebhooks() {
  try {
    await ensureWebhookEndpoint();
    console.log('✅ Stripe webhook infrastructure ready');
  } catch (error) {
    console.error('❌ Failed to initialize Stripe webhooks:', error);
    process.exit(1);
  }
}
```

---

## 📊 Implementation Comparison

| Aspect | Manual (Current) | Programmatic (Proposed) |
|--------|------------------|------------------------|
| Setup Time | 5 minutes per environment | Automatic on startup |
| Environments | 1 (local only) | Unlimited (dev/staging/prod) |
| Testing | Manual Stripe Dashboard | Automated scripts |
| Maintenance | Manual updates | Auto-detects changes |
| Error Recovery | Manual intervention | Automatic retry + alerts |
| Documentation | Manual steps | Self-documenting code |
| CI/CD Integration | Manual | Native support |
| Developer Experience | Error-prone | Foolproof |

---

## 🚀 Implementation Roadmap

### Phase 1: Automated Endpoint Registration (2 hours)

**Files to Create:**
1. `backend/src/scripts/setup-stripe-webhooks.ts` (200 lines)
   - Stripe API integration
   - Endpoint detection logic
   - Secret storage logic

2. `backend/src/config/stripe-webhook-config.ts` (100 lines)
   - Environment detection
   - URL generation
   - Configuration lookup

3. `backend/src/services/stripe-webhook-manager.ts` (300 lines)
   - Webhook validation
   - Event processing
   - Error handling

**Integration Points:**
- Call from `backend/src/server.ts` on startup
- Load webhook secret from environment
- Initialize event handlers

**Expected Output:**
```
[Startup Log]
✅ Stripe SDK initialized
✅ Webhook endpoint detected at: https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/stripe
✅ Webhook signing secret configured
✅ Listening for 3 event types: checkout.session.completed, payment_intent.succeeded, customer.created
✅ Webhook infrastructure ready
```

### Phase 2: Automated Webhook Testing (1.5 hours)

**Files to Create:**
1. `backend/src/scripts/test-stripe-webhook-delivery.ts` (250 lines)
   - Event generation
   - Signature generation
   - Delivery verification

2. `backend/src/__tests__/integration/stripe-webhook-e2e.test.ts` (300 lines)
   - End-to-end webhook flow
   - Balance verification
   - Transaction logging

**Test Scenarios:**
- ✅ Webhook received and validated
- ✅ Balance credited correctly
- ✅ Transaction logged in database
- ✅ Invalid signatures rejected
- ✅ Duplicate events handled (idempotency)
- ✅ Error scenarios (invalid org_id, etc.)

**NPM Scripts:**
```json
{
  "scripts": {
    "setup:stripe-webhooks": "ts-node src/scripts/setup-stripe-webhooks.ts",
    "test:webhook-delivery": "ts-node src/scripts/test-stripe-webhook-delivery.ts",
    "test:stripe-e2e": "npm run test -- src/__tests__/integration/stripe-webhook-e2e.test.ts"
  }
}
```

### Phase 3: Environment-Based Configuration (1 hour)

**Files to Modify:**
1. `backend/src/server.ts`
   - Add startup hook for webhook initialization
   - Log configuration details

2. `backend/.env.example`
   - Document Stripe webhook configuration
   - Add environment-specific URLs

3. `backend/.env.local` (optional)
   - Development overrides

**Startup Flow:**
```
1. Load environment variables
2. Initialize Stripe SDK
3. Call initializeStripeWebhooks()
4. Detect environment (local/staging/production)
5. Register/verify webhook endpoint
6. Store secret in appropriate location
7. Start server
8. All ready - no manual dashboard config needed
```

---

## 💻 Code Architecture

```
┌─────────────────────────────────────────┐
│      Backend Server Startup             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  initializeStripeWebhooks()             │
│  (auto-runs from server.ts)             │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
   ┌─────────────┐  ┌────────────────┐
   │ Detect Env  │  │ Load Stripe SDK│
   └────────────┘  └────────────────┘
        │                 │
        └────────┬────────┘
                 ▼
   ┌─────────────────────────────┐
   │ Get Webhook URL for Env     │
   │ (ngrok/staging/production)  │
   └────────────┬────────────────┘
                │
                ▼
   ┌─────────────────────────────┐
   │ Query Stripe API            │
   │ List webhook endpoints      │
   └────────────┬────────────────┘
                │
        ┌───────┴────────┐
        │                │
    ┌───▼────┐    ┌──────▼──────┐
    │Exists? │    │  Create     │
    │  YES   │    │  NEW        │
    │        │    │ ENDPOINT    │
    └───┬────┘    └──────┬──────┘
        │                │
        └────────┬───────┘
                 ▼
   ┌─────────────────────────────┐
   │ Store Webhook Secret        │
   │ (env var / Vercel / vault)  │
   └────────────┬────────────────┘
                │
                ▼
   ┌─────────────────────────────┐
   │ ✅ Webhook Ready            │
   │ Start accepting events      │
   └─────────────────────────────┘
```

---

## 🧪 Testing Strategy

### Automated Webhook Tests

**Test 1: Endpoint Registration**
```bash
npm run setup:stripe-webhooks
# Expected: ✅ Webhook endpoint configured
```

**Test 2: Webhook Delivery**
```bash
npm run test:webhook-delivery
# Expected: ✅ Balance credited: £5.00
#          ✅ Transaction logged: id=xxx
#          ✅ Idempotency key handled
```

**Test 3: E2E Scene 2 (Complete Billing Flow)**
```bash
npm run test:stripe-e2e
# Expected: 
# ✅ Scene 2: Stripe Checkout → Payment → Webhook → Balance Update
# Duration: <30 seconds
# Zero manual intervention
```

### CI/CD Integration

```yaml
# .github/workflows/test-stripe.yml
name: Stripe Webhook Tests

on: [push, pull_request]

jobs:
  webhook-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Stripe Webhooks
        run: npm run setup:stripe-webhooks
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY_TEST }}
      - name: Test Webhook Delivery
        run: npm run test:webhook-delivery
      - name: Run E2E Tests
        run: npm run test:stripe-e2e
```

---

## 📈 Benefits

### For Development
- ✅ No manual Stripe Dashboard config
- ✅ Automatic on every `npm run dev`
- ✅ Works immediately with ngrok
- ✅ Programmatic testing without browser

### For Testing
- ✅ Automated webhook delivery verification
- ✅ E2E test without user intervention
- ✅ Reproducible test scenarios
- ✅ CI/CD integration ready

### For Production
- ✅ Automatic webhook registration on deployment
- ✅ Multi-environment support
- ✅ Monitoring and alerting
- ✅ Zero downtime configuration

### For DX (Developer Experience)
- ✅ `npm run dev` → everything works
- ✅ No "why isn't the webhook working?" debugging
- ✅ Self-documenting code
- ✅ Foolproof setup

---

## ⚙️ Stripe API Endpoints Used

```typescript
// List webhook endpoints
stripe.webhookEndpoints.list()

// Create webhook endpoint
stripe.webhookEndpoints.create({
  url: string,
  enabled_events: string[],
  version: string
})

// Update webhook endpoint
stripe.webhookEndpoints.update(id, {
  url?: string,
  enabled_events?: string[]
})

// Delete webhook endpoint
stripe.webhookEndpoints.del(id)

// Get webhook endpoint details
stripe.webhookEndpoints.retrieve(id)
```

---

## 🔒 Security Considerations

**Webhook Secret Storage:**
- **Local Dev:** `.env` file (in .gitignore)
- **Staging:** Vercel Environment Variables
- **Production:** AWS Secrets Manager / HashiCorp Vault

**Signature Validation:**
- ✅ Every webhook must have valid `Stripe-Signature` header
- ✅ Verified using webhook secret
- ✅ Timestamp validation (reject old events)
- ✅ Replay attack prevention

**Error Handling:**
- ✅ Invalid signatures → 401 Unauthorized
- ✅ Duplicate events → 200 OK (idempotent)
- ✅ Processing errors → retry with backoff
- ✅ Permanent failures → alert + log

---

## 📋 Migration Path

**Today (Manual):** 
```bash
# User manually configures Stripe Dashboard
# User copies webhook secret to .env
npm run dev
```

**After Implementation (Automatic):**
```bash
# Just run dev - webhook automatically configured
npm run dev
# Output: ✅ Webhook endpoint configured
```

**No Breaking Changes:**
- Existing manual configuration still works
- New automation is opt-in
- Gradual migration for existing deployments

---

## 🎯 Success Metrics

After implementation:
- ✅ Zero manual Stripe Dashboard configuration needed
- ✅ Webhook tests pass in <30 seconds
- ✅ E2E Scene 2 test fully automated
- ✅ Works on local/staging/production without code changes
- ✅ Developer can run `npm run dev` and everything works
- ✅ CI/CD pipeline tests webhook delivery automatically

---

## 📝 Next Steps

1. **Review This Plan** → Approve approach
2. **Implement Phase 1** → Automated endpoint registration (2 hours)
3. **Implement Phase 2** → Automated webhook testing (1.5 hours)
4. **Implement Phase 3** → Environment-based config (1 hour)
5. **Test Locally** → Verify ngrok + webhook work automatically
6. **Document** → Update setup guides
7. **Deploy to Staging** → Test in cloud environment
8. **Deploy to Production** → Zero-manual-config deployment

**Total Effort:** 4.5 hours of implementation  
**Payoff:** Eliminates manual configuration for entire team for all future deployments

---

**This approach transforms Stripe webhook setup from a manual, error-prone process into a foolproof, automated system.**

