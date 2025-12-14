-- Migration: Add CSV Imports Tables
-- Purpose: Track CSV lead imports with progress, errors, and audit trail
-- Date: 2025-12-12

-- ============================================================================
-- 1. CREATE IMPORTS TABLE
-- ============================================================================
-- Tracks each CSV import job with status and progress

CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- File info
    filename TEXT NOT NULL,
    file_size_bytes INTEGER,
    file_path TEXT,  -- Path in Supabase Storage if stored
    
    -- Progress tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Uploaded, waiting to process
        'validating',   -- Checking CSV structure
        'processing',   -- Inserting leads
        'completed',    -- Done successfully
        'failed',       -- Critical error, stopped
        'partial'       -- Completed with some errors
    )),
    
    -- Row counts
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    created_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Import options
    dedupe_mode TEXT DEFAULT 'skip' CHECK (dedupe_mode IN ('skip', 'update', 'create')),
    column_mapping JSONB DEFAULT '{}'::jsonb,  -- Maps CSV headers to lead fields
    
    -- Error summary
    error_message TEXT,
    
    -- Audit
    uploaded_by TEXT,  -- User email or ID
    uploaded_ip TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE IMPORT_ERRORS TABLE
-- ============================================================================
-- Stores per-row errors for failed imports

CREATE TABLE IF NOT EXISTS import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    
    -- Row info
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL,  -- Original CSV row as JSON
    
    -- Error details
    error_type TEXT NOT NULL CHECK (error_type IN (
        'validation',   -- Field validation failed
        'duplicate',    -- Phone already exists
        'database',     -- DB insert error
        'format'        -- CSV parsing error
    )),
    error_message TEXT NOT NULL,
    field_name TEXT,  -- Which field caused the error
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_imports_org_id ON imports(org_id);
CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_created_at ON imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_uploaded_by ON imports(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id ON import_errors(import_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_error_type ON import_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_import_errors_row_number ON import_errors(row_number);

-- ============================================================================
-- 4. ADD UNIQUE CONSTRAINT ON LEADS FOR DEDUPE
-- ============================================================================
-- Allows ON CONFLICT handling for phone + org_id

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_phone_unique 
ON leads(org_id, phone) 
WHERE phone IS NOT NULL;

-- ============================================================================
-- 5. ADD IMPORT_ID TO LEADS TABLE
-- ============================================================================
-- Track which import created each lead

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES imports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_import_id ON leads(import_id);

-- ============================================================================
-- 6. UPDATE TRIGGER FOR IMPORTS
-- ============================================================================

DROP TRIGGER IF EXISTS update_imports_updated_at ON imports;
CREATE TRIGGER update_imports_updated_at
    BEFORE UPDATE ON imports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. ✓ Created imports table for tracking CSV upload jobs
-- 2. ✓ Created import_errors table for per-row error tracking
-- 3. ✓ Added indexes for performance
-- 4. ✓ Added unique constraint on leads(org_id, phone) for dedupe
-- 5. ✓ Added import_id column to leads table
-- 6. ✓ Added updated_at trigger
