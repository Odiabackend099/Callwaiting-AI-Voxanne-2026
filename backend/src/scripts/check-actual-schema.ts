#!/usr/bin/env tsx

/**
 * Check Actual Database Schema - Query information_schema directly
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

async function checkActualSchema() {
  console.log('\n🔍 Checking Actual Database Schema\n');

  // Query 1: Get column info from information_schema
  console.log('Query 1: information_schema.columns');
  const { data: cols, error: colError } = await supabase
    .from('information_schema.columns')
    .select('table_name, column_name, data_type, udt_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'knowledge_base_chunks')
    .eq('column_name', 'embedding');

  if (colError) {
    console.log(`   ⚠️  Error: ${colError.message}`);
  } else if (cols && cols.length > 0) {
    const col = cols[0];
    console.log(`   Column: ${col.column_name}`);
    console.log(`   Data Type: ${col.data_type}`);
    console.log(`   UDT Name: ${col.udt_name}`);
    console.log('');

    if (col.udt_name === 'vector') {
      console.log('   ✅ SUCCESS: Column is vector type in database schema');
    } else if (col.data_type === 'text' || col.udt_name === 'text') {
      console.log('   ❌ PROBLEM: Column is still TEXT type');
      console.log('   The migration did NOT change the column type');
    } else {
      console.log(`   ⚠️  Unexpected type: ${col.udt_name}`);
    }
  } else {
    console.log('   ⚠️  Column not found');
  }

  // Query 2: Get all columns to see what exists
  console.log('\nQuery 2: All columns on knowledge_base_chunks table');
  const { data: allCols, error: allColError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, udt_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'knowledge_base_chunks')
    .order('ordinal_position');

  if (allColError) {
    console.log(`   ⚠️  Error: ${allColError.message}`);
  } else if (allCols && allCols.length > 0) {
    console.log('');
    allCols.forEach(col => {
      const marker = col.column_name === 'embedding' ? ' ← EMBEDDING COLUMN' : '';
      const vectorMarker = col.udt_name === 'vector' ? ' [VECTOR]' : '';
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.udt_name})${vectorMarker}${marker}`);
    });

    // Check for embedding_new (would indicate migration failed midway)
    const hasEmbeddingNew = allCols.some(c => c.column_name === 'embedding_new');
    if (hasEmbeddingNew) {
      console.log('');
      console.log('   ⚠️  WARNING: embedding_new column exists!');
      console.log('   This means the migration stopped before completing the column rename.');
    }
  }

  // Query 3: Check vector extension
  console.log('\n\nQuery 3: pgvector extension status');
  const { data: exts, error: extError } = await supabase
    .from('pg_extension')
    .select('extname, extversion')
    .eq('extname', 'vector');

  if (extError) {
    console.log(`   ⚠️  Cannot query pg_extension: ${extError.message}`);
  } else if (exts && exts.length > 0) {
    console.log(`   ✅ pgvector extension installed: version ${exts[0].extversion}`);
  } else {
    console.log('   ❌ pgvector extension NOT installed');
  }

  // Query 4: Check indexes
  console.log('\n\nQuery 4: Indexes on knowledge_base_chunks');
  const { data: indexes, error: idxError } = await supabase
    .from('pg_indexes')
    .select('indexname, indexdef')
    .eq('tablename', 'knowledge_base_chunks');

  if (idxError) {
    console.log(`   ⚠️  Error: ${idxError.message}`);
  } else if (indexes && indexes.length > 0) {
    indexes.forEach(idx => {
      const isVectorIdx = idx.indexdef.includes('ivfflat') || idx.indexdef.includes('hnsw');
      const marker = isVectorIdx ? ' [VECTOR INDEX]' : '';
      console.log(`   - ${idx.indexname}${marker}`);
    });
  } else {
    console.log('   No indexes found');
  }

  console.log('\n\n═══════════════════════════════════════════════════════════════\n');
}

checkActualSchema();
