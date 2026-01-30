# Deployment Guide - Voxanne AI

**Last Updated:** 2026-01-30
**Status:** Production Ready
**Deployment Targets:** Render (Backend), Vercel (Frontend), Supabase (Database)

---

## Quick Start

1. **Backend:** Deploy to Render using `render.yaml` at root
2. **Frontend:** Deploy to Vercel from GitHub
3. **Domain:** Configure `voxanne.ai` with DNS records
4. **Environment:** Set all required variables in platform dashboards

---

## Architecture Overview

```
Frontend (Next.js)
    ↓
Vercel (voxanne.ai)
    ↓
Backend (Express)
    ↓
Render (api.voxanne.ai)
    ↓
Database (PostgreSQL)
    ↓
Supabase (lbjymlodxprzqgtyqtcq)
```

---

## Configuration Files

### render.yaml (Root)
Monorepo configuration for Render deployment with frontend + backend + database services.

**Services:**
- Frontend: Next.js (port 3000)
- Backend: Express (port 3001)

**Current URLs:**
- Backend: https://callwaitingai-backend-sjbi.onrender.com
- Frontend: https://callwaiting-ai-frontend.onrender.com

---

## Required Environment Variables

### Frontend (Vercel Dashboard)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from .env.example>

# Backend API
NEXT_PUBLIC_BACKEND_URL=https://api.voxanne.ai

# Application URLs
NEXT_PUBLIC_APP_URL=https://voxanne.ai

# Features
NEXT_PUBLIC_ENABLE_PWA=true
```

### Backend (Render Dashboard)

#### Critical Variables (MUST SET FIRST)

```env
# Environment
NODE_ENV=production
PORT=3001

# Supabase
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Vapi Integration
VAPI_PRIVATE_KEY=<your-vapi-private-key>
VAPI_WEBHOOK_SECRET=<your-vapi-webhook-secret>

# Encryption
ENCRYPTION_KEY=<64-character-hex-string>

# URLs
BACKEND_URL=https://api.voxanne.ai
FRONTEND_URL=https://voxanne.ai
CORS_ORIGIN=https://voxanne.ai
```

#### Missing from .env.example (ADD THESE)

```env
# Redis (Required for queues + caching)
REDIS_URL=redis://username:password@host:port
# Recommendation: Use Redis Cloud (upstash.com) or Redis Labs
# Example: redis://default:your-token@your-endpoint:your-port

# Monitoring & Error Tracking
SENTRY_DSN=https://key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Slack Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERTS_CHANNEL=#engineering-alerts

# Stripe Billing (if using subscription features)
STRIPE_SECRET_KEY=sk_live_your-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-secret-here
STRIPE_PRICE_ID=price_your-price-id

# Google OAuth (for SSO)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Twilio (if using SMS features)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Google Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret

# Logging
LOG_LEVEL=info
```

---

## Step-by-Step Deployment

### Phase 1: Prepare Secrets & Credentials (30 minutes)

1. **Generate Encryption Key**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Redis Setup (Choose One)**
   - **Option A: Upstash (Recommended for Render)**
     - Go to https://upstash.com
     - Create free Redis database
     - Copy connection URL

   - **Option B: Redis Cloud**
     - Go to https://redislabs.com
     - Create free tier database
     - Copy connection string

3. **Sentry Setup**
   - Go to https://sentry.io
   - Create new project (Node.js)
   - Copy DSN
   - Set environment to `production`

4. **Slack Webhook**
   - Go to your Slack workspace settings
   - Create Incoming Webhook
   - Copy webhook URL

### Phase 2: Deploy Backend to Render (15 minutes)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "chore: prepare for production deployment"
   git push origin main
   ```

2. **Create Render Service** (if not already created)
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Select branch: `main`
   - Configure:
     - Name: `voxanne-api`
     - Runtime: `Node`
     - Build Command: `npm install && npm run build`
     - Start Command: `npm start`
     - Instance Type: Starter ($7/month)

3. **Set Environment Variables**
   - In Render dashboard → Environment
   - Add all variables from "Backend (Render Dashboard)" section above
   - Redeploy after setting variables

4. **Verify Backend**
   ```bash
   curl https://api.voxanne.ai/health
   # Expected: {"status":"ok","timestamp":"2026-01-30T..."}
   ```

### Phase 3: Deploy Frontend to Vercel (15 minutes)

1. **Push to GitHub** (already done in Phase 2)

2. **Import to Vercel**
   - Go to https://vercel.com
   - Click "Add New..." → "Project"
   - Import GitHub repository
   - Select framework: "Next.js"

3. **Configure Project Settings**
   - Project name: `voxanne-ai`
   - Framework: Next.js
   - Root directory: (leave empty)
   - Build command: (auto)
   - Output directory: (auto)

4. **Set Environment Variables**
   - Go to Settings → Environment Variables
   - Add all variables from "Frontend (Vercel Dashboard)" section
   - Redeploy after setting variables

5. **Verify Frontend**
   - Visit https://voxanne.vercel.app
   - Verify page loads and API connectivity

### Phase 4: Configure Domain (voxanne.ai) (30 minutes)

#### Option A: Vercel Automatic Setup (Recommended)

1. **Add Domain to Vercel**
   - Vercel Dashboard → Project → Settings → Domains
   - Add domain: `voxanne.ai`
   - Vercel shows nameserver instructions
   - Update domain registrar nameservers to Vercel's

