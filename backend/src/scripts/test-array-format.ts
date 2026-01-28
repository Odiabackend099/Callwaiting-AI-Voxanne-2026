#!/usr/bin/env tsx
/**
 * Test different array formats for vector RPC calls
 */

import { config } from '../config';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/embeddings';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

async function testArrayFormats() {
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  console.log('\n🧪 Testing Different Array Formats for Vector RPC\n');

  // Generate a test embedding
  const embedding = await generateEmbedding('test query');
  console.log(`Generated embedding: ${embedding.length} dimensions\n`);

  // Test 1: Raw JavaScript array (current approach)
  console.log('Test 1: Raw JavaScript array');
  const { data: data1, error: error1 } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_threshold: 0.1,
    match_count: 10,
    p_org_id: orgId
  });
  console.log(`  Result: ${data1?.length || 0} chunks`);
  if (error1) console.log(`  Error: ${error1.message}`);
  console.log();

  // Test 2: Stringified array (PostgreSQL format)
  console.log('Test 2: Stringified array as PostgreSQL vector literal');
  const vectorString = `[${embedding.join(',')}]`;
  const { data: data2, error: error2 } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: vectorString,
    match_threshold: 0.1,
    match_count: 10,
    p_org_id: orgId
  });
  console.log(`  Result: ${data2?.length || 0} chunks`);
  if (error2) console.log(`  Error: ${error2.message}`);
  console.log();

  // Test 3: Using a SELECT statement (what works in SQL)
  console.log('Test 3: Direct SQL query (what we know works)');
  const { data: data3, error: error3 } = await supabase
    .from('knowledge_base_chunks')
    .select('id, content')
    .eq('org_id', orgId)
    .limit(5);
  console.log(`  Result: ${data3?.length || 0} chunks (no similarity, just fetch)`);
  if (error3) console.log(`  Error: ${error3.message}`);
  console.log();

  // Test 4: Check what type the database is actually receiving
  console.log('Test 4: Check actual similarity scores with manual calculation');
  const { data: chunks } = await supabase
    .from('knowledge_base_chunks')
    .select('id, embedding, content')
    .eq('org_id', orgId)
    .limit(3);

  if (chunks && chunks.length > 0) {
    console.log(`  Fetched ${chunks.length} chunks from DB`);
    console.log(`  Sample embedding type from DB: ${typeof chunks[0].embedding}`);
    console.log(`  Sample embedding is array: ${Array.isArray(chunks[0].embedding)}`);
  }
}

testArrayFormats().catch(console.error);
