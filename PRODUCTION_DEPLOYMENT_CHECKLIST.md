# Production Deployment Checklist - Authentication Redirect Fix

**Commit:** `ed2c13a` - fix: auth redirect to use NEXT_PUBLIC_APP_URL environment variable  
**Status:** Code deployed to GitHub, awaiting environment configuration  
**Timeline:** Estimated 15-20 minutes to complete all steps

---

## ✅ COMPLETED STEPS

- [x] Code changes implemented and tested locally
- [x] Diagnostic skill created (`auth_redirect_diagnostic.py`)
- [x] Helper utility created (`src/lib/auth-redirect.ts`)
- [x] AuthContext.tsx updated (3 redirect URLs fixed)
- [x] Callback route updated (domain redirect fixed)
- [x] Environment variable added to `.env.local`
- [x] Comprehensive documentation created
- [x] Code committed to GitHub
- [x] Changes pushed to main branch

---

## 🔄 IN PROGRESS - ENVIRONMENT CONFIGURATION

### Step 1: Configure Vercel Environment Variables
**Time:** 2-3 minutes

1. Go to **Vercel Dashboard** → **Projects** → **roxanne-python-server**
2. Click **Settings** → **Environment Variables**
3. Add new variable:
   ```
   Name: NEXT_PUBLIC_APP_URL
   Value: https://callwaitingai.dev
   Environments: Production, Preview, Development
   ```
4. Click **Save**
5. Trigger redeploy (Vercel will auto-deploy on next push, or manually redeploy)

**Verification:**
```bash
# After deployment, verify the variable is set
curl https://callwaitingai.dev/api/env-check
# Should show NEXT_PUBLIC_APP_URL=https://callwaitingai.dev
```

---

### Step 2: Update Supabase Redirect URLs
**Time:** 3-5 minutes

1. Go to **Supabase Dashboard** → **Project: roxanne-python-server**
2. Navigate to **Authentication** → **URL Configuration**
3. In **Redirect URLs** section, add:
   ```
   https://callwaitingai.dev/auth/callback
   https://callwaitingai.dev/auth/callback?next=/update-password
   ```
4. Keep existing localhost entries:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/callback?next=/update-password
   ```
5. Click **Save**

**Current Redirect URLs (verify these exist):**
- http://localhost:3000/auth/callback
- http://localhost:3000/auth/callback?next=/update-password

**After adding production URLs:**
- http://localhost:3000/auth/callback
- http://localhost:3000/auth/callback?next=/update-password
- https://callwaitingai.dev/auth/callback
- https://callwaitingai.dev/auth/callback?next=/update-password

---

### Step 3: Update Google OAuth Console
**Time:** 3-5 minutes

1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID (for web application)
3. Click on it to edit
4. In **Authorized redirect URIs**, add:
   ```
   https://callwaitingai.dev/auth/callback
   https://lbjymlodxprzqgtyqtcq.supabase.co/auth/v1/callback
   ```
5. Keep existing localhost entries:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/callback?next=/update-password
   ```
6. Click **Save**

**Note:** The Supabase URL is needed because Supabase acts as the OAuth intermediary.

---

## 🧪 TESTING - PRODUCTION VERIFICATION

### Test 1: Email Signup Flow
**Expected:** User receives verification email and can verify account

```
1. Go to https://callwaitingai.dev/sign-up
2. Enter test email: test@example.com
3. Enter password: TestPassword123!
4. Click "Create Account"
5. Check email for verification link
6. Verify link contains: https://callwaitingai.dev/auth/callback
7. Click link
8. Should redirect to https://callwaitingai.dev/dashboard
9. Verify user is logged in
```

**Success Criteria:**
- ✅ Verification email received
- ✅ Link contains production domain (not localhost)
- ✅ Redirect to dashboard works
- ✅ User is authenticated

---

### Test 2: Google OAuth Flow
**Expected:** User can sign in with Google and is redirected to dashboard

```
1. Go to https://callwaitingai.dev/sign-up
2. Click "Continue with Google"
3. Authorize the application
4. Should redirect to https://callwaitingai.dev/dashboard
5. Verify user is logged in
```

**Success Criteria:**
- ✅ Google authorization works
- ✅ Redirect to dashboard works
- ✅ User is authenticated
- ✅ No localhost redirects

---

### Test 3: Password Reset Flow
**Expected:** User receives password reset email and can reset password

```
1. Go to https://callwaitingai.dev/login
2. Click "Forgot password?"
3. Enter email: test@example.com
4. Click "Send reset link"
5. Check email for reset link
6. Verify link contains: https://callwaitingai.dev/auth/callback?next=/update-password
7. Click link
8. Should redirect to https://callwaitingai.dev/update-password
9. Enter new password and submit
10. Should redirect to https://callwaitingai.dev/dashboard
```

