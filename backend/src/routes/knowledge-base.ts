import express, { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { validateKnowledgeBaseInput } from '../middleware/input-validation'; 
import VapiClient from '../services/vapi-client';
import { log } from '../services/logger';
import { chunkDocumentWithMetadata } from '../services/document-chunker';
import { generateEmbeddings } from '../services/embeddings';
import { getCached, setCached } from '../services/cache'; // <--- Changed cache service import

const knowledgeBaseRouter = express.Router();
const KB_MAX_BYTES = 300_000;
const KB_FILENAME_MAX = 255;
const KB_CATEGORIES = ['products_services', 'operations', 'ai_guidelines', 'general'] as const;
const SYNC_RATE_LIMIT_MS = 5 * 60 * 1000;

function getOrgId(req: Request): string | null {
  return req.user?.orgId || null;
}

async function getVapiApiKeyForOrg(orgId: string): Promise<string | null> {
  const cachedApiKey = getCached<string>(`vapi-api-key-${orgId}`);
  if (cachedApiKey) return cachedApiKey;

  const { data: vapiIntegration } = await supabase
    .from('integrations')
    .select('config')
    .eq('org_id', orgId)
    .eq('provider', 'vapi')
    .limit(1)
    .single();

  const key = (vapiIntegration as any)?.config?.vapi_api_key || process.env.VAPI_API_KEY;
  return key || null;
}

async function retryVapiCall<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Retry exhausted');
}

const VapiFileUploadResponseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  size: z.number().optional()
});

const VapiToolResponseSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  function: z.object({ name: z.string() }).optional()
});

async function vapiUploadTextFile(params: { apiKey: string; filename: string; content: string }): Promise<string> {
  return retryVapiCall(async () => {
    const FormDataCtor: any = (globalThis as any).FormData;
    const BlobCtor: any = (globalThis as any).Blob;

    if (!FormDataCtor || !BlobCtor) {
      throw new Error('Runtime does not support FormData/Blob. Please use Node 18+ or enable undici fetch globals.');
    }

    const form: any = new FormDataCtor();
    form.append('file', new BlobCtor([params.content], { type: 'text/plain' }), params.filename);

    const res = await fetch('https://api.vapi.ai/file', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${params.apiKey}`,
        'X-Idempotency-Key': `${params.filename}-${Buffer.byteLength(params.content, 'utf8')}`
      },
      body: form
    });

    if (!res.ok) {
      let msg = `Vapi file upload failed (HTTP ${res.status})`;
      try {
        const data: any = await res.json();
        msg = data?.message || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const validated = VapiFileUploadResponseSchema.parse(data);
    return validated.id;
  });
}

async function vapiCreateOrUpdateQueryTool(params: {
  apiKey: string;
  toolId?: string;
  toolName: string;
  knowledgeBases: Array<{ provider: 'google'; name: string; description: string; fileIds: string[] }>;
}): Promise<string> {
  return retryVapiCall(async () => {
    const url = params.toolId ? `https://api.vapi.ai/tool/${params.toolId}` : 'https://api.vapi.ai/tool';
    const res = await fetch(url, {
      method: params.toolId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'query',
        function: { name: params.toolName },
        knowledgeBases: params.knowledgeBases
      })
    });

    if (!res.ok) {
      let msg = `Vapi tool create/update failed (HTTP ${res.status})`;
      try {
        const data: any = await res.json();
        msg = data?.message || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const validated = VapiToolResponseSchema.parse(data);
    return validated.id;
  });
}

async function attachToolToAssistant(params: { vapi: VapiClient; assistantId: string; toolId: string }): Promise<void> {
  const assistant = await params.vapi.getAssistant(params.assistantId);
  const model = assistant?.model;
  if (!model) throw new Error('Vapi assistant missing model configuration');

  const toolIds: string[] = Array.isArray(model.toolIds) ? model.toolIds : [];
  const nextToolIds = Array.from(new Set([...toolIds, params.toolId]));

  await params.vapi.updateAssistant(params.assistantId, { model: { ...model, toolIds: nextToolIds } });
}

/**
 * Auto-chunk and embed a KB document
 * Called automatically after document is saved
 */
async function autoChunkDocument(params: { orgId: string; docId: string; content: string }): Promise<void> {
  try {
    log.info('KnowledgeBase', 'Auto-chunking document', { orgId: params.orgId, docId: params.docId });
    
    // Chunk the document
    const chunks = chunkDocumentWithMetadata(params.content, {
      chunkSize: 1000,
      chunkOverlap: 200
    });

    if (chunks.length === 0) {
      log.warn('KnowledgeBase', 'Document produced no chunks', { orgId: params.orgId, docId: params.docId });
      return;
    }

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks.map(c => c.content));

    // Insert chunks with embeddings
    const chunkRecords = chunks.map((chunk, idx) => ({
      knowledge_base_id: params.docId,
      org_id: params.orgId,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: embeddings[idx],
      token_count: chunk.tokenCount
    }));

    const { error: insertError } = await supabase
      .from('knowledge_base_chunks')
      .insert(chunkRecords);

    if (insertError) {
      log.error('KnowledgeBase', 'Failed to insert chunks', { orgId: params.orgId, docId: params.docId, error: insertError.message });
      return;
    }

    // Update knowledge_base table with chunk status
    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update({
        is_chunked: true,
        chunk_count: chunks.length,
        embedding_status: 'completed'
      })
      .eq('id', params.docId)
      .eq('org_id', params.orgId);

    if (updateError) {
      log.error('KnowledgeBase', 'Failed to update document chunk status', { orgId: params.orgId, docId: params.docId, error: updateError.message });
      return;
    }

    log.info('KnowledgeBase', 'Auto-chunking completed', { orgId: params.orgId, docId: params.docId, chunkCount: chunks.length });
  } catch (error: any) {
    log.error('KnowledgeBase', 'Auto-chunking failed', { orgId: params.orgId, docId: params.docId, error: error?.message });
    // Don't throw - chunking failure shouldn't block document save
  }
}

