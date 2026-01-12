import { EncryptionService } from '../services/encryption';

// Test credentials from .env
const twilioCredentials = {
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'AC_PLACEHOLDER',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'AUTH_TOKEN_PLACEHOLDER',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+15555555555'
};

const googleCredentials = {
    clientId: '750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com',
    clientSecret: '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',
    redirectUri: 'http://localhost:3001/api/google-oauth/callback'
};

const vapiCredentials = {
    apiKey: 'fa8fe4f9-4f22-4efd-af6f-37351aaf1628'
};

// Encrypt
const twilioEncrypted = EncryptionService.encryptObject(twilioCredentials);
const googleEncrypted = EncryptionService.encryptObject(googleCredentials);
const vapiEncrypted = EncryptionService.encryptObject(vapiCredentials);

console.log('INSERT INTO integration_settings (org_id, service_type, api_key_encrypted) VALUES');
console.log(`  ('a0000000-0000-0000-0000-000000000001', 'twilio', '${twilioEncrypted}'),`);
console.log(`  ('a0000000-0000-0000-0000-000000000001', 'google', '${googleEncrypted}'),`);
console.log(`  ('a0000000-0000-0000-0000-000000000001', 'vapi', '${vapiEncrypted}');`);
