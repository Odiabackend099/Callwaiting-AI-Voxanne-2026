/**
 * Vapi RAG Integration
 * Intercepts Vapi messages and injects RAG context before AI response
 * This is the critical missing piece that makes the AI use the Knowledge Base
 */

import { Router, Request, Response } from 'express';
import { getRagContext, injectRagContextIntoPrompt } from '../services/rag-context-provider';
import { log } from '../services/logger';

const vapiRagRouter = Router();

/**
 * POST /api/vapi/message
 * Intercepts Vapi message requests and injects RAG context
 * 
 * Flow:
 * 1. User asks a question
 * 2. Vapi sends message to this endpoint
 * 3. We retrieve relevant KB chunks via RAG
 * 4. We inject chunks into the system prompt
 * 5. Vapi generates response with KB context
 */
vapiRagRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, orgId, assistantId, conversationHistory } = req.body;

    if (!message || !orgId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    log.info('Vapi-RAG', 'Processing message with RAG', { 
      orgId,
      messageLength: message.length 
    });

    // Get RAG context for this message
    const { context, chunkCount, hasContext } = await getRagContext(message, orgId);

    log.info('Vapi-RAG', 'RAG context retrieved', { 
      orgId,
      chunkCount,
      hasContext,
      contextLength: context.length 
    });

    // Return context to be injected into Vapi prompt
    return res.json({
      success: true,
      message,
      ragContext: context,
      hasRagContext: hasContext,
      chunkCount,
      assistantId
    });
  } catch (error: any) {
    log.error('Vapi-RAG', 'Message processing failed', { error: error?.message });
    
    // Don't fail the request - proceed without RAG context
    return res.json({
      success: true,
      message: req.body.message,
      ragContext: '',
      hasRagContext: false,
      chunkCount: 0,
      error: error?.message
    });
  }
});

/**
 * POST /api/vapi/inject-context
 * Takes a base system prompt and injects RAG context
 * Used by Vapi to enhance the assistant's knowledge
 */
vapiRagRouter.post('/inject-context', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, userQuery, orgId } = req.body;

    if (!systemPrompt || !userQuery || !orgId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get RAG context
    const { context } = await getRagContext(userQuery, orgId);

    // Inject into prompt
    const enhancedPrompt = injectRagContextIntoPrompt(systemPrompt, context);

    return res.json({
      success: true,
      originalPromptLength: systemPrompt.length,
      enhancedPromptLength: enhancedPrompt.length,
      contextInjected: context.length > 0,
      enhancedPrompt
    });
  } catch (error: any) {
    log.error('Vapi-RAG', 'Context injection failed', { error: error?.message });
    
    // Return original prompt if injection fails
    return res.json({
      success: true,
      enhancedPrompt: req.body.systemPrompt,
      contextInjected: false,
      error: error?.message
    });
  }
});

export { vapiRagRouter };