async function vapiDeleteFile(params: { apiKey: string; fileId: string }): Promise<void> {
  return retryVapiCall(async () => {
    const res = await fetch(`https://api.vapi.ai/file/${params.fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${params.apiKey}` }
    });

    if (!res.ok && res.status !== 404) {
      let msg = `Vapi file delete failed (HTTP ${res.status})`;
      try {
        const data: any = await res.json();
        msg = data?.message || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
  });
}

knowledgeBaseRouter.use(requireAuthOrDev);

knowledgeBaseRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      log.error('KnowledgeBase', 'GET / - Missing orgId', { user: req.user });
      return res.status(401).json({ error: 'Unauthorized - missing organization' });
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('KnowledgeBase', 'GET / - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }
    return res.json({ items: data || [] });
  } catch (err: any) {
    log.error('KnowledgeBase', 'GET / - Unexpected error', { error: err?.message });
    return res.status(500).json({ error: err?.message || 'Failed to fetch documents' });
  }
});

knowledgeBaseRouter.post('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

  const schema = z.object({
    filename: z.string()
      .min(1)
      .max(KB_FILENAME_MAX)
      .transform(s => s.trim())
      .refine(s => !s.includes('..') && !s.includes('/') && !s.includes('\\'), {
        message: 'Filename cannot contain path separators or traversal sequences'
      }),
    content: z.string().min(1).transform(s => s.trim()).refine(s => s.length > 0, {
      message: 'Content cannot be empty or whitespace-only'
    }),
    category: z.enum(KB_CATEGORIES).default('general'),
    active: z.boolean().optional().default(true)
  });

  try {
    const parsed = schema.parse(req.body);
    const bytes = Buffer.byteLength(parsed.content, 'utf8');
    if (bytes > KB_MAX_BYTES) return res.status(400).json({ error: `File too large. Max ${KB_MAX_BYTES} bytes.` });

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({
        org_id: orgId,
        filename: parsed.filename,
        content: parsed.content,
        category: parsed.category,
        active: parsed.active,
        version: 1,
        metadata: { source: 'dashboard', bytes }
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const { error: changelogError } = await supabase.from('knowledge_base_changelog').insert({
      knowledge_base_id: data.id,
      org_id: orgId,
      version_from: null,
      version_to: 1,
      change_type: 'created',
      changed_by: req.user?.id || 'system',
      change_summary: `Created: ${parsed.filename}`,
      previous_content: null,
      new_content: parsed.content
    });

    if (changelogError) {
      log.error('KnowledgeBase', 'Changelog insert failed', { orgId, docId: data.id, error: changelogError });
      return res.status(500).json({ error: 'Failed to record change history' });
    }

    // Auto-chunk document SYNCHRONOUSLY (block until chunks are created)
    try {
      await autoChunkDocument({ orgId, docId: data.id, content: parsed.content });
      log.info('KnowledgeBase', 'Document chunked and embedded successfully', { orgId, docId: data.id });
    } catch (chunkErr: any) {
      log.error('KnowledgeBase', 'Auto-chunking failed', { orgId, docId: data.id, error: chunkErr?.message });
      // Don't fail the entire save if chunking fails - document is still created
      // But log it so user knows chunking didn't work
    }

    // Auto-sync KB to both agents after save
    try {
      const vapiKey = await getVapiApiKeyForOrg(orgId);
      if (vapiKey) {
        // Trigger sync to both agents asynchronously (don't block response)
        // Use setTimeout with longer delay to ensure request processing
        setTimeout(async () => {
          try {
            log.info('KnowledgeBase', 'Auto-syncing KB to agents after save', { orgId, docId: data.id });
            // Sync endpoint will handle attaching KB to both inbound and outbound agents
            const authHeader = req.headers.authorization || `Bearer ${process.env.INTERNAL_API_KEY}`;
            const response = await fetch(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/api/knowledge-base/sync`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({ orgId })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              log.error('KnowledgeBase', 'Auto-sync returned error', { orgId, docId: data.id, status: response.status, error: errorText });
            } else {
              log.info('KnowledgeBase', 'Auto-sync completed successfully', { orgId, docId: data.id });
            }
          } catch (syncErr) {
            log.error('KnowledgeBase', 'Auto-sync failed after save', { orgId, docId: data.id, error: syncErr });
          }
        }, 1000); // 1 second delay to ensure request is processed
      }
    } catch (syncErr) {
      log.warn('KnowledgeBase', 'Could not trigger auto-sync', { orgId, error: syncErr });
    }

    return res.json({ item: data, id: data.id });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    return res.status(500).json({ error: e?.message || 'Failed to create document' });
  }
});

knowledgeBaseRouter.patch('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

  const schema = z.object({
    filename: z.string()
      .min(1)
      .max(KB_FILENAME_MAX)
      .transform(s => s.trim())
      .refine(s => !s.includes('..') && !s.includes('/') && !s.includes('\\'), {
        message: 'Filename cannot contain path separators or traversal sequences'
      })
      .optional(),
    content: z.string().min(1).transform(s => s.trim()).refine(s => s.length > 0, {
      message: 'Content cannot be empty or whitespace-only'
    }).optional(),
    category: z.enum(KB_CATEGORIES).optional(),
    active: z.boolean().optional()
  });

  try {
    const id = req.params.id;
    const parsed = schema.parse(req.body);

    const { data: existing, error: existingError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError || !existing) return res.status(404).json({ error: 'Knowledge base document not found' });

    let bytes: number | null = null;
    if (parsed.content !== undefined) {
      bytes = Buffer.byteLength(parsed.content, 'utf8');
      if (bytes > KB_MAX_BYTES) return res.status(400).json({ error: `File too large. Max ${KB_MAX_BYTES} bytes.` });
    }

    const nextVersion = (existing.version || 1) + (parsed.content !== undefined ? 1 : 0);

    const { data, error } = await supabase
      .from('knowledge_base')
      .update({
        ...(parsed.filename !== undefined ? { filename: parsed.filename } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.active !== undefined ? { active: parsed.active } : {}),
        ...(parsed.content !== undefined ? { content: parsed.content, version: nextVersion } : {}),
        ...(bytes !== null ? { metadata: { ...(existing.metadata || {}), bytes } } : {})
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (parsed.content !== undefined) {
      const { error: changelogError } = await supabase.from('knowledge_base_changelog').insert({
        knowledge_base_id: id,
        org_id: orgId,
        version_from: existing.version || 1,
        version_to: nextVersion,
        change_type: 'updated',
        changed_by: req.user?.id || 'system',
        change_summary: `Updated: ${data.filename}`,
        previous_content: existing.content,
        new_content: parsed.content
      });

      if (changelogError) {
        log.error('KnowledgeBase', 'Changelog insert failed', { orgId, docId: id, error: changelogError });
        return res.status(500).json({ error: 'Failed to record change history' });
      }

      // Auto-chunk updated document SYNCHRONOUSLY (block until chunks are created)
      const newContent = parsed.content;
      if (newContent) {
        try {
          // Delete old chunks
          await supabase
            .from('knowledge_base_chunks')
            .delete()
            .eq('knowledge_base_id', id)
            .eq('org_id', orgId);

          // Re-chunk with new content
          await autoChunkDocument({ orgId, docId: id, content: newContent });
          log.info('KnowledgeBase', 'Document re-chunked and embedded successfully', { orgId, docId: id });
        } catch (chunkErr: any) {
          log.error('KnowledgeBase', 'Auto-chunking failed on update', { orgId, docId: id, error: chunkErr?.message });
          // Don't fail the entire update if chunking fails - document is still updated
        }
      }
    }

    return res.json({ item: data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    return res.status(500).json({ error: e?.message || 'Failed to update document' });
  }
});

knowledgeBaseRouter.delete('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const id = req.params.id;

    const { data: existing, error: existingError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError || !existing) return res.status(404).json({ error: 'Document not found' });

    // Delete from Vapi if file was synced
    const vapiFileId = existing.metadata?.vapi_file_id;
    if (vapiFileId) {
      try {
        const apiKey = await getVapiApiKeyForOrg(orgId);
        if (apiKey) {
          await vapiDeleteFile({ apiKey, fileId: vapiFileId });
          log.info('KnowledgeBase', 'DELETE - Vapi file deleted', { orgId, docId: id, vapiFileId });
        }
      } catch (vapiErr: any) {
        log.warn('KnowledgeBase', 'DELETE - Failed to delete Vapi file (non-blocking)', { 
          orgId, docId: id, vapiFileId, error: vapiErr?.message 
        });
        // Don't fail the entire delete if Vapi cleanup fails
      }
    }

    const { error } = await supabase
      .from('knowledge_base')
      .update({ active: false })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      log.error('KnowledgeBase', 'DELETE - Database update failed', { orgId, docId: id, error: error.message });
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    const { error: changelogError } = await supabase.from('knowledge_base_changelog').insert({
      knowledge_base_id: id,
      org_id: orgId,
      version_from: existing.version || 1,
      version_to: existing.version || 1,
      change_type: 'deleted',
      changed_by: req.user?.id || 'system',
      change_summary: `Deleted: ${existing.filename}`,
      previous_content: existing.content,
      new_content: null
    });

    if (changelogError) {
      log.error('KnowledgeBase', 'DELETE - Changelog insert failed', { orgId, docId: id, error: changelogError });
      return res.status(500).json({ error: 'Failed to record deletion' });
    }

    return res.json({ success: true });
  } catch (e: any) {
    log.error('KnowledgeBase', 'DELETE - Unexpected error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to delete document' });
  }
});

knowledgeBaseRouter.post('/seed/beverly', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const docs: Array<{ filename: string; category: string; content: string }> = [
      {
        filename: 'beverly_product_guide.md',
        category: 'products_services',
        content: `# CALL WAITING AI LTD AI - Product Guide\n\n## What it is\nCALL WAITING AI LTD is an AI receptionist trained for UK/EU medical aesthetics practices. It answers inbound calls 24/7, qualifies leads, and books demos.\n\n## Core promises\n- Answers instantly\n- Captures lead details\n- Books a demo\n- Safe Mode: no medical advice\n\n## Pricing (example)\n- Essentials: £169/mo + setup\n- Growth: £289/mo + setup\n- Premium: £449/mo + setup\n`
      },
      {
        filename: 'beverly_objections.md',
        category: 'operations',
        content: `# CALL WAITING AI LTD Sales - Objection Handling\n\n## Too expensive\nReframe on ROI: one extra high-value consult can cover monthly cost many times over.\n\n## Patients won't like AI\nOffer a live demo line + emphasize instant answers vs voicemail.\n\n## Medical liability\nReinforce Safe Mode: escalate clinical questions to staff.`
      },
      {
        filename: 'beverly_call_script.md',
        category: 'ai_guidelines',
        content: `# CALL WAITING AI LTD Sales - Call Script (Short)\n\n## Opening\nGood afternoon, this is Sarah from CallWaiting AI. Are you the practice owner/manager?\n\n## Discovery\nAsk 11-14 questions (SPIN): call volume, hours, missed calls, after-hours, procedure mix.\n\n## Close\nBook a 15-minute demo. Offer two time slots.`
      }
    ];

    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('org_id', orgId)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({ success: true, seeded: 0, message: 'Knowledge base already has documents. Skipping seed.' });
    }

    const inserted: any[] = [];
    for (const d of docs) {
      const bytes = Buffer.byteLength(d.content, 'utf8');
      if (bytes > KB_MAX_BYTES) {
        return res.status(400).json({ error: `Seed doc too large: ${d.filename}.` });
      }

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          org_id: orgId,
          filename: d.filename,
          content: d.content,
          category: d.category,
          active: true,
          version: 1,
          metadata: { source: 'beverly_seed', bytes }
        })
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      inserted.push(data);

      const { error: changelogError } = await supabase.from('knowledge_base_changelog').insert({
        knowledge_base_id: data.id,
        org_id: orgId,
        version_from: null,
        version_to: 1,
        change_type: 'created',
        changed_by: req.user?.id || 'system',
        change_summary: `Seeded: ${d.filename}`,
        previous_content: null,
        new_content: d.content
      });

      if (changelogError) {
        log.error('KnowledgeBase', 'Changelog insert failed during seed', { orgId, docId: data.id, filename: d.filename, error: changelogError });
        return res.status(500).json({ error: 'Failed to record seeded document' });
      }
    }

    return res.json({ success: true, seeded: inserted.length, items: inserted });
  } catch (err: any) {
    log.error('KnowledgeBase', 'Seed - Unexpected error', { error: err?.message });
    return res.status(500).json({ error: err?.message || 'Failed to seed Beverly knowledge base' });
  }
});

knowledgeBaseRouter.post('/sync', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let syncedToolId: string | null = null;
  let syncedDocsCount = 0;
  let syncedAssistantsCount = 0;

  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Database-based rate limiting: check last sync from kb_sync_log
    const { data: lastSyncRecords, error: lastSyncError } = await supabase
      .from('kb_sync_log')
      .select('created_at')
      .eq('org_id', orgId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1);

    // Handle rate limit check: only rate limit if we have a successful sync record
    if (lastSyncRecords && Array.isArray(lastSyncRecords) && lastSyncRecords.length > 0) {
      const lastSyncRecord = lastSyncRecords[0];
      if (lastSyncRecord?.created_at) {
        const lastSyncTime = new Date(lastSyncRecord.created_at).getTime();
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTime;

        if (timeSinceLastSync < SYNC_RATE_LIMIT_MS) {
          const remainingMs = SYNC_RATE_LIMIT_MS - timeSinceLastSync;
          return res.status(429).json({ error: `Rate limited. Try again in ${Math.ceil(remainingMs / 1000)}s.` });
        }
      }
    } else if (lastSyncError && lastSyncError.code !== 'PGRST116') {
      // PGRST116 = "no rows found" which is expected on first sync
      // Any other error should be logged but not block the sync
      log.warn('KnowledgeBase', 'Rate limit check failed', { orgId, error: lastSyncError });
    }

    const schema = z.object({
      toolName: z.string().min(1).default('knowledge-search'),
      assistantRoles: z.array(z.enum(['inbound', 'outbound'])).min(1).default(['inbound', 'outbound'])
    });

    const parsed = schema.parse(req.body || {});

    const apiKey = await getVapiApiKeyForOrg(orgId);
    if (!apiKey) return res.status(500).json({ error: 'Vapi API Key not configured' });

    // VALIDATE AGENTS EXIST AND HAVE VAPI IDs BEFORE FILE UPLOADS
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, role, vapi_assistant_id')
      .eq('org_id', orgId)
      .in('role', parsed.assistantRoles);

    if (agentsError) return res.status(500).json({ error: agentsError.message });

    if (!agents || agents.length === 0) {
      return res.status(400).json({ 
        error: 'No agents found for this organization. Please create agents in Agent Configuration first, then sync knowledge base.' 
      });
    }

    const validAgents = agents.filter(a => a.vapi_assistant_id);
    if (validAgents.length === 0) {
      return res.status(400).json({ 
        error: 'No agents have been synced to Vapi yet. Please save Agent Configuration first to create Vapi assistants.' 
      });
    }

    const { data: docs, error: docsError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (docsError) return res.status(500).json({ error: docsError.message });
    const items = docs || [];
    if (items.length === 0) return res.status(400).json({ error: 'No active knowledge base documents to sync' });

    for (const d of items) {
      if (!d.content || !d.filename) {
        return res.status(400).json({ error: `Invalid KB document: missing content or filename for ${d.id}` });
      }
      
      // Validate content is valid UTF-8 and has no null bytes
      if (typeof d.content !== 'string') {
        return res.status(400).json({ error: `Invalid KB document: content must be text for ${d.filename}` });
      }
      
      if (d.content.includes('\0')) {
        return res.status(400).json({ error: `Invalid KB document: content contains null bytes for ${d.filename}` });
      }
      
      const bytes = Buffer.byteLength(d.content, 'utf8');
      if (bytes > KB_MAX_BYTES) {
        return res.status(400).json({ error: `KB doc too large: ${d.filename}. Max ${KB_MAX_BYTES} bytes.` });
      }
    }

    const uploadPromises = items.map(async (d) => {
      const fileId = await vapiUploadTextFile({ apiKey, filename: d.filename, content: d.content });
      return { docId: d.id, fileId };
    });

    const uploadResults = await Promise.all(uploadPromises);

    const docMap = new Map(items.map(d => [d.id, d]));
    const metadataUpdatePromises = uploadResults.map(async (result) => {
      const doc = docMap.get(result.docId);
      if (!doc) return { success: true };
      
      // Validate fileId before updating metadata
      if (!result.fileId || typeof result.fileId !== 'string') {
        return { success: false, error: new Error(`Invalid fileId for document ${result.docId}`) };
      }
      
      const { error } = await supabase.from('knowledge_base').update({ metadata: { ...(doc.metadata || {}), vapi_file_id: result.fileId } }).eq('id', result.docId);
      return { success: !error, error };
    });

    const updateResults = await Promise.all(metadataUpdatePromises);
    const failedUpdates = updateResults.filter(r => !r.success);
    if (failedUpdates.length > 0) {
      log.error('KnowledgeBase', 'Metadata updates failed', { orgId, failedUpdatesCount: failedUpdates.length });
      return res.status(500).json({ error: 'Failed to update file metadata' });
    }

    const uploadResultMap = new Map(uploadResults.map(r => [r.docId, r.fileId]));
    const categoryToFilesMap = new Map<string, { files: string[]; description: string }>();
    
    // Group KB files by category for Vapi knowledge bases
    for (const d of items) {
      const fileId = uploadResultMap.get(d.id);
      if (!fileId) continue;
      
      const category = d.category || 'general';
      if (!categoryToFilesMap.has(category)) {
        categoryToFilesMap.set(category, { files: [], description: `Contains ${category} information` });
      }
      categoryToFilesMap.get(category)!.files.push(fileId);
    }

    // Create or update Vapi Query Tool with knowledge bases
    const knowledgeBases = Array.from(categoryToFilesMap.entries()).map(([categoryName, { files, description }]) => ({
      provider: 'google' as const,
      name: categoryName,
      description,
      fileIds: files
    }));

    const toolId = await vapiCreateOrUpdateQueryTool({ apiKey, toolName: parsed.toolName, knowledgeBases });

    const vapi = new VapiClient(apiKey);

    // Log which agents will be updated
    log.info('KnowledgeBase', 'Attaching KB tool to agents', { 
      orgId, 
      agentCount: validAgents.length,
      roles: validAgents.map(a => a.role)
    });

    // Attach tool to all valid agents in parallel
    const attachmentPromises = validAgents.map(a => 
      attachToolToAssistant({ vapi, assistantId: a.vapi_assistant_id, toolId })
        .catch(err => {
          log.error('KnowledgeBase', 'Failed to attach tool to agent', { 
            orgId, 
            agentId: a.id, 
            role: a.role,
            error: err?.message 
          });
          throw err;
        })
    );

    const attachmentResults = await Promise.allSettled(attachmentPromises);
    const successfulAttachments = attachmentResults.filter(r => r.status === 'fulfilled');
    const failedAttachments = attachmentResults.filter(r => r.status === 'rejected');
    const partialSuccess = successfulAttachments.length > 0;
    
    if (failedAttachments.length > 0) {
      log.warn('KnowledgeBase', 'Partial sync failure - some agents failed to attach KB tool', { 
        orgId,
        successCount: successfulAttachments.length,
        failCount: failedAttachments.length,
        totalCount: validAgents.length,
        errors: failedAttachments.map((r: any) => r.reason?.message)
      });
      
      if (!partialSuccess) {
        return res.status(500).json({ 
          error: 'Failed to attach knowledge base to any agents. Please try again.' 
        });
      }
    }

    const updated = validAgents.map(a => ({ 
      role: a.role, 
      assistantId: a.vapi_assistant_id 
    }));

    // Track sync metrics for logging
    syncedToolId = toolId;
    syncedDocsCount = items.length;
    syncedAssistantsCount = updated.length;

    // Log successful sync to kb_sync_log for rate limiting and audit trail
    const duration = Date.now() - startTime;
    const { error: syncLogError } = await supabase.from('kb_sync_log').insert({
      org_id: orgId,
      tool_id: toolId,
      status: 'success',
      duration_ms: duration,
      docs_synced: items.length,
      assistants_updated: updated.length
    });

    if (syncLogError) {
      log.error('KnowledgeBase', 'Failed to log successful sync', { orgId, error: syncLogError });
      return res.status(500).json({ error: 'Failed to record sync to audit log' });
    }

    return res.json({ success: true, toolId, assistantsUpdated: updated });
  } catch (err: any) {
    // Log failed sync attempt
    const orgId = getOrgId(req);
    if (orgId) {
      const duration = Date.now() - startTime;
      try {
        const { error: syncLogError } = await supabase.from('kb_sync_log').insert({
          org_id: orgId,
          tool_id: syncedToolId,
          status: 'failed',
          error_message: err?.message || 'Unknown error',
          duration_ms: duration,
          docs_synced: syncedDocsCount,
          assistants_updated: syncedAssistantsCount
        });

        if (syncLogError) {
          log.error('KnowledgeBase', 'Failed to log sync error', { orgId, error: syncLogError });
        }
      } catch (syncLogInsertErr: any) {
        log.error('KnowledgeBase', 'Failed to log sync error', { orgId, error: syncLogInsertErr });
      }
    }

    return res.status(500).json({ error: err?.message || 'Failed to sync knowledge base' });
  }
});

export default knowledgeBaseRouter;
