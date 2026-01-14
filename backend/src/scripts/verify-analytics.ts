
import { supabase } from '../services/supabase-client';
import { scoreLead } from '../services/lead-scoring';

async function verifyAnalyticsLogic() {
    console.log('📊 ANALYTICS & REVENUE LOGIC VERIFICATION');
    console.log('==================================================');

    const TEST_PHONE = '+447911123456';
    let orgId: string | null = null;
    let leadId: string | null = null;

    try {
        // 1. Setup Context
        const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
        if (!orgData) throw new Error('No Organization found.');
        orgId = orgData.id!;

        // 2. Simulate "Injecting" a Call Record (Simulating what the Webhook does)
        // We need a lead first
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .upsert({
                org_id: orgId,
                name: 'Analytics Test User',
                phone: TEST_PHONE,
                email: 'analytics_test@example.com',
                status: 'new'
            })
            .select()
            .single();

        if (leadError) throw leadError;
        leadId = lead.id;
        console.log(`✅ Test Lead Created: ${lead.id}`);

        // 3. Run the Logic (Simulation of Webhook)
        const transcript = "I am interested in book a Rhinoplasty consultation. Money is not an issue.";

        // IMPORTED logic from our service
        const { estimateLeadValue } = require('../services/lead-scoring');
        const calculatedValue = estimateLeadValue(transcript);

        console.log(`ℹ️ Logic returned: £${calculatedValue}`);

        // Simulate DB Update (what webhook does)
        const { error: updateError } = await supabase.from('leads')
            .update({
                metadata: {
                    potential_value: calculatedValue
                }
            })
            .eq('id', leadId);

        if (updateError) throw updateError;

        // Refetch to verify persistence
        const { data: refreshedLead } = await supabase
            .from('leads')
            .select('metadata')
            .eq('id', leadId)
            .single();

        if (refreshedLead.metadata?.potential_value) {
            console.log(`ℹ️ Persisted Value: £${refreshedLead.metadata.potential_value}`);
        } else {
            console.log('⚠️ Current Value: undefined');
        }

        // 4. Assert Failure (Verification Step)
        if (!refreshedLead.metadata?.potential_value) {
            console.error('❌ FAIL: Lead has no financial value assigned.');
            process.exit(1);
        } else if (refreshedLead.metadata.potential_value !== 8000) {
            console.error(`❌ FAIL: Incorrect Value. Got ${refreshedLead.metadata.potential_value}, wanted 8000`);
            process.exit(1);
        }

        console.log('✅ PASS: Logic correctly identified value.');
        process.exit(0);

    } catch (err: any) {
        console.error('🔥 ERROR:', err.message);
        process.exit(1);
    }
}

verifyAnalyticsLogic();
