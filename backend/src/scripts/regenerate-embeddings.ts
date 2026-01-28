#!/usr/bin/env tsx
/**
 * Regenerate Knowledge Base Embeddings
 *
 * Regenerates all embeddings for knowledge base chunks using the current model
 * (text-embedding-3-small) to fix incompatibility with old embeddings.
 */

import { config } from '../config';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/embeddings';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

async function regenerateEmbeddings() {
  console.log('\n' + '═'.repeat(80));
  console.log('🔄 Regenerating Knowledge Base Embeddings');
  console.log('═'.repeat(80));
  console.log('\nModel: text-embedding-3-small (1536 dimensions)\n');

  // Find voxanne@demo.com organization
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, email')
    .or('name.ilike.%voxanne%,email.ilike.%voxanne@demo.com%')
    .limit(1);

  if (orgError || !orgs || orgs.length === 0) {
    console.error('❌ Could not find voxanne@demo.com organization');
    process.exit(1);
  }

  const org = orgs[0];
  const orgId = org.id;

  console.log(`Organization: ${org.name}`);
  console.log(`Email: ${org.email}`);
  console.log(`Org ID: ${orgId.substring(0, 8)}...\n`);

  // Fetch all knowledge base chunks
  const { data: chunks, error: fetchError } = await supabase
    .from('knowledge_base_chunks')
    .select('id, content, chunk_index')
    .eq('org_id', orgId)
    .order('chunk_index');

  if (fetchError || !chunks) {
    console.error('❌ Failed to fetch knowledge base chunks:', fetchError?.message);
    process.exit(1);
  }

  console.log(`Found ${chunks.length} chunks to regenerate\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    console.log(`[${i + 1}/${chunks.length}] Processing chunk ${chunk.chunk_index}...`);
    console.log(`  Content: ${chunk.content.substring(0, 60)}...`);

    try {
      // Generate new embedding with current model
      const embedding = await generateEmbedding(chunk.content);

      console.log(`  Embedding: ${embedding.length} dimensions`);

      // Update in database
      const { error: updateError } = await supabase
        .from('knowledge_base_chunks')
        .update({ embedding })
        .eq('id', chunk.id);

      if (updateError) {
        console.log(`  ❌ Failed to update: ${updateError.message}`);
        failCount++;
      } else {
        console.log(`  ✅ Updated successfully`);
        successCount++;
      }
    } catch (error: any) {
      console.log(`  ❌ Failed to generate embedding: ${error?.message}`);
      failCount++;
    }

    console.log();
  }

  console.log('═'.repeat(80));
  console.log('📊 Summary');
  console.log('═'.repeat(80));
  console.log(`Total chunks: ${chunks.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success rate: ${((successCount / chunks.length) * 100).toFixed(1)}%`);

  if (successCount === chunks.length) {
    console.log('\n✅ All embeddings regenerated successfully!');
    console.log('\nNext step: Run the PhD-level test:');
    console.log('  npx tsx src/scripts/test-live-rag-retrieval.ts');
    console.log('\nExpected result: 8/8 tests PASS (up from 0/8)');
  } else {
    console.log('\n⚠️  Some embeddings failed to regenerate');
    console.log('Please review the errors above and retry');
  }

  console.log();
}

regenerateEmbeddings().catch(console.error);
