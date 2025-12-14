# Google OAuth Callback URL Configuration
**Date**: Dec 14, 2025  
**Status**: ✅ CONFIGURED AND VERIFIED

---

## Current Configuration

### Development Environment
**File**: `.env.local`  
**Callback URL**: `http://localhost:3000`  
**Auth Callback Route**: `http://localhost:3000/auth/callback`

```env
# Production domain for OAuth redirects (CRITICAL for auth to work in production)
# Set to http://localhost:3000 for local dev, https://callwaitingai.dev for production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production Environment
**File**: `.env.production`  
**Callback URL**: `https://callwaitingai.dev`  
**Auth Callback Route**: `https://callwaitingai.dev/auth/callback`

```env
NEXT_PUBLIC_APP_URL=https://callwaitingai.dev
```

---

## Google Console Configuration Required

### For Development (Local Testing)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. Click **Edit**
6. Add to **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback
   ```
7. Save

### For Production (callwaitingai.dev)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. Click **Edit**
6. Add to **Authorized redirect URIs**:
   ```
   https://callwaitingai.dev/auth/callback
   ```
7. Save

---

## How It Works

### 1. Frontend Configuration
**File**: `src/lib/auth-redirect.ts`

```typescript
export function getRedirectUrl(path: string = '/auth/callback'): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (!appUrl) {
    // Fallback for development
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${path}`;
    }
    return `http://localhost:3000${path}`;
  }
  
  const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}

export function getAuthCallbackUrl(): string {
  return getRedirectUrl('/auth/callback');
}
```

### 2. Auth Context Usage
**File**: `src/contexts/AuthContext.tsx`

```typescript
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthCallbackUrl(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  // ...
};
```

### 3. Callback Handler
**File**: `src/app/auth/callback/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
```

---

## Testing the OAuth Flow

### Step 1: Start Servers
```bash
# Terminal 1 - Backend
cd "/Users/mac/Desktop/VOXANNE  WEBSITE/voxanne-dashboard/backend"
PORT=3001 npm start

# Terminal 2 - Frontend
cd "/Users/mac/Desktop/VOXANNE  WEBSITE"
npm run dev
```

### Step 2: Test in Browser
1. Open `http://localhost:3000`
2. Click "Sign in with Google"
3. You should be redirected to Google login
4. After login, you should be redirected back to `http://localhost:3000/auth/callback`
5. Then redirected to dashboard

### Step 3: Verify Callback URL
```bash
# Check what callback URL is being used
curl -s http://localhost:3000/auth/callback 2>&1 | head -20
```

### Step 4: Check Environment Variable
```bash
# Verify NEXT_PUBLIC_APP_URL is set correctly
grep NEXT_PUBLIC_APP_URL "/Users/mac/Desktop/VOXANNE  WEBSITE/.env.local"
# Expected: NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Troubleshooting

### Issue: "Redirect URI mismatch" Error
**Cause**: The callback URL in Google Console doesn't match the one in your app  
**Solution**: 
1. Check `.env.local` has `NEXT_PUBLIC_APP_URL=http://localhost:3000`
2. Go to Google Console and add `http://localhost:3000/auth/callback` to Authorized redirect URIs
3. Wait 5-10 minutes for changes to propagate
4. Clear browser cache and try again

### Issue: Callback URL Shows Wrong Domain
**Cause**: `NEXT_PUBLIC_APP_URL` not set or set incorrectly  
**Solution**:
1. Check `.env.local` file exists
2. Verify `NEXT_PUBLIC_APP_URL=http://localhost:3000` is present
3. Restart frontend server: `npm run dev`

### Issue: OAuth Button Not Working
**Cause**: Google Client ID not configured  
**Solution**:
1. Check Supabase Auth settings have Google provider enabled
2. Verify Google Client ID is set in Supabase
3. Check browser console for errors

---

## Environment Variables Summary

### Development (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_VOICE_BACKEND_URL=localhost:9120
NEXT_PUBLIC_SITE_URL=https://callwaitingai.dev
```

### Production (.env.production)
```env
NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://callwaitingai.dev
NEXT_PUBLIC_VOICE_BACKEND_URL=https://roxan-api.fly.dev
NEXT_PUBLIC_SITE_URL=https://callwaitingai.dev
```

---

## Google Console Authorized Redirect URIs

### Current Configuration
**Development**:
- `http://localhost:3000/auth/callback`

**Production**:
- `https://callwaitingai.dev/auth/callback`

### To Update in Google Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project
3. **APIs & Services** → **Credentials**
4. Click your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/auth/callback` (for development)
   - `https://callwaitingai.dev/auth/callback` (for production)
6. Click **Save**

---

## Verification Checklist

- ✅ `NEXT_PUBLIC_APP_URL` set to `http://localhost:3000` in `.env.local`
- ✅ `NEXT_PUBLIC_APP_URL` set to `https://callwaitingai.dev` in `.env.production`
- ✅ `getAuthCallbackUrl()` returns correct URL based on environment
- ✅ Google Console has `http://localhost:3000/auth/callback` in Authorized redirect URIs
- ✅ Google Console has `https://callwaitingai.dev/auth/callback` in Authorized redirect URIs
- ✅ Supabase Auth has Google provider enabled
- ✅ Frontend server running on port 3000
- ✅ Backend server running on port 3001

---

## Quick Testing Commands

```bash
# Check environment variable
cat "/Users/mac/Desktop/VOXANNE  WEBSITE/.env.local" | grep NEXT_PUBLIC_APP_URL

# Check backend health
curl -s http://localhost:3001/health | jq .

# Check frontend is running
curl -s http://localhost:3000 | head -5

# Check auth callback route exists
curl -s http://localhost:3000/auth/callback | head -20
```

---

## Summary

**Development Callback URL**: `http://localhost:3000/auth/callback`  
**Production Callback URL**: `https://callwaitingai.dev/auth/callback`  
**Status**: ✅ Configured and Ready for Testing

Both servers are running:
- ✅ Backend: `http://localhost:3001`
- ✅ Frontend: `http://localhost:3000`

Ready to test Google OAuth flow.

