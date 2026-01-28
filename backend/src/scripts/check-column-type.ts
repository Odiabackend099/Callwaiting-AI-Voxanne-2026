import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkColumnType() {
  console.log('\n🔍 Checking embedding column type in database schema:\n');

  // Query information_schema to check actual column type
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'knowledge_base_chunks'
        AND column_name = 'embedding';
      `
    });

  if (error) {
    console.log('⚠️  Using alternative method...\n');

    // Try direct query
    const { data: chunks, error: err2 } = await supabase
      .from('knowledge_base_chunks')
      .select('embedding')
      .limit(1);

    if (err2) {
      console.error('❌ Error:', err2.message);
      return;
    }

    if (chunks && chunks.length > 0) {
      const emb = chunks[0].embedding;
      console.log('Sample embedding data:');
      console.log(`  Type in JavaScript: ${typeof emb}`);
      console.log(`  Is Array: ${Array.isArray(emb)}`);
      console.log(`  Is String: ${typeof emb === 'string'}`);

      if (typeof emb === 'string') {
        console.log(`  String length: ${emb.length}`);
        console.log('');
        console.log('❌ PROBLEM: Embedding is still stored as TEXT/STRING');
        console.log('');
        console.log('This means the migration did NOT complete successfully.');
        console.log('');
        console.log('Possible causes:');
        console.log('  1. The migration SQL had errors');
        console.log('  2. The conversion step failed');
        console.log('  3. Wrong version was executed');
        console.log('');
        console.log('Please verify in Supabase SQL Editor:');
        console.log('');
        console.log('  SELECT column_name, data_type, udt_name');
        console.log("  FROM information_schema.columns");
        console.log("  WHERE table_name = 'knowledge_base_chunks'");
        console.log("  AND column_name = 'embedding';");
      } else if (Array.isArray(emb)) {
        console.log(`  Array length: ${emb.length}`);
        console.log('');
        console.log('✅ SUCCESS: Embedding is now properly typed as vector');
        console.log('   PostgreSQL vector type is returned as JavaScript array');
      }
    }
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  Column not found in information_schema');
    return;
  }

  const col = data[0];
  console.log(`Column: ${col.column_name}`);
  console.log(`Data Type: ${col.data_type}`);
  console.log(`UDT Name: ${col.udt_name}`);
  console.log('');

  if (col.udt_name === 'vector') {
    console.log('✅ SUCCESS: Column is properly typed as vector(1536)');
  } else {
    console.log(`❌ PROBLEM: Column type is ${col.udt_name}, expected: vector`);
    console.log('');
    console.log('The migration did not complete successfully.');
    console.log('Please re-run the CLEAN migration in Supabase SQL Editor.');
  }
}

checkColumnType();
