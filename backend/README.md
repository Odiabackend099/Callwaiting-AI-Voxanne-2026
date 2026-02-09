# Voxanne AI Backend

**Status:** Production-Ready ✅
**Version:** 1.0.0
**Last Updated:** February 9, 2026

---

## ⚠️ CRITICAL: Configuration Rules

**Before modifying ANY backend configuration, credential handling, or telephony code:**

### Required Reading

1. **[CONFIGURATION_CRITICAL_INVARIANTS.md](../CONFIGURATION_CRITICAL_INVARIANTS.md)**
   - 7 rules that MUST NOT be broken
   - Credential hierarchy (Platform vs Tenant vs Master)
   - ENCRYPTION_KEY requirements
   - Master credentials usage rules
   - Startup validation requirements

2. **[PROVISIONING_FLOWS.md](../PROVISIONING_FLOWS.md)**
   - BYOC provisioning flow (sequence diagrams)
   - Managed telephony provisioning flow
   - Credential resolution chain
   - Encryption/decryption pipeline

3. **[AGENT_TEAM_COORDINATION.md](../AGENT_TEAM_COORDINATION.md)**
   - 5-agent team structure
   - Team coordination process
   - Agent roles and responsibilities

### Quick Validation

Before starting the backend:

```bash
npm run validate-env
```

**Expected Output (Success):**
```
✅ ENCRYPTION_KEY: Valid 64-character hex format
✅ TWILIO_MASTER_ACCOUNT_SID: Valid format (ACe18...)
✅ TWILIO_MASTER_AUTH_TOKEN: Valid format
✅ VAPI_PRIVATE_KEY: Valid UUID format
✅ Supabase connection: Successful
✅ Encryption round-trip: Successful

🎉 ALL VALIDATION CHECKS PASSED - backend ready to start!
```

**If Validation Fails:**
- Fix errors listed in output
- Reference: CONFIGURATION_CRITICAL_INVARIANTS.md
- Run validation again until all checks pass

---

## Getting Started

### Prerequisites

- **Node.js:** 20.0.0 or higher
- **npm:** 9.0.0 or higher
- **Redis:** 6.0.0 or higher (for webhook queue)
- **Twilio Account:** For SMS and managed telephony
- **Vapi Account:** For voice AI
- **Supabase Account:** For database

### Installation

```bash
# Clone repository
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Generate ENCRYPTION_KEY
openssl rand -hex 32

# Edit .env with your credentials
nano .env

# Validate configuration
npm run validate-env

# Start backend
npm run dev
```

### Environment Variables

**Critical (Required):**
- `SUPABASE_URL` - Database connection URL
- `SUPABASE_SERVICE_ROLE_KEY` - Database authentication
- `VAPI_PRIVATE_KEY` - Voice AI platform
- `TWILIO_ACCOUNT_SID` - SMS and managed telephony
- `TWILIO_AUTH_TOKEN` - Twilio authentication
- `TWILIO_PHONE_NUMBER` - SMS sender identity
- `ENCRYPTION_KEY` - Master encryption key (64-char hex)

**Optional (Recommended):**
- `TWILIO_MASTER_ACCOUNT_SID` - Managed telephony provisioning
- `TWILIO_MASTER_AUTH_TOKEN` - Master account authentication
- `GOOGLE_CLIENT_ID` - Calendar integration
- `GOOGLE_CLIENT_SECRET` - OAuth authentication
- `REDIS_URL` - Webhook queue and caching
- `SENTRY_DSN` - Error tracking
- `SLACK_BOT_TOKEN` - Alerts and notifications

**See:** `CONFIGURATION_CRITICAL_INVARIANTS.md` for detailed requirements

---

## Architecture

### Three-Tier Credential System

1. **Platform Secrets** (in .env)
   - ENCRYPTION_KEY, VAPI_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY
   - Global for all organizations

2. **Tenant Secrets** (in database, encrypted)
   - Twilio credentials, Google Calendar tokens
   - Per-organization, encrypted with ENCRYPTION_KEY

3. **Master Account** (in .env)
   - TWILIO_MASTER_ACCOUNT_SID, TWILIO_MASTER_AUTH_TOKEN
   - For managed telephony (provisioning numbers)

### Key Services

