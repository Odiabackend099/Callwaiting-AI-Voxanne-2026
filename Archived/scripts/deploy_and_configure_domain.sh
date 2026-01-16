#!/bin/bash

###############################################################################
# Vercel Deployment & Domain Configuration Script
# Purpose: Deploy to Vercel and configure callwaitingai.dev domain
###############################################################################

set -e

DOMAIN_PRIMARY="callwaitingai.dev"
DOMAIN_WWW="www.callwaitingai.dev"
VERCEL_PROJECT="roxan-frontend"
VERCEL_ORG="odia-backends-projects"
VERCEL_IP="76.76.19.165"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

###############################################################################
# STEP 1: Pre-Deployment Validation
###############################################################################
echo -e "${BLUE}=== STEP 1: Pre-Deployment Validation ===${NC}"

validate_environment() {
    echo "Checking environment variables..."
    
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Missing: $var${NC}"
            return 1
        fi
    done
    
    echo -e "${GREEN}✅ All required environment variables set${NC}"
    return 0
}

check_no_exposed_secrets() {
    echo "Checking for exposed secrets in client code..."
    
    if grep -r "SUPABASE_SERVICE_ROLE_KEY" src/ 2>/dev/null; then
        echo -e "${RED}❌ Service role key exposed in client code${NC}"
        return 1
    fi
    
    if grep -r "NEXT_PUBLIC.*SECRET" src/ 2>/dev/null | grep -v "NEXT_PUBLIC_APP_URL"; then
        echo -e "${RED}❌ Secrets exposed in client code${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ No exposed secrets detected${NC}"
    return 0
}

check_build() {
    echo "Testing build..."
    npm run build > /dev/null 2>&1 || {
        echo -e "${RED}❌ Build failed${NC}"
        return 1
    }
    echo -e "${GREEN}✅ Build successful${NC}"
    return 0
}

verify_auth_protection() {
    echo "Verifying dashboard auth protection..."
    
    if ! grep -q "useAuth()" src/app/dashboard/page.tsx; then
        echo -e "${RED}❌ Dashboard missing auth protection${NC}"
        return 1
    fi
    
    if ! grep -q "if (!loading && !user)" src/app/dashboard/page.tsx; then
        echo -e "${RED}❌ Dashboard missing auth check${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Dashboard auth protection verified${NC}"
    return 0
}

# Run validation checks
validate_environment || exit 1
check_no_exposed_secrets || exit 1
check_build || exit 1
verify_auth_protection || exit 1

###############################################################################
# STEP 2: Deploy to Vercel
###############################################################################
echo -e "\n${BLUE}=== STEP 2: Deploying to Vercel ===${NC}"

deploy_to_vercel() {
    echo "Deploying to Vercel..."
    
    DEPLOYMENT_URL=$(vercel deploy --prod 2>&1 | grep -oP 'Production: \K[^ ]+' || echo "")
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        echo -e "${RED}❌ Deployment failed${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Deployed to: $DEPLOYMENT_URL${NC}"
    echo "DEPLOYMENT_URL=$DEPLOYMENT_URL" > .deployment_info
    return 0
}

deploy_to_vercel || exit 1

###############################################################################
# STEP 3: Configure Domain in Vercel
###############################################################################
echo -e "\n${BLUE}=== STEP 3: Configuring Domain in Vercel ===${NC}"

configure_domain_in_vercel() {
    echo "Configuring domain in Vercel dashboard..."
    
    cat << EOF
${YELLOW}📋 Manual Step Required:${NC}

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select project: $VERCEL_PROJECT
3. Go to Settings → Domains
4. Add domain: $DOMAIN_PRIMARY
5. Add domain: $DOMAIN_WWW
6. Follow Vercel's DNS configuration instructions

${YELLOW}DNS Configuration Options:${NC}

Option A: Update Nameservers (Recommended)
- Log in to domain registrar
- Update nameservers to:
  • ns1.vercel-dns.com
  • ns2.vercel-dns.com
- Wait 24-48 hours for propagation

Option B: Add A/CNAME Records
- Add A record: $DOMAIN_PRIMARY → $VERCEL_IP
- Add CNAME record: $DOMAIN_WWW → $DOMAIN_PRIMARY

${YELLOW}Verify DNS with:${NC}
  dig $DOMAIN_PRIMARY
  dig www.$DOMAIN_PRIMARY
  nslookup $DOMAIN_PRIMARY

EOF
    
    read -p "Have you configured the domain in Vercel? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️  Skipping domain verification${NC}"
        return 0
    fi
    
    return 0
}

configure_domain_in_vercel

###############################################################################
# STEP 4: DNS Verification
###############################################################################
echo -e "\n${BLUE}=== STEP 4: DNS Verification ===${NC}"

