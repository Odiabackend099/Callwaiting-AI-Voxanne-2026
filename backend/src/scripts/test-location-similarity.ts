#!/usr/bin/env tsx
/**
 * Test Location Similarity - Check why location query fails despite content existing
 */

import { config } from '../config';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../services/embeddings';

const supabase = createClient(
  config.SUPABASE_URL || '',
  config.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testLocationSimilarity() {
  console.log('\n🔍 TESTING LOCATION QUERY SIMILARITY\n');

  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
  const locationChunkId = '544c8d98-780f-4a70-8424-4d654453acdc';

  // Test queries
  const queries = [
    'Where are you located?',
    'What is your address?',
    'Where is your office?',
    'What is your location?',
    'How can I find you?',
    'Where are your headquarters?'
  ];

  for (const query of queries) {
    console.log(`\n📝 Query: "${query}"\n`);

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Test with match_knowledge_chunks RPC
    const { data: rpcResults, error: rpcError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 5,
      p_org_id: orgId
    });

    if (rpcError) {
      console.log(`   ❌ RPC Error: ${rpcError.message}`);
      continue;
    }

    console.log(`   📊 RPC Results: ${rpcResults?.length || 0} chunks returned`);

    if (rpcResults && rpcResults.length > 0) {
      // Find the location chunk
      const locationChunk = rpcResults.find((r: any) => r.id === locationChunkId);

      if (locationChunk) {
        console.log(`   ✅ Location chunk FOUND in results!`);
        console.log(`      Similarity score: ${locationChunk.similarity.toFixed(4)}`);
      } else {
        console.log(`   ❌ Location chunk NOT in top ${rpcResults.length} results`);
        console.log(`   📊 Top result similarities:`);
        for (let i = 0; i < Math.min(3, rpcResults.length); i++) {
          console.log(`      ${i + 1}. Score: ${rpcResults[i].similarity.toFixed(4)} - ${rpcResults[i].content.substring(0, 60)}...`);
        }
      }
    } else {
      console.log(`   ❌ No chunks returned (all below threshold 0.3)`);
    }

    // Also check the EXACT similarity score for the location chunk
    const { data: directCheck } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.0,  // No threshold
      match_count: 100,
      p_org_id: orgId
    });

    const exactMatch = directCheck?.find((r: any) => r.id === locationChunkId);
    if (exactMatch) {
      console.log(`   🎯 Location chunk exact similarity: ${exactMatch.similarity.toFixed(4)}`);
      if (exactMatch.similarity < 0.3) {
        console.log(`      ⚠️  Below threshold (0.3) - This is why it's not retrieved!`);
      }
    }
  }

  console.log('\n\n📊 ANALYSIS:\n');
  console.log('If similarity scores are consistently below 0.3 for location queries,');
  console.log('the issue is that the embedding model doesn\'t consider these queries');
  console.log('semantically similar to "Contact Knowledge Base, Headquarters, Address".\n');
  console.log('Solutions:');
  console.log('1. Lower threshold further (e.g., 0.2)');
  console.log('2. Add more location-related keywords to the chunk');
  console.log('3. Rephrase the knowledge base to include "location", "where we are", etc.\n');
}

testLocationSimilarity().catch(console.error);
