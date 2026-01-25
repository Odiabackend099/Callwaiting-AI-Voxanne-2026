console.log('STARTING DEBUG SCRIPT');
import dotenv from 'dotenv';
console.log('Imported dotenv');
import path from 'path';
console.log('Imported path');

try {
    const envPath = path.resolve(__dirname, '../../.env');
    console.log('Loading .env from:', envPath);
    const result = dotenv.config({ path: envPath });
    console.log('Dotenv result:', result.error ? 'Error' : 'Success');
    if (result.parsed) {
        console.log('VAPI_KEY present:', !!result.parsed.VAPI_PRIVATE_KEY);
    }
} catch (e: any) {
    console.error('Error loading dotenv:', e.message);
}

console.log('VAPI_PRIVATE_KEY env var:', !!process.env.VAPI_PRIVATE_KEY);
console.log('BACKEND_URL env var:', process.env.BACKEND_URL);

console.log('ENDING DEBUG SCRIPT');
