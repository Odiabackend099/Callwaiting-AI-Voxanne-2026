#!/usr/bin/env ts-node
/**
 * Vector Search Diagnostic
 *
 * Tests if the match_knowledge_chunks RPC function exists and works
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnose() {
  console.log('\n🔍 VECTOR SEARCH DIAGNOSTIC\n');

  // Find org
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .or('name.ilike.%voxanne%,email.ilike.%voxanne@demo.com%')
    .limit(1);

  const orgId = orgs?.[0]?.id;
  console.log(`Org ID: ${orgId}\n`);

  // Test 1: Check if chunks table has data
  console.log('Test 1: Checking knowledge_base_chunks table...');
  const { data: chunks, error: chunksError } = await supabase
    .from('knowledge_base_chunks')
    .select('id, org_id, embedding')
    .eq('org_id', orgId)
    .limit(3);

  if (chunksError) {
    console.log(`❌ Error: ${chunksError.message}\n`);
  } else {
    console.log(`✅ Found ${chunks?.length || 0} chunks`);
    if (chunks && chunks.length > 0) {
      const chunk = chunks[0];
      console.log(`   Sample chunk ID: ${chunk.id}`);
      console.log(`   Has embedding: ${chunk.embedding ? 'YES' : 'NO'}`);
      if (chunk.embedding) {
        const embType = typeof chunk.embedding;
        const isArray = Array.isArray(chunk.embedding);
        console.log(`   Embedding type: ${embType}`);
        console.log(`   Is array: ${isArray}`);
        if (isArray) {
          console.log(`   Array length: ${chunk.embedding.length}`);
          console.log(`   First value type: ${typeof chunk.embedding[0]}`);
          console.log(`   First 3 values: [${chunk.embedding.slice(0, 3).join(', ')}...]`);
        } else if (embType === 'string') {
          console.log(`   ❌ PROBLEM: Embedding stored as STRING!`);
          console.log(`   String length: ${chunk.embedding.length} characters`);
          console.log(`   Preview: ${chunk.embedding.substring(0, 50)}...`);
        }
      }
    }
    console.log('');
  }

  // Test 2: Try calling RPC with dummy embedding
  console.log('Test 2: Testing match_knowledge_chunks RPC function...');
  const dummyEmbedding = new Array(1536).fill(0.1);

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'match_knowledge_chunks',
    {
      query_embedding: dummyEmbedding,
      match_threshold: 0.1,
      match_count: 5,
      p_org_id: orgId
    }
  );

  if (rpcError) {
    console.log(`❌ RPC Error: ${rpcError.message}`);
    console.log(`   Error code: ${rpcError.code}`);
    console.log(`   Details: ${rpcError.details}`);
    console.log(`   Hint: ${rpcError.hint}`);
    console.log('\n🚨 DIAGNOSIS: RPC function may not exist or has wrong signature');
    console.log('   Fix: Run migrations to create the function\n');
  } else {
    console.log(`✅ RPC function exists and returned ${rpcData?.length || 0} chunks`);
    if (rpcData && rpcData.length > 0) {
      console.log(`   Sample result: ${JSON.stringify(rpcData[0]).substring(0, 100)}...`);
    }
    console.log('');
  }

  // Test 3: Check pgvector extension
  console.log('Test 3: Checking pgvector extension...');
  const { data: extensions, error: extError } = await supabase.rpc('get_installed_extensions');

  if (extError) {
    console.log('❌ Cannot check extensions (function may not exist)');
    console.log('   Try querying pg_extension table manually\n');
  } else {
    const hasVector = extensions?.some((ext: any) => ext.name === 'vector');
    if (hasVector) {
      console.log('✅ pgvector extension is installed\n');
    } else {
      console.log('❌ pgvector extension NOT found');
      console.log('   Fix: Install pgvector extension in Supabase\n');
    }
  }

  console.log('═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60) + '\n');

  if (!chunksError && chunks && chunks.length > 0 && !rpcError) {
    console.log('✅ Knowledge base chunks exist');
    console.log('✅ RPC function is callable');
    console.log('\n⚠️  But zero results means:');
    console.log('   1. Similarity threshold (0.6) may be too high');
    console.log('   2. Embeddings may not match (different model?)');
    console.log('   3. Vector index may need rebuilding\n');
  } else if (rpcError) {
    console.log('❌ RPC FUNCTION DOES NOT EXIST');
    console.log('\n📝 To fix:');
    console.log('   1. Check if migrations have been run');
    console.log('   2. Create the function manually in Supabase SQL editor');
    console.log('   3. See backend/src/services/embeddings.ts for function definition\n');
  }
}

diagnose();
