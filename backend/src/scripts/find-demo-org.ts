import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function findOrg() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, email')
    .ilike('email', '%voxanne@demo.com%')
    .single();
  
  if (error) {
    console.log('Error:', error.message);
    process.exit(1);
  }
  
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

findOrg();
