# Domain Deployment & Configuration Skill

## Purpose
Automate domain configuration, Vercel deployment, DNS setup, and debugging for callwaitingai.dev and www.callwaitingai.dev.

## Skill Definition

### 1. Pre-Deployment Validation
**Objective:** Verify all prerequisites before deploying to Vercel

**Checks:**
- [ ] Environment variables are properly configured
- [ ] No secrets exposed in client-side code
- [ ] Build succeeds locally
- [ ] All auth redirects use NEXT_PUBLIC_APP_URL
- [ ] Dashboard has auth protection
- [ ] Performance optimizations applied

**Implementation:**
```bash
#!/bin/bash
# Pre-deployment validation script

echo "🔍 Pre-Deployment Validation"

# 1. Check environment variables
echo "✓ Checking environment variables..."
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL not set"
    exit 1
fi

# 2. Check for exposed secrets
echo "✓ Checking for exposed secrets..."
if grep -r "SUPABASE_SERVICE_ROLE_KEY" src/; then
    echo "❌ Service role key exposed in client code"
    exit 1
fi

# 3. Build test
echo "✓ Testing build..."
npm run build || exit 1

# 4. Verify auth protection
echo "✓ Verifying dashboard auth protection..."
grep -q "useAuth()" src/app/dashboard/page.tsx || {
    echo "❌ Dashboard missing auth protection"
    exit 1
}

echo "✅ All pre-deployment checks passed"
```

---

### 2. Vercel Deployment
**Objective:** Deploy to Vercel with proper configuration

**Steps:**
1. Install Vercel CLI
2. Link project to Vercel (if not already linked)
3. Set environment variables in Vercel
4. Deploy to production
5. Verify deployment succeeded

**Implementation:**
```bash
#!/bin/bash
# Vercel deployment script

VERCEL_TOKEN="${VERCEL_TOKEN}"
PROJECT_NAME="roxan-frontend"
DOMAIN_PRIMARY="callwaitingai.dev"
DOMAIN_WWW="www.callwaitingai.dev"

echo "🚀 Deploying to Vercel"

# 1. Deploy
echo "Deploying to Vercel..."
vercel deploy --prod --token "$VERCEL_TOKEN" || {
    echo "❌ Deployment failed"
    exit 1
}

echo "✅ Deployment successful"
```

---

### 3. Domain Configuration
**Objective:** Configure DNS and domain routing

**Primary Domain (callwaitingai.dev):**
- Point to Vercel nameservers
- Configure A records
- Enable HTTPS

**WWW Subdomain (www.callwaitingai.dev):**
- Create CNAME record pointing to primary domain
- Redirect to primary domain (optional)

**Implementation:**
```bash
#!/bin/bash
# Domain configuration script

DOMAIN_PRIMARY="callwaitingai.dev"
DOMAIN_WWW="www.callwaitingai.dev"
VERCEL_NAMESERVERS=(
    "ns1.vercel-dns.com"
    "ns2.vercel-dns.com"
)

echo "🌐 Configuring domains"

# 1. Verify domain is registered
echo "Checking domain registration..."
whois "$DOMAIN_PRIMARY" | grep -q "Registrar" || {
    echo "⚠️  Domain may not be registered or whois lookup failed"
}

# 2. Check current nameservers
echo "Current nameservers for $DOMAIN_PRIMARY:"
dig NS "$DOMAIN_PRIMARY" +short

# 3. Instructions for domain provider
cat << EOF
📋 Domain Configuration Instructions:

1. Log in to your domain registrar (Namecheap, GoDaddy, etc.)
2. Find DNS/Nameserver settings for $DOMAIN_PRIMARY
3. Update nameservers to:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
4. Wait 24-48 hours for DNS propagation

Alternative (if nameserver change not available):
1. Add A record: 76.76.19.165 (Vercel IP)
2. Add CNAME for www: $DOMAIN_PRIMARY

Verify with:
  dig $DOMAIN_PRIMARY
  dig www.$DOMAIN_PRIMARY
EOF
```

---

### 4. DNS Verification
**Objective:** Verify DNS is properly configured

**Checks:**
- [ ] Primary domain resolves to Vercel IP
- [ ] WWW subdomain resolves correctly
- [ ] SSL certificate is valid
- [ ] Domain is accessible via HTTPS

**Implementation:**
```bash
#!/bin/bash
# DNS verification script

DOMAIN_PRIMARY="callwaitingai.dev"
DOMAIN_WWW="www.callwaitingai.dev"
VERCEL_IP="76.76.19.165"

echo "🔐 Verifying DNS Configuration"

# 1. Check primary domain
echo "Checking $DOMAIN_PRIMARY..."
PRIMARY_IP=$(dig +short "$DOMAIN_PRIMARY" A | head -1)
if [ "$PRIMARY_IP" = "$VERCEL_IP" ]; then
    echo "✅ $DOMAIN_PRIMARY resolves to Vercel IP"
else
    echo "⚠️  $DOMAIN_PRIMARY resolves to $PRIMARY_IP (expected $VERCEL_IP)"
fi

# 2. Check WWW subdomain
echo "Checking $DOMAIN_WWW..."
WWW_CNAME=$(dig +short "$DOMAIN_WWW" CNAME | head -1)
if [ -n "$WWW_CNAME" ]; then
    echo "✅ $DOMAIN_WWW CNAME: $WWW_CNAME"
else
    echo "⚠️  $DOMAIN_WWW CNAME not found"
fi

# 3. Check HTTPS
echo "Checking HTTPS..."
curl -I "https://$DOMAIN_PRIMARY" 2>/dev/null | grep -q "200\|301\|302" && {
    echo "✅ HTTPS working for $DOMAIN_PRIMARY"
} || {
    echo "❌ HTTPS not working for $DOMAIN_PRIMARY"
}

# 4. Check SSL certificate
echo "Checking SSL certificate..."
openssl s_client -connect "$DOMAIN_PRIMARY:443" -servername "$DOMAIN_PRIMARY" < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

---

### 5. Deployment Verification
**Objective:** Verify deployed application is working correctly

**Checks:**
- [ ] Homepage loads
- [ ] Login page accessible
- [ ] Dashboard redirects unauthenticated users
- [ ] Auth flow works
- [ ] Performance is acceptable
- [ ] No console errors

**Implementation:**
```bash
#!/bin/bash
# Deployment verification script