| Service | Purpose | Critical Files |
|---------|---------|----------------|
| **IntegrationDecryptor** | Decrypt tenant credentials | `src/services/integration-decryptor.ts` |
| **EncryptionService** | AES-256-GCM encryption/decryption | `src/services/encryption.ts` |
| **VapiClient** | Voice AI API client | `src/services/vapi-client.ts` |
| **ManagedTelephonyService** | Provision phone numbers | `src/services/managed-telephony-service.ts` |
| **TwilioService** | SMS sending | `src/services/twilio-service.ts` |

---

## Development

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (validates env first) |
| `npm run build` | Build for production |
| `npm run start` | Start production server (validates env first) |
| `npm run validate-env` | Pre-flight environment validation |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests |

### Adding New Features

**When modifying configuration or credentials:**

1. ✅ Read CONFIGURATION_CRITICAL_INVARIANTS.md
2. ✅ Check if any of 7 rules apply to your change
3. ✅ Reference rule numbers in your PR description
4. ✅ Run `npm run validate-env` after changes
5. ✅ Get approval from Technical Architecture agent
6. ✅ Test in staging before production

**Example PR Description:**
```markdown
## Changes Made
- Updated Twilio credential handling for subaccounts

## Rules Verified
- ✅ Rule 7: Master credentials used for Vapi import
- ✅ ENCRYPTION_KEY not changed
- ✅ No hardcoded credentials added

## Testing
- [x] npm run validate-env passes
- [x] Backend starts without errors
- [x] Integration tests pass
- [x] Provisioning flow tested in staging

Reference: CONFIGURATION_CRITICAL_INVARIANTS.md (Rule 7)
```

---

## Deployment

### Pre-Deployment Checklist

- [ ] `npm run validate-env` passes all checks
- [ ] `npm run build` succeeds without errors
- [ ] `npm test` passes (all unit + integration tests)
- [ ] ENCRYPTION_KEY not changed (or migration plan executed)
- [ ] All 7 Critical Invariants verified
- [ ] Staging environment tested
- [ ] Rollback plan documented

### Deployment Steps

1. **Validate Environment:**
   ```bash
   npm run validate-env
   ```

2. **Run Tests:**
   ```bash
   npm run test
   ```

3. **Build for Production:**
   ```bash
   npm run build
   ```

4. **Deploy to Platform:**
   ```bash
   # Render.com, Vercel, or custom deployment
   git push production main
   ```

5. **Verify Health:**
   ```bash
   curl https://api.voxanne.ai/health
   # Expected: {"status":"ok","uptime":123456}
   ```

6. **Monitor Logs:**
   ```bash
   # Check for errors in first 5 minutes
   tail -f logs/backend.log
   ```

---

## Troubleshooting

### Backend Won't Start

**Error:** `Missing required environment variable: ENCRYPTION_KEY`

**Fix:**
```bash
# Generate new key
openssl rand -hex 32

# Add to .env
echo "ENCRYPTION_KEY=<generated-key>" >> .env

# Restart
npm run dev
```

### "Failed to decrypt credentials"

**Error:** `EncryptionService.decrypt() failed`

**Fix:**
- Verify ENCRYPTION_KEY is correct (not changed)
- Check database has encrypted_config column
- Verify org_credentials table accessible

### "Twilio authentication failed"

**Error:** `401 Unauthorized from Twilio API`

**Fix:**
```bash
# Verify credentials at https://console.twilio.com
# Update .env with correct values:
TWILIO_MASTER_ACCOUNT_SID=AC...
TWILIO_MASTER_AUTH_TOKEN=...

# Test connection
npm run validate-env
```

### "No phone number available"

**Error:** `vapi_phone_number_id is NULL`

**Fix:**
- Re-save agent configuration in dashboard
- Or provision managed number via `/api/managed-telephony/provision`

---

## Support

**Documentation:**
- [CONFIGURATION_CRITICAL_INVARIANTS.md](../CONFIGURATION_CRITICAL_INVARIANTS.md) - Critical rules
- [PROVISIONING_FLOWS.md](../PROVISIONING_FLOWS.md) - Visual flow diagrams
- [AGENT_TEAM_COORDINATION.md](../AGENT_TEAM_COORDINATION.md) - Team structure

**Team:**
- **Slack:** #voxanne-backend-config
- **Email:** backend-team@voxanne.ai
- **On-Call:** 24/7 rotating schedule

**Emergency:**
- **Critical Outage:** Slack @platform-owner
- **Security Incident:** Slack @security-team
- **Data Loss:** Contact all agents immediately

---

## License

Proprietary - Voxanne AI
