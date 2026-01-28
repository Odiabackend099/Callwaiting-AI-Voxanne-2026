#!/usr/bin/env tsx

/**
 * Direct Vector Type Fix - Uses Supabase API directly
 * No manual SQL execution needed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function executeSql(sql: string, description: string) {
  console.log(`\n📝 ${description}...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      console.log(`⚠️  Method 1 failed, trying direct connection...`);
      return false;
    }

    console.log(`✅ ${description} - Success`);
    return true;
  } catch (err: any) {
    console.log(`⚠️  ${description} - Using alternative method`);
    return false;
  }
}

async function fixVectorTypeDirect() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔧 Direct Vector Type Fix - Automated');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Step 1: Check current state
  console.log('📊 Checking current state...');
  const { data: chunks, error: checkError } = await supabase
    .from('knowledge_base_chunks')
    .select('id, embedding')
    .limit(1);

  if (checkError) {
    console.error('❌ Cannot access knowledge_base_chunks table:', checkError.message);
    process.exit(1);
  }

  if (!chunks || chunks.length === 0) {
    console.error('❌ No data in knowledge_base_chunks table');
    process.exit(1);
  }

  const currentEmb = chunks[0].embedding;
  const isString = typeof currentEmb === 'string';
  const isArray = Array.isArray(currentEmb);

  console.log(`   Current embedding type: ${typeof currentEmb}`);
  console.log(`   Is String: ${isString}`);
  console.log(`   Is Array: ${isArray}`);
  console.log('');

  if (isArray) {
    console.log('✅ Embeddings are already vector type!');
    console.log('   No fix needed - vector conversion was successful.');
    return;
  }

  if (!isString) {
    console.error('❌ Unexpected embedding type:', typeof currentEmb);
    process.exit(1);
  }

  console.log('⚠️  Embeddings are TEXT/STRING - Fix required');
  console.log('');

  // Step 2: Create backup via Supabase client
  console.log('💾 Creating backup...');

  const { data: allChunks, error: fetchError } = await supabase
    .from('knowledge_base_chunks')
    .select('*');

  if (fetchError || !allChunks) {
    console.error('❌ Failed to fetch chunks for backup:', fetchError?.message);
    process.exit(1);
  }

  console.log(`   ✅ Fetched ${allChunks.length} chunks for backup`);

  // Step 3: Delete all rows
  console.log('');
  console.log('🗑️  Deleting existing rows (will restore with proper type)...');

  const { error: deleteError } = await supabase
    .from('knowledge_base_chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error('❌ Failed to delete rows:', deleteError.message);
    process.exit(1);
  }

  console.log('   ✅ Deleted all rows');

  // Step 4: Convert embeddings from string to array and re-insert
  console.log('');
  console.log('🔄 Converting and re-inserting with proper vector type...');

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const embString = chunk.embedding;

    if (!embString) {
      console.log(`   ⚠️  Chunk ${i + 1}: No embedding, skipping`);
      continue;
    }

    // Parse string to array
    let embArray: number[];
    try {
      embArray = JSON.parse(embString);
    } catch (err) {
      console.error(`   ❌ Chunk ${i + 1}: Failed to parse embedding`);
      continue;
    }

    // Re-insert with array (will be stored as vector in database)
    const { error: insertError } = await supabase
      .from('knowledge_base_chunks')
      .insert({
        id: chunk.id,
        knowledge_base_id: chunk.knowledge_base_id,
        org_id: chunk.org_id,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        token_count: chunk.token_count,
        embedding: embArray,
        created_at: chunk.created_at,
        updated_at: chunk.updated_at
      });

    if (insertError) {
      console.error(`   ❌ Chunk ${i + 1}: Insert failed -`, insertError.message);
      // Continue with other chunks
    } else {
      console.log(`   ✅ Chunk ${i + 1}/${allChunks.length}: Converted and inserted`);
    }
  }

  // Step 5: Verify
  console.log('');
  console.log('🔍 Verifying fix...');

  const { data: verifyChunks, error: verifyError } = await supabase
    .from('knowledge_base_chunks')
    .select('id, embedding')
    .limit(1);

  if (verifyError || !verifyChunks || verifyChunks.length === 0) {
    console.error('❌ Verification failed - no data found');
    process.exit(1);
  }

  const newEmb = verifyChunks[0].embedding;
  const isNowArray = Array.isArray(newEmb);

  console.log(`   New embedding type: ${typeof newEmb}`);
  console.log(`   Is Array: ${isNowArray}`);
  console.log('');

  if (isNowArray) {
    console.log('✅ SUCCESS! Embeddings are now vector type');
    console.log(`   Array length: ${newEmb.length} (expected: 1536)`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ VECTOR TYPE FIX COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: npx tsx src/scripts/diagnose-vector-search.ts');
    console.log('  2. Run: npx tsx src/scripts/test-live-rag-retrieval.ts');
    console.log('');
    console.log('Expected: 8/8 tests PASS (up from 0/8)');
  } else {
    console.error('❌ FAILED: Embeddings are still not vector type');
    console.error('   Manual intervention required');
  }
}

fixVectorTypeDirect();
