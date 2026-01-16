/**
 * BROWSER CONSOLE DIAGNOSTIC - Copy and paste this entire script into your browser console
 * This will tell you EXACTLY what's wrong without needing backend access
 */

// ============================================================================
// STEP 1: Check Your JWT
// ============================================================================
console.log("%c=== STEP 1: JWT ANALYSIS ===", "color: blue; font-weight: bold");

const token = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');

if (!token) {
  console.error("❌ FATAL: No authentication token found!");
  console.log("   You must log in first");
} else {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error("❌ FATAL: Token format invalid");
    } else {
      const payload = JSON.parse(atob(parts[1]));

      console.log("✅ Token found and decoded");
      console.log("   User ID:", payload.sub);
      console.log("   Email:", payload.email);

      // Extract org_id
      const orgId = payload.app_metadata?.org_id || payload.user_metadata?.org_id;

      if (orgId) {
        console.log("%c✅ org_id FOUND:", "color: green; font-weight: bold", orgId);
        window._orgId = orgId; // Save for next step
      } else {
        console.error("%c❌ org_id MISSING from JWT", "color: red; font-weight: bold");
        console.log("   app_metadata:", payload.app_metadata);
        console.log("   user_metadata:", payload.user_metadata);
        console.log("\n   🔧 FIX: Log out completely and log back in");
        console.log("      This refreshes your JWT with org_id from the database");
      }
    }
  } catch (e) {
    console.error("❌ Failed to decode JWT:", e.message);
  }
}

// ============================================================================
// STEP 2: Check Backend Connection
// ============================================================================
console.log("%c\n=== STEP 2: BACKEND CONNECTION ===", "color: blue; font-weight: bold");

if (!window._orgId) {
  console.warn("⚠️  Skipping backend check (no org_id in JWT)");
  console.log("   Fix Step 1 first, then run this script again");
} else {
  const backendUrl = "http://localhost:3001";
  const testUrl = `${backendUrl}/api/google-oauth/test`;

  fetch(testUrl)
    .then(r => r.json())
    .then(data => {
      console.log("✅ Backend is responding");
      console.log("   Response:", data);

      // Now test the debug endpoint
      return fetch(`${backendUrl}/api/google-oauth/debug?orgId=${window._orgId}`);
    })
    .then(r => r.json())
    .then(data => {
      console.log("%c✅ Diagnostic endpoint responded", "color: green; font-weight: bold");

      // Interpret the results
      if (data.error) {
        console.error("   Error:", data.error);
        return;
      }

      const credCount = data.database?.credentialsCount || 0;
      const isActive = data.database?.googleCalendarCredentials?.[0]?.is_active;

      if (credCount === 0) {
        console.error("%c❌ NO CREDENTIALS in database", "color: red; font-weight: bold");
        console.log("   This means OAuth never completed successfully");
        console.log("   Next step: Try linking Google Calendar and check for errors below");
      } else if (!isActive) {
        console.error("%c⚠️  Credentials exist but marked INACTIVE", "color: orange; font-weight: bold");
        console.log("   Did you disconnect the calendar?");
        console.log("   Next step: Re-link Google Calendar");
      } else {
        console.log("%c✅ CREDENTIALS EXIST AND ACTIVE", "color: green; font-weight: bold");
        console.log("   Email:", data.database.googleCalendarCredentials[0].metadata?.email);
        console.log("   Status:", data.database.googleCalendarCredentials[0].is_active);
        console.log("\n   But UI shows 'Not Linked'?");
        console.log("   🔧 FIX: Hard refresh browser (Cmd/Ctrl + Shift + R)");
      }
    })
    .catch(e => {
      console.error("❌ Backend error:", e.message);
      console.log("   Is the backend running on port 3001?");
      console.log("   Check terminal where you started 'npm run dev' in backend/");
    });
}

// ============================================================================
// STEP 3: Monitor Console During OAuth
// ============================================================================
console.log("%c\n=== STEP 3: MONITORING ===", "color: blue; font-weight: bold");
console.log("Now try clicking 'Link My Google Calendar'");
console.log("Watch this console for messages starting with:");
console.log("  - [Calendar Status]");
console.log("  - [OAuth Callback]");
console.log("  - [Google OAuth]");
console.log("\nPaste any RED error messages here for debugging");

// Add a persistent log to catch errors
const originalError = console.error;
window._oauthErrors = [];
console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('OAuth') || message.includes('Calendar')) {
    window._oauthErrors.push(message);
  }
  return originalError.apply(console, args);
};

console.log("%c=== DIAGNOSTIC READY ===", "color: green; font-weight: bold");
console.log("Scroll up to see results above, then try linking Google Calendar");
