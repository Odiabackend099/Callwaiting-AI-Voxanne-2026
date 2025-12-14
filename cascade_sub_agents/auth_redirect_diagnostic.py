#!/usr/bin/env python3
"""
AUTH REDIRECT DIAGNOSTIC SKILL
==============================
Diagnoses and fixes authentication redirect issues in production.

Issues detected:
1. window.location.origin used in OAuth flows (unreliable)
2. No environment variable for production domain
3. Callback route uses requestUrl.origin (proxy issues)
4. Missing Supabase redirect URL configuration validation

Usage:
  python3 auth_redirect_diagnostic.py
"""

import os
import json
import subprocess
from pathlib import Path

class AuthRedirectDiagnostic:
    def __init__(self):
        self.repo_root = Path("/Users/mac/Desktop/VOXANNE  WEBSITE")
        self.issues = []
        self.fixes = []
    
    def check_env_vars(self):
        """Check if production domain is configured."""
        print("\n[1/5] Checking environment variables...")
        
        env_local = self.repo_root / ".env.local"
        env_content = env_local.read_text() if env_local.exists() else ""
        
        # Check for production domain config
        has_prod_domain = "NEXT_PUBLIC_APP_URL" in env_content or "NEXT_PUBLIC_SITE_URL" in env_content
        
        if not has_prod_domain:
            self.issues.append({
                "severity": "CRITICAL",
                "file": ".env.local",
                "issue": "Missing NEXT_PUBLIC_APP_URL for production domain",
                "impact": "OAuth redirects to localhost in production"
            })
            self.fixes.append({
                "file": ".env.local",
                "action": "Add NEXT_PUBLIC_APP_URL=https://callwaitingai.dev (or your production domain)"
            })
        
        print(f"  ✓ Environment variables checked")
    
    def check_auth_context(self):
        """Check AuthContext for window.location.origin usage."""
        print("[2/5] Checking AuthContext.tsx...")
        
        auth_context = self.repo_root / "src/contexts/AuthContext.tsx"
        content = auth_context.read_text()
        
        # Find all window.location.origin usages
        lines_with_issue = []
        for i, line in enumerate(content.split('\n'), 1):
            if 'window.location.origin' in line and 'emailRedirectTo' in line or 'redirectTo' in line:
                lines_with_issue.append(i)
        
        if lines_with_issue:
            self.issues.append({
                "severity": "CRITICAL",
                "file": "src/contexts/AuthContext.tsx",
                "lines": lines_with_issue,
                "issue": "Using window.location.origin for OAuth redirects",
                "impact": "Redirects to wrong domain in production (localhost or proxy domain)"
            })
            self.fixes.append({
                "file": "src/contexts/AuthContext.tsx",
                "action": "Replace window.location.origin with getRedirectUrl() helper that uses NEXT_PUBLIC_APP_URL"
            })
        
        print(f"  ✓ Found {len(lines_with_issue)} instances of window.location.origin")
    
    def check_callback_route(self):
        """Check callback route for requestUrl.origin usage."""
        print("[3/5] Checking auth callback route...")
        
        callback_route = self.repo_root / "src/app/auth/callback/route.ts"
        content = callback_route.read_text()
        
        if 'requestUrl.origin' in content:
            self.issues.append({
                "severity": "HIGH",
                "file": "src/app/auth/callback/route.ts",
                "issue": "Using requestUrl.origin for redirect",
                "impact": "May redirect to proxy/CDN domain instead of production domain"
            })
            self.fixes.append({
                "file": "src/app/auth/callback/route.ts",
                "action": "Use environment variable for production domain instead of requestUrl.origin"
            })
        
        print(f"  ✓ Callback route checked")
    
    def check_supabase_config(self):
        """Check Supabase configuration."""
        print("[4/5] Checking Supabase configuration...")
        
        print("  ⚠️  Manual check required:")
        print("     1. Go to Supabase Dashboard → Authentication → URL Configuration")
        print("     2. Verify 'Redirect URLs' includes:")
        print("        - http://localhost:3000/auth/callback (dev)")
        print("        - https://callwaitingai.dev/auth/callback (prod)")
        print("        - https://your-vercel-domain.vercel.app/auth/callback (staging)")
    
    def check_oauth_providers(self):
        """Check OAuth provider configuration."""
        print("[5/5] Checking OAuth provider configuration...")
        
        print("  ⚠️  Manual check required:")
        print("     1. Google OAuth Console:")
        print("        - Authorized redirect URIs must include production domain")
        print("     2. Environment variables must be set in production:")
        print("        - NEXT_PUBLIC_SUPABASE_URL")
        print("        - NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    def generate_report(self):
        """Generate diagnostic report."""
        print("\n" + "="*70)
        print("AUTH REDIRECT DIAGNOSTIC REPORT")
        print("="*70)
        
        print(f"\n📋 ISSUES FOUND: {len(self.issues)}")
        for i, issue in enumerate(self.issues, 1):
            print(f"\n  {i}. [{issue['severity']}] {issue['issue']}")
            print(f"     File: {issue['file']}")
            if 'lines' in issue:
                print(f"     Lines: {issue['lines']}")
            print(f"     Impact: {issue['impact']}")
        
        print(f"\n🔧 FIXES REQUIRED: {len(self.fixes)}")
        for i, fix in enumerate(self.fixes, 1):
            print(f"\n  {i}. {fix['file']}")
            print(f"     Action: {fix['action']}")
        
        print("\n" + "="*70)
        print("NEXT STEPS:")
        print("="*70)
        print("""
1. Add environment variable for production domain:
   NEXT_PUBLIC_APP_URL=https://callwaitingai.dev

2. Create getRedirectUrl() helper function

3. Update AuthContext.tsx to use the helper

4. Update callback/route.ts to use environment variable

5. Verify Supabase redirect URLs in dashboard

6. Test OAuth flow in production
        """)

def main():
    diagnostic = AuthRedirectDiagnostic()
    
    print("🔍 VOXANNE AUTH REDIRECT DIAGNOSTIC")
    print("="*70)
    
    diagnostic.check_env_vars()
    diagnostic.check_auth_context()
    diagnostic.check_callback_route()
    diagnostic.check_supabase_config()
    diagnostic.check_oauth_providers()
    diagnostic.generate_report()

if __name__ == "__main__":
    main()
