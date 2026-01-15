require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const tables = [
    'appointments',
    'providers',
    'provider_credentials',
    'calendar_credentials',
    'profiles',
    'organizations',
    'contacts',
    'leads',
  ];

  for (const table of tables) {
    const { data, error } = await sb.from(table).select('*').limit(1);
    if (!error) {
      const cols = data && data[0] ? Object.keys(data[0]).join(', ') : 'empty';
      console.log(`YES ${table}: ${cols}`);
    } else if (error.code === 'PGRST205') {
      console.log(`NO ${table}: table does not exist`);
    } else {
      console.log(`ERR ${table}: ${error.code}`);
    }
  }
})();
