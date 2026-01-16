const { execSync } = require('child_process');

// Start backend if not running
try {
  execSync('ps aux | grep "node dist/server.js" | grep -v grep');
} catch {
  execSync('cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend && npm run start &');
  console.log('Started backend server');
}

// Open test page
const open = require('open');
open('http://localhost:3001/api/google-oauth/authorize?orgId=550e8400-e29b-41d4-a716-446655440000');

console.log('OAuth flow started in browser. After completing, run:');
console.log('cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend && npx ts-node scripts/verify-oauth.ts 550e8400-e29b-41d4-a716-446655440000');
