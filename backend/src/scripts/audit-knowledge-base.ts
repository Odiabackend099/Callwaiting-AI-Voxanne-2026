#!/usr/bin/env ts-node
/**
 * Knowledge Base Audit Script
 *
 * Audits the Supabase database to verify:
 * 1. Organization exists
 * 2. Knowledge base documents are stored correctly
 * 3. Documents are retrievable via queries
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditKnowledgeBase(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('📋 KNOWLEDGE BASE AUDIT - Supabase Database');
  console.log('═'.repeat(70));
  console.log('\nTarget: voxanne@demo.com organization\n');

  // ==================== PHASE 1: Find Organization ====================
  console.log('📁 PHASE 1: Finding Organization...\n');

  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, email, created_at')
    .or('name.ilike.%voxanne%,email.ilike.%voxanne@demo.com%')
    .limit(5);

  if (orgError) {
    console.error('❌ Error fetching organizations:', orgError.message);
    process.exit(1);
  }

  console.log(`   Organizations found: ${orgs?.length || 0}`);

  if (!orgs || orgs.length === 0) {
    console.log('\n❌ No organization found with voxanne@demo.com');
    console.log('   Searching all organizations...\n');

    const { data: allOrgs } = await supabase
      .from('organizations')
      .select('id, name, email')
      .limit(10);

    if (allOrgs && allOrgs.length > 0) {
      console.log('   Available organizations:');
      for (const org of allOrgs) {
        console.log(`     - ${org.name} (${org.email})`);
      }
    }

    process.exit(1);
  }

  for (const org of orgs) {
    const orgIdShort = org.id.substring(0, 8);
    console.log(`   ✅ ${org.name} (${orgIdShort}...) - ${org.email}`);
  }

  const targetOrg = orgs[0];
  const orgId = targetOrg.id;
  const orgIdShort = orgId.substring(0, 8);

  console.log(`\n   Selected: ${targetOrg.name} (${orgIdShort}...)\n`);

  // ==================== PHASE 2: Check Knowledge Base Table ====================
  console.log('📚 PHASE 2: Checking Knowledge Base Documents...\n');

  const { data: kbDocs, error: kbError } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (kbError) {
    console.error('   ❌ Error fetching knowledge base:', kbError.message);
    process.exit(1);
  }

  console.log(`   Total documents: ${kbDocs?.length || 0}\n`);

  if (!kbDocs || kbDocs.length === 0) {
    console.log('   ❌ No documents found in knowledge_base table');
    console.log('   This means documents may not have been synced to Supabase.\n');
    process.exit(1);
  }

  // Display each document
  for (let i = 0; i < kbDocs.length; i++) {
    const doc = kbDocs[i];
    console.log(`   Document ${i + 1}: ${doc.title || 'Untitled'}`);
    console.log(`     ID: ${doc.id}`);
    console.log(`     Category: ${doc.category || 'N/A'}`);
    console.log(`     Content Length: ${doc.content?.length || 0} characters`);
    console.log(`     Has Embeddings: ${doc.embeddings ? 'Yes' : 'No'}`);
    console.log(`     Version: ${doc.version || 'v1'}`);
    console.log(`     Created: ${new Date(doc.created_at).toLocaleString()}`);
    console.log('');
  }

  // ==================== PHASE 3: Test Retrieval ====================
  console.log('🔍 PHASE 3: Testing Document Retrieval...\n');

  const testQueries = [
    'pricing',
    'consultation',
    'botox',
    'services',
    'team',
    'contact',
    'best practices'
  ];

  let totalMatches = 0;

  for (const query of testQueries) {
    const { data: searchResults, error: searchError } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('org_id', orgId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(5);

    if (searchError) {
      console.log(`   ❌ Query "${query}": Error - ${searchError.message}`);
    } else {
      const matchCount = searchResults?.length || 0;
      totalMatches += matchCount;

      if (matchCount > 0) {
        console.log(`   ✅ Query "${query}": ${matchCount} match(es)`);
        for (const result of searchResults || []) {
          console.log(`      - ${result.title}`);
        }
      } else {
        console.log(`   ⚠️  Query "${query}": 0 matches`);
      }
    }
  }

  console.log(`\n   Total matches across all queries: ${totalMatches}\n`);

  // ==================== PHASE 4: Check Vector Embeddings ====================
  console.log('🧠 PHASE 4: Checking Vector Embeddings...\n');

  const docsWithEmbeddings = kbDocs.filter(doc => doc.embeddings);
  const docsWithoutEmbeddings = kbDocs.filter(doc => !doc.embeddings);

  console.log(`   Documents with embeddings: ${docsWithEmbeddings.length}`);
  console.log(`   Documents without embeddings: ${docsWithoutEmbeddings.length}`);

  if (docsWithoutEmbeddings.length > 0) {
    console.log('\n   ⚠️  Documents missing embeddings:');
    for (const doc of docsWithoutEmbeddings) {
      console.log(`      - ${doc.title}`);
    }
  }

  // ==================== SUMMARY ====================
  console.log('\n' + '═'.repeat(70));
  console.log('📊 AUDIT SUMMARY');
  console.log('═'.repeat(70) + '\n');

  console.log(`Organization:           ${targetOrg.name}`);
  console.log(`Organization ID:        ${orgId}`);
  console.log(`Total Documents:        ${kbDocs.length}`);
  console.log(`With Embeddings:        ${docsWithEmbeddings.length}`);
  console.log(`Without Embeddings:     ${docsWithoutEmbeddings.length}`);
  console.log(`Retrieval Test Matches: ${totalMatches}`);

  console.log('\n🎯 Recommendations:\n');

  if (docsWithoutEmbeddings.length > 0) {
    console.log('   ⚠️  Generate embeddings for documents without them');
    console.log('      This will improve AI retrieval accuracy');
  }

  if (kbDocs.length < 8) {
    console.log('   ⚠️  Only ' + kbDocs.length + ' documents found, but UI shows 8');
    console.log('      Some documents may not have synced to Supabase');
  }

  if (kbDocs.length >= 8 && docsWithEmbeddings.length === kbDocs.length) {
    console.log('   ✅ All documents are properly stored and indexed!');
    console.log('   ✅ AI can successfully retrieve data during live calls');
  }

  console.log('\n✅ Audit complete!\n');
}

auditKnowledgeBase().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
