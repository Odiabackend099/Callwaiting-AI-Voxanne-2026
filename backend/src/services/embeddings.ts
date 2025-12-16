/**
 * Embeddings Service
 * Generates and manages vector embeddings for document chunks
 */

import { OpenAI } from 'openai';
import { log } from './logger';

let openai: OpenAI | null = null;

try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-proj-placeholder'
  });
} catch (error: any) {
  log.warn('Embeddings', 'OpenAI client initialization failed', { 
    error: error?.message 
  });
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;
const BATCH_SIZE = 20; // OpenAI batch limit
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Generate embedding for a single text with retry logic
 */
export async function generateEmbedding(text: string, retries = 0): Promise<number[]> {
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY environment variable.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    const response = await openai!.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Limit to 8000 chars (OpenAI limit)
      encoding_format: 'float'
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding returned from OpenAI');
    }

    const embedding = response.data[0].embedding;

    // Validate embedding dimensions
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Invalid embedding dimension: ${embedding?.length} (expected ${EMBEDDING_DIMENSION})`);
    }

    return embedding;
  } catch (error: any) {
    if (retries < MAX_RETRIES && error?.status === 429) {
      // Rate limited - retry with exponential backoff
      const delay = RETRY_DELAY_MS * Math.pow(2, retries);
      log.warn('Embeddings', 'Rate limited, retrying', { retries, delay });
      await new Promise(r => setTimeout(r, delay));
      return generateEmbedding(text, retries + 1);
    }

    log.error('Embeddings', 'Failed to generate embedding', { 
      error: error?.message,
      retries 
    });
    throw new Error(`Failed to generate embedding: ${error?.message}`);
  }
}

/**
 * Generate embeddings for multiple texts (batched with error handling)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    throw new Error('No texts provided for embedding');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY environment variable.');
  }

  const embeddings: number[][] = new Array(texts.length);
  const failedIndices: number[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchStartIndex = i;

    try {
      // Validate batch texts
      const validBatch = batch.map(t => {
        if (!t || typeof t !== 'string') {
          throw new Error('Invalid text in batch');
        }
        return t.substring(0, 8000); // Limit each text
      });

      const response = await openai!.embeddings.create({
        model: EMBEDDING_MODEL,
        input: validBatch,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embeddings returned from OpenAI');
      }

      // Map embeddings back to original indices
      for (const item of response.data) {
        const originalIndex = batchStartIndex + item.index;
        const embedding = item.embedding;

        // Validate embedding
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
          log.warn('Embeddings', 'Invalid embedding dimension', { 
            index: originalIndex,
            dimension: embedding?.length 
          });
          failedIndices.push(originalIndex);
          continue;
        }

        embeddings[originalIndex] = embedding;
      }
    } catch (error: any) {
      log.error('Embeddings', 'Batch embedding failed', { 
        batchStart: batchStartIndex,
        batchSize: batch.length,
        error: error?.message 
      });
      
      // Mark all items in batch as failed
      for (let j = batchStartIndex; j < Math.min(batchStartIndex + BATCH_SIZE, texts.length); j++) {
        failedIndices.push(j);
      }
    }
  }

  // Check if all embeddings failed
  if (failedIndices.length === texts.length) {
    throw new Error('Failed to generate embeddings for all texts');
  }

  if (failedIndices.length > 0) {
    log.warn('Embeddings', 'Partial batch failure', { 
      total: texts.length,
      failed: failedIndices.length 
    });
  }

  return embeddings;
}

/**
 * Find similar chunks using vector similarity
 */
export async function findSimilarChunks(
  supabase: any,
  queryEmbedding: number[],
  orgId: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<Array<{ id: string; content: string; similarity: number }>> {
  try {
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_org_id: orgId
    });

    if (error) throw error;

    return data || [];
  } catch (error: any) {
    throw new Error(`Failed to find similar chunks: ${error?.message}`);
  }
}

/**
 * Create a Postgres function for vector similarity search
 * This should be run once during migration
 */
export const vectorSearchFunction = `
create or replace function match_knowledge_chunks (
  query_embedding vector,
  match_threshold float,
  match_count int,
  p_org_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql
as $$
  select
    knowledge_base_chunks.id,
    knowledge_base_chunks.content,
    (1 - (knowledge_base_chunks.embedding <=> query_embedding)) as similarity
  from knowledge_base_chunks
  where knowledge_base_chunks.org_id = p_org_id
    and knowledge_base_chunks.embedding is not null
    and (1 - (knowledge_base_chunks.embedding <=> query_embedding)) > match_threshold
  order by knowledge_base_chunks.embedding <=> query_embedding
  limit match_count;
$$;
`;
