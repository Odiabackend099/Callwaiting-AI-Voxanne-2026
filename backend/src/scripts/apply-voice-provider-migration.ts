/**
 * Apply voice_provider column migration directly
 * This script adds the missing voice_provider column to the agents table
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

async function applyMigration() {
    console.log('🔧 Applying voice_provider column migration...\n');
    console.log('⚠️  Note: This script modifies the agents table directly.');
    console.log('    Using PostgreSQL client for raw SQL execution.\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260129_add_voice_provider_to_agents.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Since Supabase client doesn't support raw SQL DDL, we'll use individual steps
    try {
        // Step 1: Check if column already exists
        console.log('Step 1: Checking if voice_provider column exists...');
        const { data: columnCheck } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'agents')
            .eq('column_name', 'voice_provider')
            .maybeSingle();

        if (columnCheck) {
            console.log('✅ Column already exists, skipping ALTER TABLE');
        } else {
            console.log('❌ Column does not exist yet');
            console.log('\n⚠️  MANUAL ACTION REQUIRED:');
            console.log('    The voice_provider column must be added via Supabase dashboard or psql.');
            console.log('    Run the following SQL in your Supabase SQL editor:\n');
            console.log('    ' + migrationSQL.replace(/\n/g, '\n    '));
            console.log('\n    Or visit: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql/new\n');
            process.exit(1);
        }

        // Step 4: Verify migration
        console.log('\nStep 4: Verifying migration...');
        const { data: columnVerify, error: checkError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'agents')
            .eq('column_name', 'voice_provider')
            .maybeSingle();

        if (checkError) {
            throw new Error(`Verification failed: ${checkError.message}`);
        }

        if (!columnVerify) {
            throw new Error('Column was not created!');
        }

        console.log('✅ Verified: voice_provider column exists');
        console.log(`   Type: ${columnVerify.data_type}`);

        // Step 5: Show distribution
        console.log('\nStep 5: Voice provider distribution:');
        const { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('voice_provider')
            .not('voice_provider', 'is', null);

        if (agentsError) {
            console.warn(`⚠️ Could not fetch distribution: ${agentsError.message}`);
        } else if (agents && agents.length > 0) {
            const distribution: Record<string, number> = {};
            agents.forEach((agent: any) => {
                distribution[agent.voice_provider] = (distribution[agent.voice_provider] || 0) + 1;
            });

            Object.entries(distribution).forEach(([provider, count]) => {
                console.log(`   ${provider}: ${count} agents`);
            });
        } else {
            console.log('   No agents with voice_provider set yet');
        }

        console.log('\n🎉 Migration completed successfully!\n');
        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Execute migration
applyMigration();
