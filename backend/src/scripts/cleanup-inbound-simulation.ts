
import path from 'path';
import dotenv from 'dotenv';
// Explicitly load from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';

async function cleanupInboundSimulation() {
    // Get phone number from command line argument
    const phoneNumberToRemove = process.argv[2];

    if (!phoneNumberToRemove) {
        console.error('❌ ERROR: Phone number not provided');
        console.error('Usage: npm run cleanup:inbound -- <phone-number>');
        process.exit(1);
    }

    console.log('--- Cleanup Inbound Simulation ---');
    console.log(`Removing phone number: ${phoneNumberToRemove}`);

    // 1. Remove from Vapi
    try {
        const vapi = new VapiClient();
        console.log('Fetching Vapi numbers...');
        const numbers = await vapi.listPhoneNumbers();
        const target = numbers.find((n: any) => n.number === phoneNumberToRemove);

        if (target) {
            console.log(`Found number in Vapi (ID: ${target.id}). Deleting...`);
            await vapi.deletePhoneNumber(target.id);
            console.log('Successfully deleted number from Vapi.');
        } else {
            console.log('Number not found in Vapi. Skipping deletion.');
        }
    } catch (error: any) {
        console.error('Failed to clean up Vapi:', error.message);
    }

    // 2. Remove from Database (integrations table)
    try {
        console.log('Cleaning up database (integrations)...');
        // Find integration config with this number (simplified check)
        const { data: integrations, error: fetchError } = await supabase
            .from('integrations')
            .select('id, config')
            .eq('provider', 'twilio_inbound'); // Assuming it was stored as twilio_inbound

        if (fetchError) {
            console.error('DB Fetch Error:', fetchError.message);
        } else if (integrations && integrations.length > 0) {
            for (const integration of integrations) {
                const config = integration.config as any;
                if (config?.phoneNumber === PHONE_NUMBER_TO_REMOVE) {
                    console.log(`Found integration ${integration.id} with number. Clearing...`);
                    await supabase
                        .from('integrations')
                        .delete()
                        .eq('id', integration.id);
                    console.log('Deleted integration record.');
                }
            }
        }
    } catch (error: any) {
        console.error('Failed to clean up Database:', error.message);
    }

    // 3. Remove from integration_settings
    try {
        console.log('Cleaning up database (integration_settings)...');
        await supabase
            .from('integration_settings')
            .update({
                twilio_from_number: null,
                twilio_account_sid: null,
                twilio_auth_token: null
            })
            .eq('twilio_from_number', PHONE_NUMBER_TO_REMOVE);
        console.log('Cleared integration_settings fields for this number.');
    } catch (error: any) {
        console.error('Failed to clean up integration_settings:', error.message);
    }

    console.log('--- Cleanup Complete ---');
}

cleanupInboundSimulation().catch(console.error);
