import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE importing other modules
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { VerificationService } from '../services/verification';
import { supabase } from '../services/supabase-client';

async function verifyPreFlight() {
    console.log('Starting Pre-Flight Verification Check...');

    // 1. Get an Organization ID (Account Owner)
    const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1);

    if (error || !orgs || orgs.length === 0) {
        console.error('Failed to fetch organization or no organizations found');
        return;
    }

    const orgId = orgs[0].id;
    console.log(`Using Organization: ${orgs[0].name} (${orgId})`);

    // 2. Run Pre-Flight Check
    try {
        const result = await VerificationService.runPreFlightCheck(orgId);
        console.log('\n--- Pre-Flight Check Results ---');
        console.log(JSON.stringify(result, null, 2));
        console.log('--------------------------------');
    } catch (err: any) {
        console.error('Error running pre-flight check:', err.message);
    }
}

verifyPreFlight().catch(console.error);