2. **Verify Domain**
   - Vercel auto-verifies when nameservers propagate (24-48 hours)
   - Check DNS: `nslookup voxanne.ai`

#### Option B: Manual DNS Setup

1. **Add A Records** (at domain registrar)
   ```
   Type     Name              Value
   A        voxanne.ai        76.76.19.165   (Vercel IP)
   CNAME    www               voxanne.ai
   CNAME    api               callwaitingai-backend-sjbi.onrender.com
   ```

2. **Add API Subdomain to Render**
   - Render Dashboard → Backend Service → Custom Domains
   - Add: `api.voxanne.ai`
   - Point to: `callwaitingai-backend-sjbi.onrender.com`

3. **Verify DNS Propagation**
   ```bash
   # Check frontend
   nslookup voxanne.ai

   # Check backend
   nslookup api.voxanne.ai

   # Test API connectivity
   curl https://api.voxanne.ai/health
   ```

### Phase 5: Verify Deployment (20 minutes)

**Frontend Tests:**
```bash
# Test homepage loads
curl https://voxanne.ai | grep -q "Voxanne" && echo "✅ Frontend working"

# Test API connectivity
curl https://voxanne.ai/api/health 2>/dev/null | grep -q "ok" && echo "✅ API reachable"
```

**Backend Tests:**
```bash
# Health check
curl https://api.voxanne.ai/health

# Vapi integration check
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.voxanne.ai/health/vapi

# Database connectivity
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.voxanne.ai/health/database
```

**Full Feature Tests:**
1. Create organization at https://voxanne.ai/signup
2. Test inbound call (if Vapi configured)
3. Test appointment booking (if calendar connected)
4. Check call logs in dashboard

---

## Monitoring & Alerts

### Sentry Configuration
1. Dashboard → Issues: View all errors
2. Alerts → Create Alert Rule: Email on critical errors
3. Set up integration: Slack channel notifications

### Slack Alerts
- Critical errors auto-post to `#engineering-alerts`
- High error rates trigger warnings
- Database issues trigger notifications

### Uptime Monitoring
Optional: Set up UptimeRobot
- Monitor: https://api.voxanne.ai/health (5-minute interval)
- Alert: ops@voxanne.ai if down for 10 minutes

---

## Troubleshooting

### Frontend Not Loading
```bash
# Check Vercel deployment logs
vercel logs voxanne-ai --prod

# Verify backend API is reachable
curl https://api.voxanne.ai/health

# Check environment variables in Vercel dashboard
```

### Backend Errors
```bash
# Check Render logs
# Render Dashboard → Backend Service → Logs

# Verify environment variables are set
# Render Dashboard → Environment

# Check database connectivity
curl -H "Authorization: Bearer $AUTH_TOKEN" https://api.voxanne.ai/health/database
```

### Database Connection Issues
```sql
-- Check Supabase database
-- Supabase Dashboard → SQL Editor
SELECT version();  -- Should return PostgreSQL version
```

### Domain Not Resolving
```bash
# Check DNS propagation
nslookup voxanne.ai
nslookup api.voxanne.ai

# Force DNS refresh
sudo dscacheutil -flushcache  # macOS
ipconfig /flushdns           # Windows
systemctl restart nscd       # Linux
```

---

## Post-Deployment Checklist

- [ ] Backend deployed and responding to `/health`
- [ ] Frontend deployed and loading
- [ ] Domain `voxanne.ai` resolves to Vercel
- [ ] API subdomain `api.voxanne.ai` resolves to Render
- [ ] All environment variables set
- [ ] Sentry receiving error reports
- [ ] Slack webhooks posting alerts
- [ ] Redis connection working (if queue job runs successfully)
- [ ] Test organization created via signup
- [ ] Inbound call test successful
- [ ] Appointment booking test successful
- [ ] Dashboard call logs displaying correctly

---

## Security Best Practices

1. **Never commit secrets** - All variables set via dashboard, not `.env` files
2. **Rotate API keys regularly** - Every 90 days for production keys
3. **Use strong encryption keys** - 64-character random hex strings
4. **Monitor access logs** - Review Sentry for suspicious activity
5. **Enable 2FA** - Vercel and Render accounts
6. **Database backups** - Supabase handles automatically (30-day retention)

---

## Rollback Procedure

If deployment fails:

1. **Frontend Rollback**
   ```bash
   # Vercel automatically keeps previous deployments
   # Go to Deployments tab, click older version, promote to production
   ```

2. **Backend Rollback**
   ```bash
   # Render keeps deployment history
   # Dashboard → Deploys tab → Select previous version → Rollback
   ```

3. **Database Rollback** (if data corrupted)
   - Contact Supabase support
   - Restore from backup (24-hour PITR available)

---

## Related Documentation

- [Operational Runbook](RUNBOOK.md) - How to handle common issues
- [Disaster Recovery Plan](DISASTER_RECOVERY_PLAN.md) - Recovery procedures
- [Rollback Procedures](ROLLBACK_PROCEDURES.md) - Detailed rollback steps
- [Contribution Guidelines](CONTRIBUTING.md) - Development setup

---

**Next Steps:**
1. Set up Redis on Upstash or Redis Cloud
2. Generate encryption key
3. Create Sentry project
4. Create Slack webhook
5. Deploy backend to Render
6. Deploy frontend to Vercel
7. Configure domain DNS
8. Run verification tests
9. Monitor first 24 hours for errors

**Estimated Total Time:** 2-3 hours (mostly waiting for DNS propagation)
