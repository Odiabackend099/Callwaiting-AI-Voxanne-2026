-- Phase 3.1: Performance Optimization - Add Strategic Indexes
-- MVP-focused: Only add indexes on frequently queried columns

-- Call logs indexes (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call_id ON call_logs(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);

-- Call tracking indexes (webhook handler queries)
CREATE INDEX IF NOT EXISTS idx_call_tracking_vapi_call_id ON call_tracking(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_org_id ON call_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_status ON call_tracking(status);

-- Knowledge base indexes (KB search and retrieval)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_id ON knowledge_base(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base(active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunks_kb_id ON knowledge_base_chunks(knowledge_base_id);

-- Agents indexes (agent lookup in webhook)
CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id ON agents(vapi_assistant_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active);

-- Leads indexes (lead queries in calls)
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- Integrations indexes (config lookups)
CREATE INDEX IF NOT EXISTS idx_integrations_org_provider ON integrations(org_id, provider);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_call_logs_user_created ON call_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_active ON knowledge_base(org_id, active);
CREATE INDEX IF NOT EXISTS idx_agents_org_active ON agents(org_id, active);

-- Vector search index for knowledge base chunks (if pgvector is enabled)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunks_embedding ON knowledge_base_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
