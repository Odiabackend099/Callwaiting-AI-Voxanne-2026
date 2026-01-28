#!/usr/bin/env tsx
/**
 * Check actual similarity scores between query and knowledge base chunks
 */

import { config } from '../config';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/embeddings';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

async function checkSimilarityScores() {
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  console.log('\n📊 Checking Actual Similarity Scores\n');

  const testQueries = [
    'How much do your services cost?',
    'Who are the doctors on your team?',
    'How do I book an appointment?'
  ];

  for (const query of testQueries) {
    console.log(`Query: "${query}"`);

    const embedding = await generateEmbedding(query);

    // Call RPC with NO threshold to see ALL scores
    const { data } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_threshold: 0.0,  // NO threshold
      match_count: 10,
      p_org_id: orgId
    });

    if (data && data.length > 0) {
      console.log(`  Top ${data.length} matches:`);
      data.forEach((chunk: any, idx: number) => {
        const content = chunk.content.substring(0, 60);
        console.log(`    ${idx + 1}. Similarity: ${chunk.similarity.toFixed(4)} - ${content}...`);
      });

      const avgSimilarity = data.reduce((sum: number, c: any) => sum + c.similarity, 0) / data.length;
      const maxSimilarity = Math.max(...data.map((c: any) => c.similarity));

      console.log(`  Average similarity: ${avgSimilarity.toFixed(4)}`);
      console.log(`  Max similarity: ${maxSimilarity.toFixed(4)}`);

      if (maxSimilarity < 0.6) {
        console.log(`  ⚠️  Highest score (${maxSimilarity.toFixed(4)}) is below threshold (0.6)`);
        console.log(`  Recommendation: Lower threshold to ${(maxSimilarity * 0.9).toFixed(2)} or regenerate embeddings`);
      } else {
        console.log(`  ✅ Scores are above threshold (0.6)`);
      }
    } else {
      console.log(`  ❌ No matches found`);
    }

    console.log();
  }
}

checkSimilarityScores().catch(console.error);
