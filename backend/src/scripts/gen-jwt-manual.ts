import * as jwt from 'jsonwebtoken';

const ORG_ID = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
const USER_ID = 'test-user-id-12345';
const TEST_EMAIL = 'test@demo.com';
const SUPABASE_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long-string';

// Create JWT manually
const token = jwt.sign(
  {
    sub: USER_ID,
    email: TEST_EMAIL,
    app_metadata: {
      org_id: ORG_ID
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  },
  SUPABASE_JWT_SECRET,
  {
    algorithm: 'HS256'
  }
);

console.log('\n✅ Generated JWT token for ' + TEST_EMAIL + ':');
console.log('\nexport TEST_AUTH_TOKEN="' + token + '"\n');
