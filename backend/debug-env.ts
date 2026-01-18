
// backend/debug-env.ts
require('dotenv').config();
console.log('CWD:', process.cwd());
console.log('VAPI_PRIVATE_KEY:', config.VAPI_PRIVATE_KEY ? 'FOUND' : 'MISSING');
console.log('Value (first 4):', config.VAPI_PRIVATE_KEY ? config.VAPI_PRIVATE_KEY.substring(0, 4) : 'N/A');
