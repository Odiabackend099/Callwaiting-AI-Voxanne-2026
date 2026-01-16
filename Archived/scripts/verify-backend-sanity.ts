
import axios from 'axios';
import 'dotenv/config';

async function main() {
    const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
    console.log(`Checking Backend at ${BASE_URL}...`);

    try {
        // 1. Health Check
        console.log('1. Checking Health Endpoint...');
        const health = await axios.get(`${BASE_URL}/health`);
        console.log('   ✅ Health OK:', health.status, health.data);

        // 2. Auth Token (Simulate or use from env)
        // In dev, we can potentially bypass or we need a real token.
        // We'll try to hit a robust public endpoint or assume we have a DEV token if needed.
        // But /agent/config requires auth.
        // If we can't easily auth, we'll skip authenticated checks and just report Health is OK.

        // Check if we can use a dev header or if we are in dev mode
        // founder-console-v2.ts uses requireAuthOrDev
        // If NODE_ENV=development, it might allow access? checking middleware...
        // verify-latest-agent-sync.ts likely has logic for this.

    } catch (error: any) {
        console.error('   ❌ Check Failed:', error.message);
        if (error.response) {
            console.error('      Status:', error.response.status);
            console.error('      Data:', error.response.data);
        }
    }
}

main();
