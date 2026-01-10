-- Migration: Optimize Indexes for Multi-Tenant Performance
-- Date: 2025-01-10
-- Purpose: Add org_id as first column in composite indexes for optimal multi-tenant query performance
-- Rationale: In multi-tenant queries, filtering by org_id first reduces the search space significantly
-- 
-- Performance Impact:
-- - Before: Query scans ALL orgs, then filters (slow, grows with total data)
-- - After: Query scans ONLY the target org's data (fast, scales with org size)
--
-- Migration Strategy:
-- - Keep existing indexes (for backward compatibility and different query patterns)
-- - Add new optimized composite indexes with org_id first
-- - Existing indexes can be deprecated later if not used

-- ============================================
-- CALL_LOGS TABLE - Optimized Indexes
-- ============================================

-- Dashboard queries: org_id + created_at (most common - recent calls by org)
CREATE INDEX IF NOT EXISTS idx_call_logs_org_created_at_opt 
ON call_logs(org_id, created_at DESC)
WHERE org_id IS NOT NULL;

-- Dashboard queries: org_id + created_at (alternative index for different query patterns)
-- Note: call_logs uses created_at, not started_at (checked schema)

-- Status filtering: org_id + status (completed calls, failed calls, etc.)
CREATE INDEX IF NOT EXISTS idx_call_logs_org_status_opt 
ON call_logs(org_id, status, created_at DESC)
WHERE org_id IS NOT NULL;

-- Qualification queries: org_id + qualification_status
CREATE INDEX IF NOT EXISTS idx_call_logs_org_qualification_opt 
ON call_logs(org_id, qualification_status, created_at DESC)
WHERE org_id IS NOT NULL AND qualification_status IS NOT NULL;

-- User-specific queries within org: org_id + user_id (if queries need user filtering)
-- Note: This is less common now with org_id multi-tenancy, but kept for compatibility
CREATE INDEX IF NOT EXISTS idx_call_logs_org_user_created_opt 
ON call_logs(org_id, user_id, created_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- ============================================
-- CALLS TABLE - Optimized Indexes
-- ============================================

-- Dashboard queries: org_id + created_at
CREATE INDEX IF NOT EXISTS idx_calls_org_created_at_opt 
ON calls(org_id, created_at DESC)
WHERE org_id IS NOT NULL;

-- Status filtering: org_id + status
CREATE INDEX IF NOT EXISTS idx_calls_org_status_opt 
ON calls(org_id, status, created_at DESC)
WHERE org_id IS NOT NULL;

-- User queries within org: org_id + user_id + created_at
CREATE INDEX IF NOT EXISTS idx_calls_org_user_created_opt 
ON calls(org_id, user_id, created_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- ============================================
-- CAMPAIGNS TABLE - Optimized Indexes
-- ============================================

-- Status filtering: org_id + status (active, paused, draft campaigns)
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status_opt 
ON campaigns(org_id, status, created_at DESC)
WHERE org_id IS NOT NULL;

-- User queries within org: org_id + user_id
CREATE INDEX IF NOT EXISTS idx_campaigns_org_user_opt 
ON campaigns(org_id, user_id, created_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- Locked campaigns query: org_id + is_locked (for campaign management)
CREATE INDEX IF NOT EXISTS idx_campaigns_org_locked_opt 
ON campaigns(org_id, is_locked, created_at DESC)
WHERE org_id IS NOT NULL AND is_locked = true;

-- ============================================
-- CONTACTS TABLE - Optimized Indexes
-- ============================================

-- Status filtering: org_id + status (pending, queued, completed contacts)
CREATE INDEX IF NOT EXISTS idx_contacts_org_status_opt 
ON contacts(org_id, status, updated_at DESC)
WHERE org_id IS NOT NULL;

-- Campaign + status: org_id + campaign_id + status (contacts by campaign)
CREATE INDEX IF NOT EXISTS idx_contacts_org_campaign_status_opt 
ON contacts(org_id, campaign_id, status, updated_at DESC)
WHERE org_id IS NOT NULL AND campaign_id IS NOT NULL;

-- User queries within org: org_id + user_id + updated_at
CREATE INDEX IF NOT EXISTS idx_contacts_org_user_updated_opt 
ON contacts(org_id, user_id, updated_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- User + status: org_id + user_id + status
CREATE INDEX IF NOT EXISTS idx_contacts_org_user_status_opt 
ON contacts(org_id, user_id, status, updated_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- ============================================
-- KNOWLEDGE_BASE TABLE - Optimized Indexes
-- ============================================

-- Active KB documents: org_id + active (most common query)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_active_opt 
ON knowledge_base(org_id, active, updated_at DESC)
WHERE org_id IS NOT NULL AND active = true;

-- User queries within org: org_id + user_id + active
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_user_active_opt 
ON knowledge_base(org_id, user_id, active, updated_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- All KB documents by org: org_id + updated_at
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_updated_opt 
ON knowledge_base(org_id, updated_at DESC)
WHERE org_id IS NOT NULL;

-- ============================================
-- LEADS TABLE - Optimized Indexes
-- ============================================

-- Status filtering: org_id + status (pending, called, qualified leads)
CREATE INDEX IF NOT EXISTS idx_leads_org_status_opt 
ON leads(org_id, status, created_at DESC)
WHERE org_id IS NOT NULL;

-- User queries within org: org_id + user_id + created_at
CREATE INDEX IF NOT EXISTS idx_leads_org_user_created_opt 
ON leads(org_id, user_id, created_at DESC)
WHERE org_id IS NOT NULL AND user_id IS NOT NULL;

-- Recent leads by org: org_id + created_at
CREATE INDEX IF NOT EXISTS idx_leads_org_created_at_opt 
ON leads(org_id, created_at DESC)
WHERE org_id IS NOT NULL;

-- ============================================
-- CAMPAIGN_LEADS TABLE - Optimized Indexes
-- ============================================

-- Campaign leads by org: org_id + campaign_id (for campaign analytics)
CREATE INDEX IF NOT EXISTS idx_campaign_leads_org_campaign_opt 
ON campaign_leads(org_id, campaign_id, created_at DESC)
WHERE org_id IS NOT NULL AND campaign_id IS NOT NULL;

-- Lead queries within org: org_id + lead_id
CREATE INDEX IF NOT EXISTS idx_campaign_leads_org_lead_opt 
ON campaign_leads(org_id, lead_id)
WHERE org_id IS NOT NULL AND lead_id IS NOT NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify indexes were created:
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
--   AND indexname LIKE '%_org_%_opt'
-- ORDER BY tablename, indexname;
--
-- ============================================
-- NOTES ON INDEX MAINTENANCE
-- ============================================
--
-- Existing indexes (without org_id) are kept for:
-- 1. Backward compatibility with legacy queries
-- 2. Different query patterns (e.g., admin queries that need all orgs)
-- 3. Gradual migration (can deprecate later)
--
-- New optimized indexes (with org_id first) should be used for:
-- 1. All user-facing queries (dashboard, reports, etc.)
-- 2. Multi-tenant queries (always filter by org_id first)
-- 3. Performance-critical queries
--
-- Query optimization tips:
-- - Always include org_id in WHERE clause when using optimized indexes
-- - PostgreSQL query planner will automatically choose the best index
-- - Monitor index usage with: SELECT * FROM pg_stat_user_indexes;
--
-- Future optimization:
-- - If old indexes show zero usage after 30 days, consider dropping them
-- - Monitor index bloat: SELECT * FROM pg_stat_user_tables WHERE relname = 'call_logs';
-- - Consider partial indexes for frequently filtered values (status = 'completed')