verify_dns() {
    echo "Verifying DNS configuration..."
    
    # Check primary domain
    echo "Checking $DOMAIN_PRIMARY..."
    PRIMARY_IP=$(dig +short "$DOMAIN_PRIMARY" A 2>/dev/null | head -1)
    
    if [ -n "$PRIMARY_IP" ]; then
        echo -e "${GREEN}✅ $DOMAIN_PRIMARY resolves to: $PRIMARY_IP${NC}"
    else
        echo -e "${YELLOW}⚠️  $DOMAIN_PRIMARY not yet resolving (DNS propagation in progress)${NC}"
    fi
    
    # Check WWW subdomain
    echo "Checking $DOMAIN_WWW..."
    WWW_CNAME=$(dig +short "$DOMAIN_WWW" CNAME 2>/dev/null | head -1)
    
    if [ -n "$WWW_CNAME" ]; then
        echo -e "${GREEN}✅ $DOMAIN_WWW CNAME: $WWW_CNAME${NC}"
    else
        echo -e "${YELLOW}⚠️  $DOMAIN_WWW CNAME not yet configured${NC}"
    fi
    
    return 0
}

verify_dns

###############################################################################
# STEP 5: HTTPS/SSL Verification
###############################################################################
echo -e "\n${BLUE}=== STEP 5: HTTPS/SSL Verification ===${NC}"

verify_https() {
    echo "Checking HTTPS certificate..."
    
    if command -v openssl &> /dev/null; then
        openssl s_client -connect "$DOMAIN_PRIMARY:443" -servername "$DOMAIN_PRIMARY" < /dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || {
            echo -e "${YELLOW}⚠️  SSL certificate not yet available (Vercel generates within 24 hours)${NC}"
            return 0
        }
        echo -e "${GREEN}✅ SSL certificate valid${NC}"
    else
        echo -e "${YELLOW}⚠️  openssl not available, skipping SSL check${NC}"
    fi
    
    return 0
}

verify_https

###############################################################################
# STEP 6: Deployment Verification
###############################################################################
echo -e "\n${BLUE}=== STEP 6: Deployment Verification ===${NC}"

verify_deployment() {
    echo "Verifying deployed application..."
    
    # Load deployment URL
    if [ -f .deployment_info ]; then
        source .deployment_info
    fi
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        echo -e "${YELLOW}⚠️  Deployment URL not found${NC}"
        return 0
    fi
    
    # Check homepage
    echo "Testing homepage..."
    if curl -s "$DEPLOYMENT_URL" | grep -q "CallWaiting AI"; then
        echo -e "${GREEN}✅ Homepage loads${NC}"
    else
        echo -e "${RED}❌ Homepage failed${NC}"
    fi
    
    # Check login page
    echo "Testing login page..."
    if curl -s "$DEPLOYMENT_URL/login" | grep -q "Login"; then
        echo -e "${GREEN}✅ Login page accessible${NC}"
    else
        echo -e "${RED}❌ Login page failed${NC}"
    fi
    
    # Check dashboard auth protection
    echo "Testing dashboard auth protection..."
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/dashboard")
    if [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
        echo -e "${GREEN}✅ Dashboard redirects unauthenticated users (status: $STATUS)${NC}"
    else
        echo -e "${YELLOW}⚠️  Dashboard returned status: $STATUS${NC}"
    fi
    
    # Performance check
    echo "Testing performance..."
    RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$DEPLOYMENT_URL")
    echo "Response time: ${RESPONSE_TIME}s"
    if (( $(echo "$RESPONSE_TIME < 3" | bc -l) )); then
        echo -e "${GREEN}✅ Performance acceptable${NC}"
    else
        echo -e "${YELLOW}⚠️  Performance slow (${RESPONSE_TIME}s)${NC}"
    fi
    
    return 0
}

verify_deployment

###############################################################################
# STEP 7: Summary
###############################################################################
echo -e "\n${BLUE}=== DEPLOYMENT SUMMARY ===${NC}"

cat << EOF

${GREEN}✅ Deployment Complete${NC}

${YELLOW}Next Steps:${NC}

1. ${YELLOW}Configure Domain (if not done):${NC}
   - Log in to domain registrar
   - Update nameservers to Vercel nameservers
   - OR add A/CNAME records as shown above
   - Wait 24-48 hours for DNS propagation

2. ${YELLOW}Verify Domain:${NC}
   - Run: dig $DOMAIN_PRIMARY
   - Run: dig www.$DOMAIN_WWW
   - Visit: https://$DOMAIN_PRIMARY

3. ${YELLOW}Monitor Deployment:${NC}
   - Check Vercel dashboard: https://vercel.com/dashboard
   - Monitor logs: vercel logs --prod
   - Set up alerts for errors

4. ${YELLOW}Test Auth Flow:${NC}
   - Visit: https://$DOMAIN_PRIMARY/login
   - Test login with valid credentials
   - Verify dashboard loads after login
   - Test logout

${YELLOW}Troubleshooting:${NC}

If domain not resolving:
  - Check nameservers: dig NS $DOMAIN_PRIMARY
  - Verify registrar settings
  - Wait for DNS propagation (24-48 hours)

If SSL certificate not valid:
  - Vercel auto-generates certificates (usually within 24 hours)
  - Check Vercel dashboard for certificate status

If dashboard not loading:
  - Check browser console for errors
  - Verify Supabase credentials
  - Check Vercel logs: vercel logs --prod

${GREEN}Deployment URLs:${NC}
- Production: https://$DOMAIN_PRIMARY
- WWW: https://$DOMAIN_WWW
- Vercel: $DEPLOYMENT_URL

EOF

echo -e "${GREEN}✅ Deployment script completed${NC}"
