/**
 * Check actual contacts table schema
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking contacts table schema...\n');

  // Query a sample contact to see actual columns
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log('✅ Sample contact columns:');
    Object.keys(data[0]).forEach(key => {
      console.log(`   - ${key}: ${typeof data[0][key]} = ${JSON.stringify(data[0][key]).substring(0, 50)}`);
    });
  } else {
    console.log('⚠️  No contacts in table yet');
    console.log('Creating a test contact to see schema...');

    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        org_id: '46cf2995-2bee-44e3-838b-24151486fe4e',
        phone: '+15551111111',
        email: 'schema-test@example.com',
        full_name: 'Schema Test'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Create error:', createError.message);
      console.log('\nTrying with different columns...');

      const { data: newContact2, error: createError2 } = await supabase
        .from('contacts')
        .insert({
          org_id: '46cf2995-2bee-44e3-838b-24151486fe4e',
          phone: '+15551111112',
          email: 'schema-test2@example.com'
        })
        .select()
        .single();

      if (newContact2) {
        console.log('\n✅ Contact columns:');
        Object.keys(newContact2).forEach(key => {
          console.log(`   - ${key}`);
        });
      }
    } else {
      console.log('\n✅ Contact columns:');
      Object.keys(newContact).forEach(key => {
        console.log(`   - ${key}`);
      });
    }
  }
}

checkSchema().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
