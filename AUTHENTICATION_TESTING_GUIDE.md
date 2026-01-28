# Authentication Testing Guide - MFA & Google SSO

**Status:** 🔐 Ready for Testing  
**Date:** 2026-01-27  
**Environment:** Production

---

## 🎯 Overview

This guide covers testing of Priority 10 (Advanced Authentication) including:
- Multi-Factor Authentication (MFA/TOTP)
- Google OAuth Single Sign-On (SSO)
- Session Management
- Audit Logging

---

## 🔐 Test 1: MFA Enrollment

### Prerequisites
- User account created in Supabase Auth
- Backend running with auth endpoints
- Authenticator app (Google Authenticator, Authy, Microsoft Authenticator)

### Test Steps

#### Step 1: Request MFA Setup

```bash
# Request MFA enrollment
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/mfa/setup \
  -H "Authorization: Bearer [USER_JWT_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "[USER_ID]",
    "org_id": "[ORG_ID]"
  }'

# Expected Response:
{
  "qr_code": "data:image/png;base64,...",
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "backup_codes": [
    "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    ...
  ]
}
```

**Verification:**
- ✅ QR code is valid and scannable
- ✅ Secret is 32 characters (base32 encoded)
- ✅ 10 backup codes generated
- ✅ Codes are unique and properly formatted

#### Step 2: Scan QR Code

1. Open Authenticator app
2. Scan QR code from response
3. Verify 6-digit code appears
4. Save backup codes securely

**Verification:**
- ✅ QR code scans successfully
- ✅ Authenticator app recognizes code
- ✅ 6-digit code updates every 30 seconds
- ✅ Backup codes are saved

#### Step 3: Verify MFA Code

```bash
# Verify TOTP code
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/mfa/verify \
  -H "Authorization: Bearer [USER_JWT_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "[USER_ID]",
    "org_id": "[ORG_ID]",
    "totp_code": "123456"
  }'

# Expected Response:
{
  "success": true,
  "message": "MFA enabled successfully",
  "event_id": "[EVENT_ID]"
}
```

**Verification:**
- ✅ TOTP code is accepted
- ✅ MFA is enabled for user
- ✅ Audit log entry created
- ✅ Event ID returned

#### Step 4: Verify Audit Log

```bash
# Check audit log entry
curl -X GET "https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/auth_audit_log?user_id=eq.[USER_ID]&event_type=eq.mfa_enabled" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]"

# Expected Response:
[
  {
    "id": "[EVENT_ID]",
    "user_id": "[USER_ID]",
    "org_id": "[ORG_ID]",
    "event_type": "mfa_enabled",
    "ip_address": "[IP]",
    "user_agent": "[USER_AGENT]",
    "metadata": {
      "method": "totp"
    },
    "created_at": "2026-01-27T20:16:00Z"
  }
]
```

**Verification:**
- ✅ Audit log entry exists
- ✅ Event type is "mfa_enabled"
- ✅ IP address captured
- ✅ User agent captured
- ✅ Timestamp is recent

---

## 🔐 Test 2: MFA Login Flow

### Test Steps

#### Step 1: Initial Login

```bash
# Login with email/password
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Expected Response (MFA Required):
{
  "success": false,
  "requires_mfa": true,
  "mfa_challenge_id": "[CHALLENGE_ID]",
  "message": "MFA code required"
}
```

**Verification:**
- ✅ Login succeeds with email/password
- ✅ MFA requirement detected
- ✅ Challenge ID generated
- ✅ Audit log entry created (login_success)

#### Step 2: Submit MFA Code

```bash
# Submit TOTP code
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/mfa/verify-login \
  -H "Content-Type: application/json" \
  -d '{
    "mfa_challenge_id": "[CHALLENGE_ID]",
    "totp_code": "123456"
  }'

# Expected Response:
{
  "success": true,
  "jwt_token": "[JWT_TOKEN]",
  "session_id": "[SESSION_ID]",
  "expires_at": "2026-01-28T20:16:00Z"
}
```

