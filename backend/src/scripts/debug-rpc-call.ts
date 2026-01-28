#!/usr/bin/env tsx
/**
 * Debug RPC Call - Test exact parameters being sent to match_knowledge_chunks
 */

// CRITICAL: Import config FIRST to load environment variables
import { config } from '../config';

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/embeddings';

const SUPABASE_URL = config.SUPABASE_URL || '';
const SUPABASE_KEY = config.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugRpcCall() {
  console.log('\n🔍 Debugging RPC Call to match_knowledge_chunks\n');

  // Step 1: Get org_id
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .or('name.ilike.%voxanne%,email.ilike.%voxanne@demo.com%')
    .limit(1);

  const orgId = orgs?.[0]?.id;
  console.log(`Org ID: ${orgId}\n`);

  // Step 2: Generate a test embedding
  const testQuery = 'How much do your services cost?';
  console.log(`Generating embedding for: "${testQuery}"`);

  const embedding = await generateEmbedding(testQuery);

  console.log(`Embedding generated:`);
  console.log(`  Type: ${typeof embedding}`);
  console.log(`  Is Array: ${Array.isArray(embedding)}`);
  console.log(`  Length: ${embedding.length}`);
  console.log(`  First 3 values: [${embedding.slice(0, 3).join(', ')}]`);
  console.log();

  // Step 3: Call RPC with detailed logging
  console.log('Calling match_knowledge_chunks RPC...');
  console.log('Parameters:');
  console.log(`  query_embedding: number[] (length ${embedding.length})`);
  console.log(`  match_threshold: 0.6`);
  console.log(`  match_count: 5`);
  console.log(`  p_org_id: ${orgId}`);
  console.log();

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_threshold: 0.6,
    match_count: 5,
    p_org_id: orgId
  });

  console.log('RPC Response:');
  if (error) {
    console.log(`  ❌ Error: ${error.message}`);
    console.log(`  Code: ${error.code}`);
    console.log(`  Details: ${JSON.stringify(error.details)}`);
    console.log(`  Hint: ${error.hint}`);
  } else {
    console.log(`  ✅ Success`);
    console.log(`  Chunks returned: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log(`  Sample result:`);
      console.log(`    ID: ${data[0].id}`);
      console.log(`    Similarity: ${data[0].similarity}`);
      console.log(`    Content: ${data[0].content.substring(0, 100)}...`);
    }
  }

  // Step 4: Try with a database embedding to compare
  console.log('\n\n🔬 Comparison Test: Using database embedding directly\n');

  const { data: dbChunk } = await supabase
    .from('knowledge_base_chunks')
    .select('embedding')
    .eq('org_id', orgId)
    .limit(1)
    .single();

  if (dbChunk) {
    console.log('Database embedding:');
    console.log(`  Type: ${typeof dbChunk.embedding}`);
    console.log(`  Is Array: ${Array.isArray(dbChunk.embedding)}`);

    // Try calling RPC with database embedding
    const { data: dbData, error: dbError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: dbChunk.embedding,
      match_threshold: 0.1,
      match_count: 10,
      p_org_id: orgId
    });

    console.log('\nRPC with database embedding:');
    if (dbError) {
      console.log(`  ❌ Error: ${dbError.message}`);
    } else {
      console.log(`  ✅ Chunks returned: ${dbData?.length || 0}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('Debug complete');
  console.log('═'.repeat(80) + '\n');
}

debugRpcCall().catch(console.error);
