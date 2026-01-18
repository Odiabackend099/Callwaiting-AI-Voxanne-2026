
import axios from 'axios';
import { config } from '../config/index';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VAPI_PRIVATE_KEY = config.VAPI_PRIVATE_KEY;

if (!VAPI_PRIVATE_KEY) {
    console.error('❌ Error: VAPI_PRIVATE_KEY not found in environment variables.');
    process.exit(1);
}

const VAPI_BASE_URL = 'https://api.vapi.ai';

async function listPhoneNumbers() {
    console.log('🔍 Fetching phone numbers from Vapi...');
    console.log(`🔑 Using Key: ${VAPI_PRIVATE_KEY.substring(0, 8)}...`);

    try {
        const response = await axios.get(`${VAPI_BASE_URL}/phone-number`, {
            headers: {
                'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const numbers = response.data;

        if (!Array.isArray(numbers) || numbers.length === 0) {
            console.log('✅ No phone numbers found in this workspace.');
            return;
        }

        console.log(`\nFound ${numbers.length} phone numbers:\n`);
        numbers.forEach((num: any) => {
            console.log(`📞 Number: ${num.number} | ID: ${num.id} | Provider: ${num.provider} | Name: ${num.name || 'N/A'}`);
        });

    } catch (error: any) {
        if (error.response) {
            console.error(`❌ API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`❌ Error: ${error.message}`);
        }
    }
}

listPhoneNumbers();
