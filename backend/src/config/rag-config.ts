/**
 * RAG (Retrieval Augmented Generation) Configuration
 *
 * Centralized configuration for all RAG-related settings.
 * This ensures consistency across:
 * - rag-context-provider.ts
 * - vapi-webhook.ts
 * - knowledge-base routes
 *
 * IMPORTANT: Do not hardcode these values elsewhere.
 * Always import from this config file.
 */

export const RAG_CONFIG = {
  /**
   * Minimum cosine similarity score for a chunk to be considered relevant.
   * Range: 0.0 to 1.0
   *
   * Lower = more results but potentially less relevant
   * Higher = fewer results but more relevant
   *
   * Recommendation:
   * - 0.25: Captures edge cases like location queries (sim ~0.27)
   * - 0.3: Good for general queries
   * - 0.5: Balanced for most use cases
   * - 0.65+: High precision, may miss relevant results
   *
   * Note: Lowered from 0.3 to 0.25 to capture "Where are you located?" → Contact KB (sim=0.2722)
   */
  SIMILARITY_THRESHOLD: 0.25,

  /**
   * Maximum number of chunks to retrieve per query.
   * More chunks = more context but higher latency and token cost.
   */
  MAX_CHUNKS: 5,

  /**
   * Maximum character length for the combined context string.
   * Prevents context from being too large for the model.
   */
  MAX_CONTEXT_LENGTH: 2000,

  /**
   * OpenAI embedding model to use.
   * text-embedding-3-small: 1536 dimensions, good balance of cost/quality
   * text-embedding-3-large: 3072 dimensions, higher quality but more expensive
   */
  EMBEDDING_MODEL: 'text-embedding-3-small',

  /**
   * Number of dimensions in the embedding vectors.
   * Must match the model's output dimensions.
   */
  EMBEDDING_DIMENSIONS: 1536,

  /**
   * Fallback similarity score when vector search fails and we use text search.
   * This is a placeholder value indicating fallback was used.
   */
  FALLBACK_SIMILARITY_SCORE: 0.5,

  /**
   * Enable debug logging for RAG operations.
   * Set to true during development/debugging.
   */
  DEBUG_LOGGING: process.env.NODE_ENV !== 'production',
};

/**
 * Type-safe helper to get threshold
 */
export function getSimilarityThreshold(): number {
  return RAG_CONFIG.SIMILARITY_THRESHOLD;
}

/**
 * Type-safe helper to get max chunks
 */
export function getMaxChunks(): number {
  return RAG_CONFIG.MAX_CHUNKS;
}

/**
 * Type-safe helper to get max context length
 */
export function getMaxContextLength(): number {
  return RAG_CONFIG.MAX_CONTEXT_LENGTH;
}

export default RAG_CONFIG;
