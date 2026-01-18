
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

async function deleteAllPhoneNumbers() {
    console.log('🚨 STARTING BULK DELETE OF VAPI PHONE NUMBERS 🚨');
    console.log(`🔑 Using Key: ${VAPI_PRIVATE_KEY.substring(0, 8)}...`);

    try {
        // 1. List existing numbers
        console.log('🔍 Fetching current phone numbers...');
        const listResponse = await axios.get(`${VAPI_BASE_URL}/phone-number`, {
            headers: {
                'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const numbers = listResponse.data;

        if (!Array.isArray(numbers) || numbers.length === 0) {
            console.log('✅ No phone numbers found to delete.');
            return;
        }

        console.log(`found ${numbers.length} numbers. Deleting...`);

        // 2. Delete each number
        for (const num of numbers) {
            const phoneNumberId = num.id;
            const phoneNumber = num.number;

            try {
                console.log(`🗑️ Deleting ${phoneNumber} (ID: ${phoneNumberId})...`);
                await axios.delete(`${VAPI_BASE_URL}/phone-number/${phoneNumberId}`, {
                    headers: {
                        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`✅ Deleted ${phoneNumber}`);
            } catch (deleteError: any) {
                console.error(`❌ Failed to delete ${phoneNumber}: ${deleteError.message}`);
                if (deleteError.response) {
                    console.error(`   Details: ${JSON.stringify(deleteError.response.data)}`);
                }
            }
        }

        console.log('\n🏁 Deletion process completed.');

    } catch (error: any) {
        if (error.response) {
            console.error(`❌ API Error during list: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`❌ Error: ${error.message}`);
        }
    }
}

deleteAllPhoneNumbers();