**Verification:**
- ✅ TOTP code is accepted
- ✅ JWT token generated
- ✅ Session created
- ✅ Expiration time set
- ✅ Audit log entry created (mfa_challenge_success)

#### Step 3: Verify Session

```bash
# Check session was created
curl -X GET "https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/auth_sessions?id=eq.[SESSION_ID]" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]"

# Expected Response:
[
  {
    "id": "[SESSION_ID]",
    "user_id": "[USER_ID]",
    "org_id": "[ORG_ID]",
    "session_token": "[SESSION_TOKEN]",
    "ip_address": "[IP]",
    "user_agent": "[USER_AGENT]",
    "device_type": "desktop",
    "created_at": "2026-01-27T20:16:00Z",
    "expires_at": "2026-01-28T20:16:00Z",
    "revoked_at": null,
    "last_activity_at": "2026-01-27T20:16:00Z"
  }
]
```

**Verification:**
- ✅ Session exists in database
- ✅ Session token matches
- ✅ Device type detected
- ✅ Expiration time set
- ✅ Not revoked

---

## 🔐 Test 3: Google SSO Login

### Prerequisites
- Google OAuth app configured
- Client ID: 750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com
- Redirect URI: https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/google/callback

### Test Steps

#### Step 1: Initiate Google Login

```bash
# Get Google OAuth URL
curl -X GET "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/google/login" \
  -H "Content-Type: application/json"

# Expected Response:
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com&redirect_uri=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/google/callback&response_type=code&scope=openid%20email%20profile"
}
```

**Verification:**
- ✅ Auth URL is valid
- ✅ Client ID is correct
- ✅ Redirect URI is correct
- ✅ Scopes include openid, email, profile

#### Step 2: Authenticate with Google

1. Open auth_url in browser
2. Sign in with Google account
3. Grant permissions
4. Redirected to callback URL

**Verification:**
- ✅ Google login page appears
- ✅ Permissions prompt shown
- ✅ Redirected to callback URL
- ✅ Authorization code in URL

#### Step 3: Handle Callback

```bash
# Backend receives callback
GET https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/google/callback?code=[AUTH_CODE]&state=[STATE]

# Expected Response (Redirect):
Location: https://localhost:3000/dashboard?session_id=[SESSION_ID]&jwt_token=[JWT_TOKEN]
```

**Verification:**
- ✅ Authorization code exchanged
- ✅ User created or updated
- ✅ Session created
- ✅ JWT token generated
- ✅ Redirected to dashboard

#### Step 4: Verify SSO Session

```bash
# Check SSO session was created
curl -X GET "https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/auth_audit_log?event_type=eq.sso_login" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]"

# Expected Response:
[
  {
    "id": "[EVENT_ID]",
    "user_id": "[USER_ID]",
    "org_id": "[ORG_ID]",
    "event_type": "sso_login",
    "ip_address": "[IP]",
    "user_agent": "[USER_AGENT]",
    "metadata": {
      "provider": "google",
      "email": "user@gmail.com"
    },
    "created_at": "2026-01-27T20:16:00Z"
  }
]
```

**Verification:**
- ✅ SSO login event logged
- ✅ Provider is "google"
- ✅ Email captured
- ✅ Audit trail complete

---

## 🔐 Test 4: Session Management

### Test Steps

#### Step 1: Create Multiple Sessions

```bash
# Login from device 1
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "device_type": "desktop"
  }'

# Response: Session 1 created

# Login from device 2
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "device_type": "mobile"
  }'

# Response: Session 2 created
```

**Verification:**
- ✅ Multiple sessions created
- ✅ Device types captured
- ✅ Different session tokens
- ✅ Both sessions active

#### Step 2: List Active Sessions

```bash
# Get all active sessions for user
curl -X GET "https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/auth_sessions?user_id=eq.[USER_ID]&revoked_at=is.null" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]"

# Expected Response:
[
  {
    "id": "[SESSION_ID_1]",
    "device_type": "desktop",
    "created_at": "2026-01-27T20:00:00Z",
    "last_activity_at": "2026-01-27T20:15:00Z"
  },
  {
    "id": "[SESSION_ID_2]",
    "device_type": "mobile",
    "created_at": "2026-01-27T20:10:00Z",
    "last_activity_at": "2026-01-27T20:16:00Z"
  }
]
```

