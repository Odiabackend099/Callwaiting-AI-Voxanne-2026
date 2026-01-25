
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const USER_EMAIL = 'voxanne@demo.com';

async function fixMembership() {
    console.log(`🔧 Fixing Membership for ${USER_EMAIL} -> ${ORG_ID}\n`);

    // 1. Find User ID from auth.users (admin only)
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('❌ Error listing users:', userError.message);
        return;
    }

    const user = users.find(u => u.email === USER_EMAIL);

    if (!user) {
        console.error(`❌ User ${USER_EMAIL} not found in auth.users`);
        console.log('Available users:', users.map(u => u.email).join(', '));
        return;
    }

    console.log(`✅ Found User ID: ${user.id}`);

    // 2. Check if profile exists
    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (existingProfile) {
        console.log('⚠️ Profile already exists:', existingProfile);
        if (existingProfile.org_id !== ORG_ID) {
            console.log('🔄 Updating org_id...');
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ org_id: ORG_ID })
                .eq('id', user.id);

            if (updateError) console.error('❌ Update failed:', updateError.message);
            else console.log('✅ Profile updated!');
        } else {
            console.log('✅ Profile already linked to correct org.');
        }
    } else {
        console.log('➕ Creating new profile...');
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: user.id,
                org_id: ORG_ID,
                role: 'admin', // Default role
                email: USER_EMAIL // If schema has email column
            });

        if (insertError) {
            console.error('❌ Insert failed:', insertError.message);
            // Try without email if column doesn't exist
            if (insertError.message.includes('email')) {
                console.log('   Retrying without email column...');
                const { error: retryError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        org_id: ORG_ID,
                        role: 'admin'
                    });
                if (retryError) console.error('   ❌ Retry failed:', retryError.message);
                else console.log('   ✅ Profile created (no email col)!');
            }
        } else {
            console.log('✅ Profile created successfully!');
        }
    }
}

fixMembership();
