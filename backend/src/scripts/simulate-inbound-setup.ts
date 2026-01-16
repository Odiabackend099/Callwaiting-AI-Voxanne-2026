
import path from 'path';
import dotenv from 'dotenv';
// Explicitly load from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { VapiClient } from '../services/vapi-client';

async function simulateInboundSetup() {
    // Validate all required credentials are provided via environment variables
    // Never hardcode credentials in source code
    const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'VAPI_API_KEY'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        console.error('❌ CRITICAL: Missing required environment variables:');
        missingVars.forEach(v => console.error(`   - ${v}`));
        console.error('\nPlease set these variables in your .env file before running this script.');
        process.exit(1);
    }

    const twilioConfig = {
        accountSid: process.env.TWILIO_ACCOUNT_SID!,
        authToken: process.env.TWILIO_AUTH_TOKEN!,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER!
    };

    console.log('--- Simulating Inbound Setup (Platform Provider Model) ---');
    console.log('1. Checking Environment Variables...');
    if (!process.env.VAPI_API_KEY) {
        console.error('CRITICAL: VAPI_API_KEY is missing from environment!');
        process.exit(1);
    }
    console.log('   VAPI_API_KEY found (length: ' + process.env.VAPI_API_KEY.length + ')');

    console.log('\n2. Initializing VapiClient with Platform Key...');
    // This uses the default constructor which pulls from process.env.VAPI_API_KEY
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
