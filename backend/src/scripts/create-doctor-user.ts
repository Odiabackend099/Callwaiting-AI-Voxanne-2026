
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDoctorUser() {
    const email = 'doctor@clinic.com';
    const password = 'TestPassword123!';

    console.log(`Creating user: ${email}`);

    // Check if user exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    let userId = '';
    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        userId = existingUser.id;
        console.log(`User already exists: ${existingUser.id}. Updating password...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: password }
        );
        if (updateError) {
            console.error('Error updating password:', updateError);
        } else {
            console.log('✅ Password updated successfully.');
        }
    } else {
        console.log('Creating new user...');
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (error) {
            console.error('Error creating user:', error);
            process.exit(1);
        }
        userId = data.user.id;
        console.log('✅ User created:', userId);
    }

    console.log(`\nCredentials for sign-in:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

    // Create organization for the user
    console.log('\nSetting up organization...');
    // Generate a proper UUID v4
    const orgId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    const orgName = `${email} Organization`;

    const { error: createOrgError } = await supabase
        .from('organizations')
        .insert({
            id: orgId,
            name: orgName,
            email: email,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

    if (createOrgError) {
        console.error('Error creating organization:', createOrgError);
    } else {
        console.log(`✅ Organization created: ${orgId}`);
    }

    // Create or update profile with org_id
    console.log('Creating user profile...');
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            org_id: orgId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

    if (profileError) {
        console.error('Error creating profile:', profileError);
    } else {
        console.log(`✅ Profile created with org_id: ${orgId}`);
    }

    // Update user's JWT app_metadata with org_id
    console.log('Updating JWT metadata...');
    const { error: jwtError } = await supabase.auth.admin.updateUserById(
        userId,
        {
            app_metadata: {
                org_id: orgId
            }
        }
    );

    if (jwtError) {
        console.error('Error updating JWT metadata:', jwtError);
    } else {
        console.log(`✅ JWT metadata updated with org_id: ${orgId}`);
    }
}

createDoctorUser()
    .then(() => {
        console.log('\n✅ User creation complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ User creation failed:', err);
        process.exit(1);
    });
