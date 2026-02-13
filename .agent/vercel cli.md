# Vercel CLI Deployment Guide

**Purpose:** Reference for AI agents and developers to deploy Voxanne AI to Vercel using the Vercel CLI and authentication token.

**Last Updated:** 2026-02-13
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Authentication with Token](#authentication-with-token)
4. [Deployment Steps](#deployment-steps)
5. [Monitoring & Verification](#monitoring--verification)
6. [Troubleshooting](#troubleshooting)
7. [Production URLs](#production-urls)

---

## Prerequisites

### Required Software

- **Node.js:** ≥20.0.0 (verify with `node --version`)
- **npm:** ≥9.0.0 (verify with `npm --version`)
- **Vercel CLI:** (will be installed)
- **Git:** For version control (verify with `git --version`)

### Required Credentials

- **Vercel Token:** Personal access token from Vercel account
  - Value: `aF8XCJ7H06Xr6gA7lcfXJ4Az`
  - Purpose: Authenticate CLI without login prompt
  - Storage: Use as environment variable `VERCEL_TOKEN`

### Project Requirements

- Git repository initialized
- All changes committed
- Environment variables configured
- `.env.local` populated with secrets (kept out of git)

---

## Installation

### Step 1: Check if Vercel CLI is Installed

```bash
vercel --version
```

**Expected Output:**
```
Vercel CLI 49.1.2 (or higher)
```

**If not installed**, proceed to Step 2.

### Step 2: Install Vercel CLI

```bash
npm install -g vercel
```

**Or with yarn:**
```bash
yarn global add vercel
```

**Verify Installation:**
```bash
vercel --version
```

---

## Authentication with Token

### Why Use Token-Based Authentication?

- No interactive login prompt
- Suitable for CI/CD pipelines
- Works in automated deployments
- Programmatic access without manual intervention

### Method 1: Environment Variable (Recommended for Automation)

**Set the token as an environment variable:**

```bash
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

**Verify the token is set:**

```bash
echo $VERCEL_TOKEN
```

**Expected Output:**
```
aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### Method 2: Pass Token as CLI Flag

**Deploy with token flag (one-time):**

```bash
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### Method 3: Interactive Authentication (For Manual Use)

**If you prefer interactive login:**

```bash
vercel login
```

**Note:** This method requires manual interaction and is not suitable for automation.

---

## Deployment Steps

### Step 1: Navigate to Project Root

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
```

**Verify you're in the correct directory:**

```bash
pwd
ls package.json
```

**Expected Output:**
```
/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
package.json
```

### Step 2: Set Environment Variables

**Option A: Set token in current shell session (temporary):**

```bash
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

**Option B: Verify token is already set:**

```bash
echo $VERCEL_TOKEN
```

### Step 3: Deploy to Production

**Deploy with production flag:**

```bash
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

**Or with environment variable:**

```bash
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
vercel deploy --prod
```

### Step 4: Monitor Build Process

**Expected Output Timeline:**

```
Vercel CLI 49.1.2
Retrieving project…
Deploying odia-backends-projects/callwaiting-ai-voxanne-2026
Uploading [==================] (1.1MB/1.1MB)
Inspect: https://vercel.com/odia-backends-projects/callwaiting-ai-voxanne-2026/CeSCB8e6GobsWpZ53MCazdN2KyjX [25s]
Production: https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app [25s]
Building...
Building: Running build in Washington, D.C., USA (East) – iad1
Building: Running "next build"
Building: ✓ Compiled successfully
Building: Generating static pages (66/66)
Building: ✓ Finalizing page optimization ...
Production: https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app [54s]
Deployment completed
```

### Step 5: Access Production URL

**The deployment will output a production URL:**

```
https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app
```

**Or view the latest deployment:**

```bash
vercel inspect callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app --logs
```

---

## Deployment Options

### Quick Deploy (Default)

```bash
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### Deploy with Custom Build Command

```bash
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az --build-env NEXT_PUBLIC_API_URL=https://api.example.com
```

### Deploy Specific Directory

```bash
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az /path/to/subdirectory
```

### Preview Deployment (Non-Production)

```bash
vercel deploy --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

**Note:** This creates a preview URL without affecting production.

---

## Monitoring & Verification

### Check Build Status

```bash
vercel status
```

### View Recent Deployments

```bash
vercel list
```

### Inspect a Specific Deployment

```bash
vercel inspect <deployment-url>
```

### View Deployment Logs

```bash
vercel inspect callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app --logs
```

### Monitor in Real-Time

```bash
vercel logs <deployment-url> --follow
```

---

## Testing Deployment

### Test 1: Check Homepage

```bash
curl -s https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app/ | head -c 200
```

### Test 2: Check Form Page

```bash
curl -s https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app/start | grep -c "Reception Greeting"
```

### Test 3: Check API Endpoints

```bash
curl -s https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app/api/status
```

### Test 4: Full Verification Script

Create `/tmp/verify_deployment.sh`:

```bash
#!/bin/bash

PROD_URL="https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app"

echo "🧪 Verifying Vercel Deployment"
echo "======================================"

# Test homepage
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/")
echo "Homepage status: $STATUS"

# Test form page
FORM=$(curl -s "$PROD_URL/start" | grep -c "Reception Greeting" 2>/dev/null)
echo "Form page found: $([[ $FORM -gt 0 ]] && echo 'YES' || echo 'NO')"

# Test API
API=$(curl -s -X POST "$PROD_URL/api/onboarding-intake" \
  -F "company=Test" \
  -F "email=test@example.com" \
  -F "phone=+1-555-1234" \
  -F "greeting_script=Hello")
echo "API response: $(echo "$API" | head -c 100)"

echo "======================================"
```

Run verification:

```bash
chmod +x /tmp/verify_deployment.sh && /tmp/verify_deployment.sh
```

---

## Troubleshooting

### Issue 1: "No existing credentials found"

**Problem:**
```
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

**Solution:**

```bash
# Option A: Use token flag
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az

# Option B: Set environment variable
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
vercel deploy --prod
```

### Issue 2: "Unauthorized"

**Problem:**
```
Error: Unauthorized
```

**Solution:**
- Verify token is correct
- Check token hasn't expired
- Verify token permissions in Vercel dashboard
- Try a fresh token if needed

### Issue 3: Build Fails

**Problem:**
```
Building: ✗ Build failed
```

**Solution:**

```bash
# Check build logs
vercel inspect <deployment-url> --logs

# Run build locally first
npm run build

# Fix any errors then redeploy
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### Issue 4: Environment Variables Missing

**Problem:**
```
Error: Database connection failed - SUPABASE_URL not set
```

**Solution:**

```bash
# Check Vercel environment variables
vercel env list

# Set missing variables in Vercel dashboard
vercel env add SUPABASE_URL <value>

# Or deploy with env vars
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az \
  --build-env SUPABASE_URL=https://example.supabase.co
```

### Issue 5: Port Conflicts

**Problem:**
```
Error: Port 3000 is already in use
```

**Solution:**
- Kill existing process: `pkill -f "node"` or `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- Wait a few seconds
- Retry deployment

### Issue 6: Authentication Timeout

**Problem:**
```
Error: Timeout during authentication
```

**Solution:**
- Check internet connection
- Verify Vercel API is accessible
- Try again in a few moments
- Use explicit token instead of interactive login

---

## Environment Variables

### Required Vercel Configuration

Add to Vercel dashboard (Settings → Environment Variables):

```
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-key>
VAPI_API_KEY=<your-key>
STRIPE_SECRET_KEY=<your-key>
STRIPE_PUBLISHABLE_KEY=<your-key>
RESEND_API_KEY=<your-key>
DATABASE_URL=<your-url>
```

### Deployment Command

```bash
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
vercel deploy --prod
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: |
          npm install -g vercel
          vercel deploy --prod --token=$VERCEL_TOKEN
```

### Manual CI/CD Command

```bash
#!/bin/bash
set -e

export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

echo "🚀 Starting Vercel deployment..."
vercel deploy --prod

echo "✅ Deployment complete!"
```

---

## Production URLs

### Current Production Deployment

**Main URL:**
```
https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app
```

**Key Pages:**
- Form: `/start`
- Dashboard: `/dashboard`
- Login: `/sign-in`
- API: `/api/*`

### Vercel Dashboard

Access your deployments at:
```
https://vercel.com/odia-backends-projects/callwaiting-ai-voxanne-2026
```

---

## Quick Reference Commands

### For AI Agents - Complete Deployment Workflow

```bash
# 1. Set authentication token
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az

# 2. Navigate to project
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

# 3. Deploy to production
vercel deploy --prod

# 4. Verify deployment
echo "✅ Deployment complete!"
echo "Production URL: https://callwaiting-ai-voxanne-2026-o3alssuf4-odia-backends-projects.vercel.app"
```

### For Developers - Standard Workflow

```bash
# 1. Check CLI version
vercel --version

# 2. Deploy
vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az

# 3. View logs
vercel logs <deployment-url> --follow

# 4. Check status
vercel status
```

---

## Best Practices

1. **Always verify build locally before deploying:**
   ```bash
   npm run build
   ```

2. **Set environment variables in Vercel dashboard, not in code:**
   - Navigate to Project Settings → Environment Variables
   - Add all required variables
   - Ensure they're set for Production environment

3. **Use the token flag explicitly:**
   ```bash
   vercel deploy --prod --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
   ```

4. **Monitor deployments:**
   ```bash
   vercel inspect <deployment-url> --logs
   ```

5. **Keep token secure:**
   - Use environment variables, not hardcoded
   - Rotate token periodically in Vercel dashboard
   - Never commit token to git

6. **Test production URLs:**
   - Access the deployed site
   - Test critical functionality
   - Check API endpoints
   - Verify email delivery

---

## Advanced Usage

### Rollback to Previous Deployment

```bash
vercel rollback --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### Promote Deployment to Production

```bash
vercel promote <deployment-url> --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### Remove Deployment

```bash
vercel remove <deployment-url> --token=aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### View Project Configuration

```bash
vercel ls
```

---

## Support Resources

- **Official Docs:** https://vercel.com/docs/cli
- **Troubleshooting:** https://vercel.com/support
- **Community:** https://github.com/vercel/vercel/discussions

---

## Summary

**To deploy Voxanne AI to Vercel using CLI:**

```bash
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
vercel deploy --prod
```

**Expected time:** 30-60 seconds
**Success indicator:** "Production: https://..." URL displayed
**Status:** ✅ Production ready

---

**Last Updated:** 2026-02-13
**Version:** 1.0
**Status:** Production Ready