**Success Criteria:**
- ✅ Reset email received
- ✅ Link contains production domain (not localhost)
- ✅ Redirect to update-password works
- ✅ Password update works
- ✅ Redirect to dashboard works

---

### Test 4: Error Handling
**Expected:** Invalid credentials show error messages

```
1. Go to https://callwaitingai.dev/login
2. Enter invalid email: invalid@example.com
3. Enter password: wrongpassword
4. Click "Sign In"
5. Should show error message
6. No redirect should occur
```

**Success Criteria:**
- ✅ Error message displayed
- ✅ User stays on login page
- ✅ No silent failures

---

## 📋 VERIFICATION COMMANDS

Run these commands to verify the deployment:

```bash
# 1. Verify environment variable is set in Vercel
curl -I https://callwaitingai.dev
# Look for response headers

# 2. Check if frontend is deployed
curl https://callwaitingai.dev
# Should return HTML content

# 3. Verify auth callback route exists
curl -I https://callwaitingai.dev/auth/callback
# Should return 307 (redirect) or 400 (missing code param)

# 4. Check Supabase connectivity
curl https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/
# Should return JSON response

# 5. Verify no localhost references in production
grep -r "localhost" src/
# Should only find localhost in comments or .env.local
```

---

## 🚨 TROUBLESHOOTING

### Issue: "Redirect URI mismatch" error
**Cause:** NEXT_PUBLIC_APP_URL not set in Vercel or Supabase redirect URLs not updated

**Solution:**
1. Verify `NEXT_PUBLIC_APP_URL=https://callwaitingai.dev` in Vercel
2. Verify redirect URLs in Supabase dashboard
3. Wait 5 minutes for Vercel to redeploy
4. Clear browser cache and try again

---

### Issue: Email verification link goes to localhost
**Cause:** NEXT_PUBLIC_APP_URL not set or old deployment still running

**Solution:**
1. Check Vercel deployment status (should show "Ready")
2. Verify environment variable is set
3. Hard refresh browser (Cmd+Shift+R on Mac)
4. Check browser console for any errors

---

### Issue: OAuth redirects to wrong domain
**Cause:** Google OAuth or Supabase redirect URLs not updated

**Solution:**
1. Verify Google OAuth authorized redirect URIs include production domain
2. Verify Supabase redirect URLs include production domain
3. Wait 5-10 minutes for changes to propagate
4. Try again in incognito window

---

### Issue: Password reset link broken
**Cause:** `getPasswordResetCallbackUrl()` not being used

**Solution:**
1. Verify `src/contexts/AuthContext.tsx` line 196 uses `getPasswordResetCallbackUrl()`
2. Check git log to confirm commit was deployed
3. Verify Vercel shows latest deployment

---

## 📊 DEPLOYMENT STATUS TRACKING

| Component | Status | Verified |
|-----------|--------|----------|
| Code changes | ✅ Deployed | Git commit ed2c13a |
| Vercel env vars | ⏳ Pending | Need manual setup |
| Supabase config | ⏳ Pending | Need manual setup |
| Google OAuth | ⏳ Pending | Need manual setup |
| Email signup | ⏳ Pending | Need testing |
| Google OAuth | ⏳ Pending | Need testing |
| Password reset | ⏳ Pending | Need testing |
| Error handling | ⏳ Pending | Need testing |

---

## 📝 NOTES FOR TEAM

1. **Backward Compatibility:** Changes are backward compatible. Old deployments will still work with localhost.

2. **Rollback Plan:** If issues occur, revert to previous commit:
   ```bash
   git revert ed2c13a
   git push origin main
   ```

3. **Monitoring:** Monitor these logs after deployment:
   - Vercel deployment logs
   - Supabase auth logs
   - Browser console for errors

4. **Communication:** Notify users that authentication has been improved and may work better in production.

---

## ✨ NEXT STEPS AFTER DEPLOYMENT

1. Monitor error rates in Supabase dashboard
2. Check user feedback for auth issues
3. Consider adding analytics to track auth success rates
4. Plan improvements from CODE_REVIEW_AUTH.md for next sprint

---

## 📞 SUPPORT

If you encounter issues:
1. Check the troubleshooting section above
2. Review CODE_REVIEW_AUTH.md for detailed explanations
3. Check AUTH_REDIRECT_FIX.md for deployment guide
4. Run `python3 cascade_sub_agents/auth_redirect_diagnostic.py` for diagnostics
