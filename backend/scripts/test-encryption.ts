/**
 * Test Encryption Service
 * Verifies that the EncryptionService correctly encrypts and decrypts data
 * using the system's ENCRYPTION_KEY.
 * 
 * Usage: npx ts-node backend/scripts/test-encryption.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import the service (after loading env vars)
import { EncryptionService } from '../src/services/encryption';
import { log } from '../src/services/logger';

async function testEncryption() {
    console.log('🔐 Testing Encryption Service...\n');

    if (!process.env.ENCRYPTION_KEY) {
        console.error('❌ FATAL: ENCRYPTION_KEY is missing from .env');
        process.exit(1);
    }

    console.log('✅ ENCRYPTION_KEY found');

    // Test 1: Simple String Encryption
    console.log('\nTest 1: String Encryption/Decryption');
    const originalText = 'Hello, CallWaiting AI! This is a secret.';

    try {
        const encrypted = EncryptionService.encrypt(originalText);
        console.log(`   Original:  "${originalText}"`);
        console.log(`   Encrypted: "${encrypted}"`);

        // Verify format (iv:authTag:content)
        const parts = encrypted.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted format (expected iv:authTag:content)');
        }

        const decrypted = EncryptionService.decrypt(encrypted);
        console.log(`   Decrypted: "${decrypted}"`);

        if (originalText === decrypted) {
            console.log('   ✅ PASS');
        } else {
            console.error('   ❌ FAIL: Decrypted text does not match original');
        }

    } catch (error: any) {
        console.error('   ❌ FAIL: Error during process', error.message);
    }

    // Test 2: Object Encryption
    console.log('\nTest 2: Object Encryption/Decryption');
    const originalObj = {
        apiKey: 'sk_test_12345',
        apiSecret: 'secret_abc_789',
        settings: {
            enabled: true,
            retryCount: 3
        }
    };

    try {
        // Encrypt object
        const encryptedObj = EncryptionService.encryptObject(originalObj);
        console.log('   Object encrypted successfully');

        // Decrypt object
        const decryptedObj = EncryptionService.decryptObject(encryptedObj);

        // Verify deep equality
        const startJson = JSON.stringify(originalObj);
        const endJson = JSON.stringify(decryptedObj);

        if (startJson === endJson) {
            console.log('   ✅ PASS: Object recovered perfectly');
        } else {
            console.error('   ❌ FAIL: Object mismatch');
            console.log('Expected:', startJson);
            console.log('Received:', endJson);
        }

    } catch (error: any) {
        console.error('   ❌ FAIL: Error during object test', error.message);
    }

    console.log('\n----------------------------------------');
    console.log('Encryption verification complete.');
}

// Run the test
testEncryption().catch(err => {
    console.error('Test script failed:', err);
});
