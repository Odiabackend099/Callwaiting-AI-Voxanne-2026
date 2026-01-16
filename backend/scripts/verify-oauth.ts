import { IntegrationDecryptor } from '../src/services/integration-decryptor';
import { google } from 'googleapis';
import { log } from '../src/services/logger';
import { EncryptionService } from '../src/services/encryption';

async function runDiagnostics(orgId: string) {
  console.log(`🚀 Starting OAuth Verification for Org: ${orgId}`);
  
  // TEST 1: Check credentials exist
  try {
    const creds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
    console.log("✅ PASS: Credentials found in database");
    console.log(`   Email: ${creds.email || 'Not provided'}`);
    console.log(`   Expires: ${creds.expiresAt}`);
    
    // Run additional tests if credentials exist
    await testEncryption();
    await testGoogleApi(orgId);
    return;
  } catch (e) {
    console.log("ℹ️ No existing credentials found. Starting full OAuth flow validation");
  }

  // TEST 2: Verify encryption/decryption
  await testEncryption();

  console.log("\nNext steps:");
  console.log("1. Initiate OAuth flow by visiting:");
  console.log(`   http://localhost:3001/api/google-oauth/authorize?orgId=${orgId}`);
  console.log("2. After completing OAuth, re-run this diagnostic");
}

async function testEncryption() {
  try {
    const testData = { test: "payload" };
    const encrypted = EncryptionService.encryptObject(testData);
    const decrypted = EncryptionService.decryptObject(encrypted);
    
    if (JSON.stringify(decrypted) === JSON.stringify(testData)) {
      console.log("✅ PASS: Encryption/decryption working");
    } else {
      throw new Error("Decrypted data mismatch");
    }
  } catch (e) {
    console.error("❌ FAIL: Encryption issue", e.message);
  }
}

async function testGoogleApi(orgId: string) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    const creds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
    oauth2Client.setCredentials({
      refresh_token: creds.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.calendarList.list({ maxResults: 1 });
    console.log("✅ PASS: Google API access validated");
  } catch (e) {
    console.error("❌ FAIL: Google API rejected token", e.message);
  }
}

// Run with first argument as orgId
runDiagnostics(process.argv[2]).catch(console.error);
