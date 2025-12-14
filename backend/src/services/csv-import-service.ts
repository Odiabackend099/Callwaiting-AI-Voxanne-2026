/**
 * CSV Import Service
 * Handles CSV parsing, validation, and lead import with Vapi-style patterns
 */

import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { supabase } from './supabase-client';
import { createLogger } from './logger';

const logger = createLogger('csv-import');

// ============================================================================
// TYPES
// ============================================================================

export interface ImportOptions {
  orgId: string;
  dedupeMode: 'skip' | 'update' | 'create';
  columnMapping?: Record<string, string>;
  uploadedBy?: string;
  uploadedIp?: string;
}

export interface ImportResult {
  importId: string;
  status: 'completed' | 'partial' | 'failed';
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: ImportError[];
}

export interface ImportError {
  rowNumber: number;
  rawData: Record<string, string>;
  errorType: 'validation' | 'duplicate' | 'database' | 'format';
  errorMessage: string;
  fieldName?: string;
}

export interface LeadRow {
  phone: string;
  name?: string;
  contact_name?: string;
  company_name?: string;
  company?: string;
  email?: string;
  country?: string;
  city?: string;
  notes?: string;
  source?: string;
  [key: string]: string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Record<string, string>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REQUIRED_FIELDS = ['phone'];
const OPTIONAL_FIELDS = ['name', 'contact_name', 'company_name', 'company', 'email', 'country', 'city', 'notes', 'source'];

const FIELD_ALIASES: Record<string, string[]> = {
  phone: ['phone', 'phone_number', 'phonenumber', 'mobile', 'tel', 'telephone', 'cell', 'phone number'],
  contact_name: ['name', 'contact_name', 'contactname', 'full_name', 'fullname', 'contact', 'first_name', 'firstname', 'first name', 'first'],
  company_name: ['company', 'company_name', 'companyname', 'business', 'clinic', 'clinic_name', 'clinicname', 'clinic name', 'organization', 'org'],
  email: ['email', 'email_address', 'emailaddress', 'e-mail', 'e_mail'],
  country: ['country', 'nation', 'location_country'],
  city: ['city', 'town', 'location_city'],
  notes: ['notes', 'note', 'comments', 'comment', 'description', 'status'],
  source: ['source', 'lead_source', 'leadsource', 'origin', 'channel', 'category'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 50000;
const BATCH_SIZE = 500;

// ============================================================================
// PHONE VALIDATION (E.164)
// ============================================================================

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');
  
  if (cleaned.length < 7 || cleaned.length > 15) {
    return null;
  }
  
  // Add + prefix if not present and looks like international
  if (!hasPlus && cleaned.length >= 10) {
    // Assume Nigerian number if starts with 0
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    }
    // Assume US/Canada if 10 digits
    else if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
  }
  
  return '+' + cleaned;
}

function isValidE164(phone: string): boolean {
  // E.164: + followed by 7-15 digits
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

// ============================================================================
// CSV VALIDATION (Pre-import check)
// ============================================================================

export async function validateCsv(
  csvContent: string | Buffer,
  options: { maxPreviewRows?: number } = {}
): Promise<ValidationResult> {
  const maxPreviewRows = options.maxPreviewRows || 10;
  const errors: string[] = [];
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  return new Promise((resolve) => {
    const stream = typeof csvContent === 'string' 
      ? Readable.from([csvContent])
      : Readable.from([csvContent.toString('utf-8')]);

    let rowCount = 0;

    stream
      .pipe(parse({ 
        columns: true, 
        skip_empty_lines: true,
        trim: true,
        bom: true,  // Handle BOM for Excel exports
      }))
      .on('data', (row: Record<string, string>) => {
        rowCount++;
        if (rowCount === 1) {
          headers = Object.keys(row);
        }
        if (rows.length < maxPreviewRows) {
          rows.push(row);
        }
      })
      .on('end', () => {
        // Check for required columns
        const suggestedMapping = autoMapColumns(headers);
        
        if (!suggestedMapping.phone) {
          errors.push('Missing required column: phone. Expected one of: ' + FIELD_ALIASES.phone.join(', '));
        }

        if (rowCount === 0) {
          errors.push('CSV file is empty or has no data rows');
        }

        if (rowCount > MAX_ROWS) {
          errors.push(`Too many rows: ${rowCount}. Maximum allowed: ${MAX_ROWS}`);
        }

        resolve({
          valid: errors.length === 0,
          errors,
          headers,
          sampleRows: rows,
          totalRows: rowCount,
          suggestedMapping,
        });
      })
      .on('error', (err) => {
        errors.push(`CSV parsing error: ${err.message}`);
        resolve({
          valid: false,
          errors,
          headers: [],
          sampleRows: [],
          totalRows: 0,
          suggestedMapping: {},
        });
      });
  });
}

// ============================================================================
// AUTO-MAP COLUMNS
// ============================================================================

function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (aliases.includes(normalizedHeaders[i])) {
        mapping[field] = headers[i];
        break;
      }
    }
  }

  return mapping;
}

