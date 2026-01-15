
// backend/debug-env.ts
require('dotenv').config();
console.log('CWD:', process.cwd());
console.log('VAPI_API_KEY:', process.env.VAPI_API_KEY ? 'FOUND' : 'MISSING');
console.log('Value (first 4):', process.env.VAPI_API_KEY ? process.env.VAPI_API_KEY.substring(0, 4) : 'N/A');