DOMAIN="https://callwaitingai.dev"

echo "✅ Verifying Deployment"

# 1. Check homepage
echo "Testing homepage..."
curl -s "$DOMAIN" | grep -q "CallWaiting AI" && {
    echo "✅ Homepage loads"
} || {
    echo "❌ Homepage failed"
    exit 1
}

# 2. Check login page
echo "Testing login page..."
curl -s "$DOMAIN/login" | grep -q "Login" && {
    echo "✅ Login page accessible"
} || {
    echo "❌ Login page failed"
    exit 1
}

# 3. Check dashboard redirect
echo "Testing dashboard auth protection..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/dashboard")
if [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
    echo "✅ Dashboard redirects unauthenticated users"
else
    echo "⚠️  Dashboard returned status $STATUS"
fi

# 4. Performance check
echo "Testing performance..."
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$DOMAIN")
echo "Response time: ${RESPONSE_TIME}s"
if (( $(echo "$RESPONSE_TIME < 3" | bc -l) )); then
    echo "✅ Performance acceptable"
else
    echo "⚠️  Performance slow (${RESPONSE_TIME}s)"
fi

echo "✅ Deployment verification complete"
```

---

### 6. Troubleshooting & Debugging
**Objective:** Diagnose and fix common issues

**Common Issues:**

#### Issue: Domain not resolving
**Diagnosis:**
```bash
# Check DNS propagation
dig callwaitingai.dev
nslookup callwaitingai.dev
host callwaitingai.dev

# Check nameserver status
dig NS callwaitingai.dev +short
```

**Fix:**
- Verify nameservers are set to Vercel nameservers
- Wait 24-48 hours for propagation
- Clear DNS cache: `sudo dscacheutil -flushcache` (macOS)

#### Issue: SSL certificate not valid
**Diagnosis:**
```bash
openssl s_client -connect callwaitingai.dev:443 -servername callwaitingai.dev
```

**Fix:**
- Verify domain is properly configured in Vercel
- Vercel auto-generates SSL certificates (usually within 24 hours)
- Check Vercel dashboard for certificate status

#### Issue: Dashboard not loading
**Diagnosis:**
```bash
# Check browser console for errors
# Check Network tab for failed requests
# Check Vercel logs: vercel logs --prod

# Verify auth context is working
curl -s https://callwaitingai.dev/api/auth/session
```

**Fix:**
- Verify NEXT_PUBLIC_SUPABASE_URL is set
- Check Supabase project is accessible
- Verify auth redirects are correct
- Check dashboard has auth protection

#### Issue: Slow performance
**Diagnosis:**
```bash
# Check Vercel analytics
# Check bundle size
npm run build && npm run analyze

# Check Core Web Vitals
# Use Lighthouse in Chrome DevTools
```

**Fix:**
- Implement code splitting
- Optimize images
- Enable caching headers
- Use CDN for static assets

---

### 7. Monitoring & Maintenance
**Objective:** Monitor deployment health and performance

**Automated Checks (run daily):**
```bash
#!/bin/bash
# Daily health check

DOMAIN="https://callwaitingai.dev"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

# 1. Check uptime
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN")
if [ "$STATUS" != "200" ]; then
    curl -X POST "$SLACK_WEBHOOK" -d "{\"text\": \"⚠️ callwaitingai.dev returned status $STATUS\"}"
fi

# 2. Check performance
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$DOMAIN")
if (( $(echo "$RESPONSE_TIME > 5" | bc -l) )); then
    curl -X POST "$SLACK_WEBHOOK" -d "{\"text\": \"⚠️ callwaitingai.dev slow: ${RESPONSE_TIME}s\"}"
fi

# 3. Check SSL certificate expiry
EXPIRY=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null 2>/dev/null | openssl x509 -noout -dates | grep notAfter)
echo "SSL Certificate: $EXPIRY"
```

---

## Execution Checklist

- [ ] Run pre-deployment validation
- [ ] Set Vercel environment variables
- [ ] Deploy to Vercel
- [ ] Configure domain nameservers
- [ ] Verify DNS resolution
- [ ] Verify HTTPS/SSL
- [ ] Test deployment endpoints
- [ ] Verify auth flow
- [ ] Check performance
- [ ] Monitor logs
- [ ] Set up daily health checks

## Success Criteria

✅ callwaitingai.dev resolves to Vercel deployment  
✅ www.callwaitingai.dev redirects to primary domain  
✅ HTTPS certificate is valid  
✅ Homepage loads in < 3 seconds  
✅ Dashboard requires authentication  
✅ Auth flow works end-to-end  
✅ No console errors in browser  
✅ All environment variables configured  