// ============================================================================
// IMPORT CSV LEADS
// ============================================================================

export async function importCsvLeads(
  csvContent: string | Buffer,
  options: ImportOptions
): Promise<ImportResult> {
  const { orgId, dedupeMode, columnMapping, uploadedBy, uploadedIp } = options;
  const requestId = crypto.randomUUID();
  
  logger.info('Starting CSV import', { requestId, orgId, dedupeMode });

  // 1. Create import record
  const { data: importRecord, error: createError } = await supabase
    .from('imports')
    .insert({
      org_id: orgId,
      filename: 'upload.csv',
      status: 'validating',
      dedupe_mode: dedupeMode,
      column_mapping: columnMapping || {},
      uploaded_by: uploadedBy,
      uploaded_ip: uploadedIp,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError || !importRecord) {
    logger.error('Failed to create import record', { requestId, error: createError });
    throw new Error('Failed to create import record: ' + createError?.message);
  }

  const importId = importRecord.id;
  const errors: ImportError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalRows = 0;

  try {
    // 2. Parse and validate CSV
    const rows = await parseCsvToRows(csvContent);
    totalRows = rows.length;

    // Update total rows
    await supabase
      .from('imports')
      .update({ total_rows: totalRows, status: 'processing' })
      .eq('id', importId);

    // 3. Get column mapping (auto-detect if not provided)
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const mapping = columnMapping && Object.keys(columnMapping).length > 0 
      ? columnMapping 
      : autoMapColumns(headers);

    // 4. Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchResult = await processBatch(batch, i, orgId, importId, dedupeMode, mapping);
      
      createdCount += batchResult.created;
      updatedCount += batchResult.updated;
      skippedCount += batchResult.skipped;
      failedCount += batchResult.failed;
      errors.push(...batchResult.errors);

      // Update progress
      await supabase
        .from('imports')
        .update({ 
          processed_rows: Math.min(i + BATCH_SIZE, totalRows),
          created_count: createdCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
        })
        .eq('id', importId);
    }

    // 5. Store errors in database
    if (errors.length > 0) {
      const errorRecords = errors.map(e => ({
        import_id: importId,
        row_number: e.rowNumber,
        raw_data: e.rawData,
        error_type: e.errorType,
        error_message: e.errorMessage,
        field_name: e.fieldName,
      }));

      await supabase.from('import_errors').insert(errorRecords);
    }

    // 6. Finalize import
    const finalStatus = failedCount === 0 ? 'completed' : (createdCount > 0 || updatedCount > 0 ? 'partial' : 'failed');
    
    await supabase
      .from('imports')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        failed_count: failedCount,
      })
      .eq('id', importId);

    logger.info('CSV import completed', { 
      requestId, 
      importId, 
      status: finalStatus,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
    });

    return {
      importId,
      status: finalStatus,
      totalRows,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      errors: errors.slice(0, 100), // Return first 100 errors
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('CSV import failed', { requestId, importId, error: errorMessage });

    await supabase
      .from('imports')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importId);

    return {
      importId,
      status: 'failed',
      totalRows,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      errors: [{ 
        rowNumber: 0, 
        rawData: {}, 
        errorType: 'database', 
        errorMessage 
      }],
    };
  }
}

// ============================================================================
// PARSE CSV TO ROWS
// ============================================================================