**Verification:**
- ✅ Multiple sessions listed
- ✅ Device types shown
- ✅ Activity timestamps updated
- ✅ No revoked sessions

#### Step 3: Revoke Single Session

```bash
# Revoke session from device 1
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/session/revoke \
  -H "Authorization: Bearer [JWT_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "[SESSION_ID_1]"
  }'

# Expected Response:
{
  "success": true,
  "message": "Session revoked"
}
```

**Verification:**
- ✅ Session revoked successfully
- ✅ Audit log entry created (session_revoked)
- ✅ Other sessions still active
- ✅ Device 1 logged out

#### Step 4: Logout from All Devices

```bash
# Logout from all devices
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/auth/logout-all \
  -H "Authorization: Bearer [JWT_TOKEN]" \
  -H "Content-Type: application/json"

# Expected Response:
{
  "success": true,
  "message": "All sessions revoked",
  "sessions_revoked": 2
}
```

**Verification:**
- ✅ All sessions revoked
- ✅ Count matches number of sessions
- ✅ Audit log entries created
- ✅ User completely logged out

---

## 📋 Test Checklist

### MFA Enrollment
- [ ] QR code generates correctly
- [ ] Secret is valid base32
- [ ] Backup codes generated (10)
- [ ] Authenticator app scans QR
- [ ] TOTP code verifies
- [ ] Audit log entry created
- [ ] MFA enabled flag set

### MFA Login
- [ ] Login requires MFA code
- [ ] Challenge ID generated
- [ ] TOTP code accepted
- [ ] JWT token issued
- [ ] Session created
- [ ] Audit log entries created
- [ ] Session expires correctly

### Google SSO
- [ ] Auth URL generated correctly
- [ ] Google login page appears
- [ ] Permissions prompt shown
- [ ] Callback handled correctly
- [ ] User created/updated
- [ ] Session created
- [ ] Audit log entry created
- [ ] Redirected to dashboard

### Session Management
- [ ] Multiple sessions supported
- [ ] Device types captured
- [ ] Sessions listed correctly
- [ ] Single session revoked
- [ ] All sessions revoked
- [ ] Audit trail complete
- [ ] Expired sessions cleaned up

---

## 🚀 Expected Results

### All Tests Pass When:
- ✅ MFA enrollment works end-to-end
- ✅ MFA login requires and validates code
- ✅ Google SSO login works
- ✅ Sessions are created and managed
- ✅ Audit logs capture all events
- ✅ RLS policies enforce access control
- ✅ No security vulnerabilities

### Production Ready When:
- ✅ All tests pass
- ✅ No security issues found
- ✅ Performance acceptable (<500ms)
- ✅ Audit trail complete
- ✅ Monitoring configured
- ✅ Documentation complete

---

## 🔍 Troubleshooting

### MFA Code Not Accepted
1. Verify time sync on authenticator device
2. Check TOTP algorithm is HMAC-SHA1
3. Verify secret is correct
4. Check code hasn't expired (30 second window)

### Google SSO Not Working
1. Verify Client ID is correct
2. Check redirect URI matches
3. Verify Google app is authorized
4. Check browser cookies enabled
5. Review backend logs for errors

### Sessions Not Creating
1. Verify database connection
2. Check auth_sessions table exists
3. Verify RLS policies allow insert
4. Check user_id and org_id are valid
5. Review backend logs

### Audit Logs Not Recording
1. Verify auth_audit_log table exists
2. Check RLS policies allow insert
3. Verify log_auth_event function exists
4. Check function permissions
5. Review backend logs

---

## ✨ Summary

This guide covers comprehensive testing of Priority 10 (Advanced Authentication):

1. **MFA Enrollment** - TOTP setup and verification
2. **MFA Login** - Multi-factor authentication flow
3. **Google SSO** - Single sign-on integration
4. **Session Management** - Multi-device session handling

All tests should pass before considering authentication production-ready.

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-27T20:16:00Z  
**Status:** Ready for Testing
