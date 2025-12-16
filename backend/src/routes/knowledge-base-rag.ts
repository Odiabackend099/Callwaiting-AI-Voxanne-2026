/**
 * Knowledge Base RAG Routes
 * Handles document chunking, embedding, and vector search
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { chunkDocumentWithMetadata } from '../services/document-chunker';
import { generateEmbeddings, findSimilarChunks, generateEmbedding } from '../services/embeddings';
import { log } from '../services/logger';

const ragRouter = Router();

ragRouter.use(requireAuthOrDev);

/**
 * POST /api/knowledge-base/chunk
 * Chunk a document and generate embeddings
 */
ragRouter.post('/chunk', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      knowledgeBaseId: z.string().uuid(),
      content: z.string().min(1),
      chunkSize: z.number().optional().default(1000),
      chunkOverlap: z.number().optional().default(200)
    });

    const parsed = schema.parse(req.body);

    // Verify document exists and belongs to org
    const { data: doc, error: docError } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('id', parsed.knowledgeBaseId)
      .eq('org_id', orgId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Chunk the document
    const chunks = chunkDocumentWithMetadata(parsed.content, {
      chunkSize: parsed.chunkSize,
      chunkOverlap: parsed.chunkOverlap
    });

    if (chunks.length === 0) {
      return res.status(400).json({ error: 'Document produced no chunks' });
    }

    // Generate embeddings for all chunks
    log.info('RAG', 'Generating embeddings', { orgId, chunkCount: chunks.length });
    const embeddings = await generateEmbeddings(chunks.map((c: any) => c.content));

    // Insert chunks with embeddings
    const chunkRecords = chunks.map((chunk: any, idx: number) => ({
      knowledge_base_id: parsed.knowledgeBaseId,
      org_id: orgId,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: embeddings[idx],
      token_count: chunk.tokenCount
    }));

    const { error: insertError } = await supabase
      .from('knowledge_base_chunks')
      .insert(chunkRecords);

    if (insertError) {
      log.error('RAG', 'Failed to insert chunks', { orgId, error: insertError.message });
      return res.status(500).json({ error: 'Failed to store chunks' });
    }

    // Update knowledge_base table
    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update({
        is_chunked: true,
        chunk_count: chunks.length,
        embedding_status: 'completed'
      })
      .eq('id', parsed.knowledgeBaseId)
      .eq('org_id', orgId);

    if (updateError) {
      log.error('RAG', 'Failed to update document', { orgId, error: updateError.message });
    }

    log.info('RAG', 'Chunking completed', { orgId, chunkCount: chunks.length });
    return res.json({
      success: true,
      chunkCount: chunks.length,
      totalTokens: chunks.reduce((sum: number, c: any) => sum + c.tokenCount, 0)
    });
  } catch (e: any) {
    log.error('RAG', 'POST /chunk - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to chunk document' });
  }
});

/**
 * POST /api/knowledge-base/search
 * Search for relevant chunks using vector similarity
 */
ragRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      query: z.string().min(1),
      limit: z.number().optional().default(5),
      threshold: z.number().optional().default(0.2)  // Lowered for better recall
    });

    const parsed = schema.parse(req.body);

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(parsed.query);

    // Find similar chunks
    const similarChunks = await findSimilarChunks(
      supabase,
      queryEmbedding,
      orgId,
      parsed.limit,
      parsed.threshold
    );

    log.info('RAG', 'Search completed', { orgId, resultCount: similarChunks?.length || 0 });
    return res.json({
      query: parsed.query,
      results: similarChunks || [],
      count: similarChunks?.length || 0
    });
  } catch (e: any) {
    log.error('RAG', 'POST /search - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Search failed' });
  }
});

/**
 * GET /api/knowledge-base/:id/chunks
 * Get chunks for a document
 */
ragRouter.get('/:id/chunks', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const { data: chunks, error } = await supabase
      .from('knowledge_base_chunks')
      .select('*')
      .eq('knowledge_base_id', id)
      .eq('org_id', orgId)
      .order('chunk_index', { ascending: true });

    if (error) {
      log.error('RAG', 'Failed to fetch chunks', { orgId, docId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    return res.json({ chunks: chunks || [] });
  } catch (e: any) {
    log.error('RAG', 'GET /:id/chunks - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch chunks' });
  }
});

export { ragRouter };
