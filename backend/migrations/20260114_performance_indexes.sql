-- Performance Optimization Indexes
-- Created: 2026-01-14
-- Purpose: Eliminate full table scans and improve dashboard query performance
-- ============================================================================
-- CALLS TABLE INDEXES
-- ============================================================================
-- Primary index for org-specific call lookups with time ordering
-- This is the most critical index for dashboard performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_org_created ON public.calls (org_id, created_at DESC);
-- Index for direction-based filtering (inbound/outbound analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_direction_org ON public.calls (org_id, direction);
-- Index for financial value calculations (pipeline analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_financial_value ON public.calls (org_id, financial_value)
WHERE financial_value IS NOT NULL;
-- ============================================================================
-- LEADS TABLE INDEXES
-- ============================================================================
-- Index for hot lead filtering (most common dashboard query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_temp_org ON public.leads (org_id, lead_temp)
WHERE lead_temp = 'hot';
-- Index for lead status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_org ON public.leads (org_id, status);
-- ============================================================================
-- ORGANIZATION MEMBERS TABLE INDEXES
-- ============================================================================
-- Index for user authentication lookups
-- Speeds up "which org does this user belong to" queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_id ON public.organization_members (user_id);
-- Composite index for org member lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_composite ON public.organization_members (org_id, user_id);
-- ============================================================================
-- NOTIFICATIONS TABLE INDEXES
-- ============================================================================
-- Index for org-specific notification queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_org_created ON public.notifications (org_id, created_at DESC);
-- Index for unread notification filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read_status ON public.notifications (org_id, read)
WHERE read = false;
-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify index usage:
-- EXPLAIN ANALYZE SELECT * FROM calls WHERE org_id = 'xxx' ORDER BY created_at DESC LIMIT 10;
-- EXPLAIN ANALYZE SELECT * FROM leads WHERE org_id = 'xxx' AND lead_temp = 'hot';
-- EXPLAIN ANALYZE SELECT * FROM organization_members WHERE user_id = 'xxx';