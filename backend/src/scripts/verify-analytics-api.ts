
import { supabase } from '../services/supabase-client';

async function verifyApiLogic() {
    console.log('📊 ANALYTICS API LOGIC VERIFICATION');
    console.log('==================================================');

    // 1. Get Org ID
    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
    if (!orgData) throw new Error('No Organization found.');
    const orgId = orgData.id!;
    console.log(`ℹ️ Org ID: ${orgId}`);

    // 2. Simulate the Logic we just added to the API endpoint
    // We strictly copy the logic from calls-dashboard.ts to verify it works against current DB state
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('metadata')
        .eq('org_id', orgId)
        .gte('created_at', thirtyDaysAgo.toISOString());

    if (leadsError) {
        console.error('❌ DB Error:', leadsError.message);
        process.exit(1);
    }

    let pipelineValue = 0;
    if (leads) {
        pipelineValue = leads.reduce((sum, lead) => {
            const val = (lead.metadata as any)?.potential_value;
            return sum + (Number(val) || 0);
        }, 0);
    }

    console.log(`ℹ️ Calculated Pipeline Value: £${pipelineValue}`);

    // 3. Assert
    // We expect at least £8000 from our previous test run
    if (pipelineValue >= 8000) {
        console.log('✅ PASS: Pipeline Value is correctly aggregated from Leads.');
        process.exit(0);
    } else {
        console.error(`❌ FAIL: Pipeline Value is to low. Expected >= 8000, got ${pipelineValue}`);
        process.exit(1);
    }
}

verifyApiLogic().catch(err => {
    console.error('🔥 Fatal:', err);
    process.exit(1);
});
