
import path from 'path';
import { config } from '../config/index';
import dotenv from 'dotenv';
// Explicitly load from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { VapiClient } from '../services/vapi-client';

async function simulateInboundSetup() {
    // Validate all required credentials are provided via environment variables
    // Never hardcode credentials in source code
    // BYOC: Inbound setup uses master creds (provisioning operation)
    const requiredEnvVars = ['TWILIO_MASTER_ACCOUNT_SID', 'TWILIO_MASTER_AUTH_TOKEN', 'VAPI_PRIVATE_KEY'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        console.error('❌ CRITICAL: Missing required environment variables:');
        missingVars.forEach(v => console.error(`   - ${v}`));
        console.error('\nPlease set these variables in your .env file before running this script.');
        console.error('Note: Pass phone number as CLI argument: npm run simulate:inbound -- +1234567890');
        process.exit(1);
    }

    const phoneNumber = process.argv[2];
    if (!phoneNumber) {
        console.error('❌ CRITICAL: Phone number must be provided as CLI argument');
        console.error('Usage: npm run simulate:inbound -- +1234567890');
        process.exit(1);
    }

    const twilioConfig = {
        accountSid: process.env.TWILIO_MASTER_ACCOUNT_SID!,
        authToken: process.env.TWILIO_MASTER_AUTH_TOKEN!,
        phoneNumber
    };

    console.log('--- Simulating Inbound Setup (Platform Provider Model) ---');
    console.log('1. Checking Environment Variables...');
    if (!config.VAPI_PRIVATE_KEY) {
        console.error('CRITICAL: VAPI_PRIVATE_KEY is missing from environment!');
        process.exit(1);
    }
    console.log('   VAPI_PRIVATE_KEY found (length: ' + config.VAPI_PRIVATE_KEY.length + ')');

    console.log('\n2. Initializing VapiClient with Platform Key...');
    // This uses the default constructor which pulls from config.VAPI_PRIVATE_KEY
    // verifying our code change in vapi-client.ts
    const vapi = new VapiClient();

    console.log('\n3. Importing Twilio Number to Vapi...');
    try {
        const result = await vapi.importTwilioNumber({
            phoneNumber: twilioConfig.phoneNumber,
            twilioAccountSid: twilioConfig.accountSid,
            twilioAuthToken: twilioConfig.authToken,
            name: 'Simulated Inbound Import'
        });

        console.log('   Import Success!');
        console.log('   Vapi Phone ID:', result.id);
        console.log('   Vapi Phone Number:', result.number);
        console.log('   Provider:', result.provider);

    } catch (error: any) {
        console.error('   Import Failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
    }

    console.log('\n4. Verifying Import in Vapi Dashboard (Listing Numbers)...');
    try {
        const numbers = await vapi.listPhoneNumbers();
        const found = numbers.find((n: any) => n.number === twilioConfig.phoneNumber);

        if (found) {
            console.log('   VERIFIED: Number found in Vapi Dashboard list.');
            console.log(`   ID: ${found.id}, Number: ${found.number}, AssistantID: ${found.assistantId || 'None'}`);
        } else {
            console.error('   FAILED: Number NOT found in Vapi Dashboard list.');
            console.log('   List dump:', numbers.map((n: any) => n.number));
        }

    } catch (error: any) {
        console.error('   Verification Failed:', error.message);
    }
}

simulateInboundSetup().catch(console.error);
