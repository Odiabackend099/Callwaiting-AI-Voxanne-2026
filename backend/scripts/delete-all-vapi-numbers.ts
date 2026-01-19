/**
 * Delete all phone numbers from VAPI account
 * Usage: npx tsx scripts/delete-all-vapi-numbers.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY;

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_PRIVATE_KEY not found in .env');
  process.exit(1);
}

const vapiClient = axios.create({
  baseURL: 'https://api.vapi.ai',
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function deleteAllPhoneNumbers() {
  try {
    console.log('🔍 Fetching all phone numbers from VAPI...\n');

    // List all phone numbers
    const listResponse = await vapiClient.get('/phone-number');
    const phoneNumbers = listResponse.data;

    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      console.log('✅ No phone numbers found in VAPI account');
      return;
    }

    console.log(`📱 Found ${phoneNumbers.length} phone number(s):\n`);
    
    // Display all numbers
    phoneNumbers.forEach((num, index) => {
      console.log(`${index + 1}. ${num.phoneNumber || num.id}`);
      console.log(`   Provider: ${num.provider || 'unknown'}`);
      console.log(`   ID: ${num.id}`);
      console.log(`   Created: ${num.createdAt || 'unknown'}\n`);
    });

    console.log('🗑️  Deleting all phone numbers...\n');

    let successCount = 0;
    let failureCount = 0;

    // Delete each phone number
    for (const phoneNumber of phoneNumbers) {
      try {
        const phoneNumberId = phoneNumber.id;
        console.log(`Deleting: ${phoneNumber.phoneNumber || phoneNumberId}...`);
        
        await vapiClient.delete(`/phone-number/${phoneNumberId}`);
        
        console.log(`✅ Deleted: ${phoneNumber.phoneNumber || phoneNumberId}\n`);
        successCount++;
      } catch (error: any) {
        failureCount++;
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`❌ Failed to delete ${phoneNumber.phoneNumber || phoneNumber.id}: ${errorMsg}\n`);
      }
    }

    console.log('═'.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully deleted: ${successCount}`);
    console.log(`   ❌ Failed to delete: ${failureCount}`);
    console.log(`   📱 Total: ${phoneNumbers.length}\n`);

    if (failureCount === 0) {
      console.log('🎉 All phone numbers have been deleted successfully!');
    } else {
      console.log('⚠️  Some phone numbers could not be deleted.');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

// Run the script
deleteAllPhoneNumbers();