async function parseCsvToRows(csvContent: string | Buffer): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    const stream = typeof csvContent === 'string' 
      ? Readable.from([csvContent])
      : Readable.from([csvContent.toString('utf-8')]);

    stream
      .pipe(parse({ 
        columns: true, 
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ============================================================================
// PROCESS BATCH
// ============================================================================

interface BatchResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
}

async function processBatch(
  rows: Record<string, string>[],
  startIndex: number,
  orgId: string,
  importId: string,
  dedupeMode: 'skip' | 'update' | 'create',
  mapping: Record<string, string>
): Promise<BatchResult> {
  const result: BatchResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  const validLeads: any[] = [];

  // Validate and transform each row
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = startIndex + i + 2; // +2 for 1-indexed and header row
    const row = rows[i];
    
    try {
      const lead = transformRowToLead(row, mapping, orgId, importId);
      
      if (!lead.phone) {
        result.errors.push({
          rowNumber,
          rawData: row,
          errorType: 'validation',
          errorMessage: 'Missing or invalid phone number',
          fieldName: 'phone',
        });
        result.failed++;
        continue;
      }

      // Enrich lead with tier and pain points
      const enriched = enrichLead(lead);
      validLeads.push({ ...enriched, rowNumber });
    } catch (err) {
      result.errors.push({
        rowNumber,
        rawData: row,
        errorType: 'validation',
        errorMessage: err instanceof Error ? err.message : 'Validation error',
      });
      result.failed++;
    }
  }

  if (validLeads.length === 0) {
    return result;
  }

  // Check for existing leads (for dedupe)
  const phones = validLeads.map(l => l.phone);
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('org_id', orgId)
    .in('phone', phones);

  const existingPhones = new Set((existingLeads || []).map(l => l.phone));
  const existingPhoneToId = new Map((existingLeads || []).map(l => [l.phone, l.id]));

  // Process based on dedupe mode
  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  for (const lead of validLeads) {
    const { rowNumber, ...leadData } = lead;
    
    if (existingPhones.has(leadData.phone)) {
      if (dedupeMode === 'skip') {
        result.skipped++;
      } else if (dedupeMode === 'update') {
        toUpdate.push({ 
          id: existingPhoneToId.get(leadData.phone), 
          ...leadData,
          updated_at: new Date().toISOString(),
        });
      } else {
        // 'create' mode - insert anyway (will fail on unique constraint)
        toInsert.push(leadData);
      }
    } else {
      toInsert.push(leadData);
    }
  }

  // Batch insert new leads
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('leads')
      .insert(toInsert)
      .select();

    if (insertError) {
      logger.error('Batch insert failed', { error: insertError.message });
      // Mark all as failed
      for (const lead of toInsert) {
        result.errors.push({
          rowNumber: validLeads.find(l => l.phone === lead.phone)?.rowNumber || 0,
          rawData: lead,
          errorType: 'database',
          errorMessage: insertError.message,
        });
        result.failed++;
      }
    } else {
      result.created += inserted?.length || toInsert.length;
    }
  }

  // Batch update existing leads
  for (const lead of toUpdate) {
    const { id, ...updateData } = lead;
    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      result.errors.push({
        rowNumber: validLeads.find(l => l.phone === updateData.phone)?.rowNumber || 0,
        rawData: updateData,
        errorType: 'database',
        errorMessage: updateError.message,
      });
      result.failed++;
    } else {
      result.updated++;
    }
  }

  return result;
}

// ============================================================================
// LEAD ENRICHMENT & TIER ASSIGNMENT
// ============================================================================

function enrichLead(lead: Record<string, any>): Record<string, any> {
  const category = (lead.source || lead.company_name || '').toLowerCase();
  const city = (lead.city || '').toLowerCase();
  
  // Tier assignment logic
  const tier = assignTier(category);
  
  // Pain point extraction
  const painPoint = extractPainPoint(category, city);
  
  // Build personalization data
  const personalizationData = {
    tier,
    pain_point_identified: painPoint,
    category_detected: category,
    city_detected: city,
    enriched_at: new Date().toISOString(),
  };
  
  return {
    ...lead,
    personalization_data: personalizationData,
    metadata: {
      ...lead.metadata,
      tier,
      pain_point: painPoint,
    }
  };
}

function assignTier(category: string): 'A' | 'B' | 'C' {
  const tierAKeywords = [
    'plastic surgeon', 'plastic surgery', 'cosmetic surgeon', 'cosmetic surgery',
    'dermatology', 'dermatologist', 'med spa', 'medspa', 'medical spa'
  ];
  
  const tierBKeywords = [
    'aesthetics', 'aesthetic clinic', 'skin care', 'skincare', 'beauty clinic',
    'spa', 'wellness', 'clinic'
  ];
  
  const lowerCategory = category.toLowerCase();
  
  if (tierAKeywords.some(kw => lowerCategory.includes(kw))) {
    return 'A';
  } else if (tierBKeywords.some(kw => lowerCategory.includes(kw))) {
    return 'B';
  } else {
    return 'C';
  }
}

function extractPainPoint(category: string, city: string): string {
  const lowerCategory = category.toLowerCase();
  
  const painPointMap: Record<string, string> = {
    'plastic surgeon': 'Missed calls during consultation hours – most patients don\'t call back',
    'cosmetic surgeon': 'Phone bottleneck during peak hours – lost bookings to competitors',
    'dermatology': 'Overflow calls during peak times – need after-hours coverage',
    'med spa': 'Missed calls during treatment hours – receptionist can\'t answer all lines',
    'skin care': 'Patients can\'t reach you – they book elsewhere',
    'aesthetics': 'High call volume but low conversion – need better call handling',
    'beauty clinic': 'After-hours calls going unanswered – lost revenue',
  };
  
  for (const [keyword, painPoint] of Object.entries(painPointMap)) {
    if (lowerCategory.includes(keyword)) {
      return painPoint;
    }
  }
  
  return `Missed calls are costing ${city || 'your clinic'} bookings and revenue`;
}

// ============================================================================
// TRANSFORM ROW TO LEAD
// ============================================================================

function transformRowToLead(
  row: Record<string, string>,
  mapping: Record<string, string>,
  orgId: string,
  importId: string
): Record<string, any> {
  const getValue = (field: string): string | undefined => {
    const csvColumn = mapping[field];
    if (csvColumn && row[csvColumn]) {
      return row[csvColumn].trim();
    }
    // Fallback: try direct field name
    if (row[field]) {
      return row[field].trim();
    }
    return undefined;
  };

  // Normalize phone
  const rawPhone = getValue('phone');
  const phone = rawPhone ? normalizePhone(rawPhone) : null;

  if (phone && !isValidE164(phone)) {
    throw new Error(`Invalid phone format: ${rawPhone}`);
  }

  // Build lead object
  const lead: Record<string, any> = {
    org_id: orgId,
    import_id: importId,
    phone,
    contact_name: getValue('contact_name') || getValue('name'),
    company_name: getValue('company_name') || getValue('company'),
    email: getValue('email'),
    country: getValue('country'),
    city: getValue('city'),
    notes: getValue('notes'),
    source: getValue('source') || 'csv_import',
    status: 'new',
    created_at: new Date().toISOString(),
  };

  // Collect extra fields into metadata
  const knownFields = new Set([
    ...Object.values(mapping),
    ...REQUIRED_FIELDS,
    ...OPTIONAL_FIELDS,
    ...Object.values(FIELD_ALIASES).flat(),
  ]);

  const extras: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!knownFields.has(key.toLowerCase()) && value) {
      extras[key] = value;
    }
  }

  if (Object.keys(extras).length > 0) {
    lead.metadata = extras;
  }

  return lead;
}

// ============================================================================
// GET IMPORT STATUS
// ============================================================================

export async function getImportStatus(importId: string, orgId: string) {
  const { data: importRecord, error } = await supabase
    .from('imports')
    .select('*')
    .eq('id', importId)
    .eq('org_id', orgId)
    .single();

  if (error || !importRecord) {
    return null;
  }

  return importRecord;
}

// ============================================================================
// GET IMPORT ERRORS
// ============================================================================

export async function getImportErrors(importId: string, orgId: string, limit = 100) {
  // First verify the import belongs to this org
  const { data: importRecord } = await supabase
    .from('imports')
    .select('id')
    .eq('id', importId)
    .eq('org_id', orgId)
    .single();

  if (!importRecord) {
    return [];
  }

  const { data: errors } = await supabase
    .from('import_errors')
    .select('*')
    .eq('import_id', importId)
    .order('row_number', { ascending: true })
    .limit(limit);

  return errors || [];
}

// ============================================================================
// LIST IMPORTS
// ============================================================================

export async function listImports(orgId: string, limit = 20) {
  const { data: imports } = await supabase
    .from('imports')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return imports || [];
}

// ============================================================================
// GENERATE ERROR CSV
// ============================================================================

export async function generateErrorCsv(importId: string, orgId: string): Promise<string> {
  const errors = await getImportErrors(importId, orgId, 10000);
  
  if (errors.length === 0) {
    return '';
  }

  // Get all unique keys from raw_data
  const allKeys = new Set<string>();
  for (const error of errors) {
    Object.keys(error.raw_data || {}).forEach(k => allKeys.add(k));
  }
  
  const headers = ['row_number', 'error_type', 'error_message', 'field_name', ...Array.from(allKeys)];
  const csvRows = [headers.join(',')];

  for (const error of errors) {
    const row = [
      error.row_number,
      error.error_type,
      `"${(error.error_message || '').replace(/"/g, '""')}"`,
      error.field_name || '',
      ...Array.from(allKeys).map(k => {
        const val = error.raw_data?.[k] || '';
        return `"${val.replace(/"/g, '""')}"`;
      }),
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}
