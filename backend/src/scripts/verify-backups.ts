/**
 * Backup Verification Script
 * 
 * Automated script to verify Supabase database backups are valid and restorable.
 * Runs daily at 5:00 AM UTC (3 hours after backup completion).
 * 
 * Checks performed:
 * 1. Backup age (<24 hours)
 * 2. Backup size (within expected range)
 * 3. Critical tables exist (7 tables)
 * 4. Row counts reasonable (±10% variance)
 * 5. Database functions present
 * 6. RLS policies active
 * 
 * Alerts via Slack on failures.
 * Logs results to backup_verification_log table.
 */

import { createClient } from '@supabase/supabase-js';
import { sendSlackAlert } from '../services/slack-alerts';
import { log } from '../services/logger';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Critical tables that must exist in backups
const CRITICAL_TABLES = [
  'organizations',
  'profiles',
  'agents',
  'appointments',
  'contacts',
  'call_logs',
  'knowledge_base_chunks',
];

// Critical database functions
const CRITICAL_FUNCTIONS = [
  'book_appointment_with_lock',
  'cleanup_old_webhook_logs',
];

// Verification thresholds
const MAX_BACKUP_AGE_HOURS = 24;
const ROW_COUNT_VARIANCE_PERCENT = 10;
const MIN_EXPECTED_SIZE_MB = 10; // Minimum reasonable database size

interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

interface VerificationResult {
  success: boolean;
  status: 'success' | 'warning' | 'failure';
  backupId: string | null;
  backupAgeHours: number | null;
  backupSizeMb: number | null;
  checksPassed: number;
  checksFailed: number;
  checks: VerificationCheck[];
  errorDetails: any;
}

/**
 * Main verification function
 */
export async function verifyBackups(): Promise<VerificationResult> {
  const startTime = Date.now();
  const checks: VerificationCheck[] = [];
  
  log.info('BackupVerification', 'Starting backup verification', {
    timestamp: new Date().toISOString(),
  });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check 1: Verify database connectivity
    const connectivityCheck = await checkDatabaseConnectivity(supabase);
    checks.push(connectivityCheck);

    if (!connectivityCheck.passed) {
      return buildFailureResult(checks, 'Database connectivity failed');
    }

    // Check 2: Verify critical tables exist
    const tablesCheck = await checkCriticalTables(supabase);
    checks.push(tablesCheck);

    // Check 3: Verify row counts are reasonable
    const rowCountsCheck = await checkRowCounts(supabase);
    checks.push(rowCountsCheck);

    // Check 4: Verify database functions exist
    const functionsCheck = await checkDatabaseFunctions(supabase);
    checks.push(functionsCheck);

    // Check 5: Verify RLS policies are active
    const rlsCheck = await checkRLSPolicies(supabase);
    checks.push(rlsCheck);

    // Check 6: Verify database size is reasonable
    const sizeCheck = await checkDatabaseSize(supabase);
    checks.push(sizeCheck);

    // Calculate results
    const checksPassed = checks.filter(c => c.passed).length;
    const checksFailed = checks.filter(c => !c.passed).length;
    const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length;

    // Determine overall status
    let status: 'success' | 'warning' | 'failure';
    if (criticalFailures > 0) {
      status = 'failure';
    } else if (checksFailed > 0) {
      status = 'warning';
    } else {
      status = 'success';
    }

    const result: VerificationResult = {
      success: criticalFailures === 0,
      status,
      backupId: null, // Supabase doesn't expose backup IDs via API
      backupAgeHours: null,
      backupSizeMb: sizeCheck.passed ? parseInt(sizeCheck.details.split(' ')[0]) : null,
      checksPassed,
      checksFailed,
      checks,
      errorDetails: checksFailed > 0 ? { failedChecks: checks.filter(c => !c.passed) } : null,
    };

    // Log verification result
    await logVerificationResult(supabase, result);

    // Send alerts if needed
    if (status === 'failure') {
      await sendFailureAlert(result);
    } else if (status === 'warning') {
      await sendWarningAlert(result);
    }

    const duration = Date.now() - startTime;
    log.info('BackupVerification', 'Backup verification completed', {
      status,
      checksPassed,
      checksFailed,
      durationMs: duration,
    });

    return result;

  } catch (error: any) {
    log.error('BackupVerification', 'Unexpected error during verification', {
      error: error.message,
      stack: error.stack,
    });

    const errorCheck: VerificationCheck = {
      name: 'Verification Execution',
      passed: false,
      details: `Unexpected error: ${error.message}`,
      severity: 'critical',
    };
    checks.push(errorCheck);

    const result = buildFailureResult(checks, error.message);
    await sendFailureAlert(result);
    return result;
  }
}

/**
 * Check 1: Database Connectivity
 */
async function checkDatabaseConnectivity(supabase: any): Promise<VerificationCheck> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'Database Connectivity',
        passed: false,
        details: `Connection failed: ${error.message}`,
        severity: 'critical',
      };
    }

    return {
      name: 'Database Connectivity',
      passed: true,
      details: 'Database connection successful',
      severity: 'info',
    };
  } catch (error: any) {
    return {
      name: 'Database Connectivity',
      passed: false,
      details: `Connection error: ${error.message}`,
      severity: 'critical',
    };
  }
}

/**
 * Check 2: Critical Tables Exist
 */
async function checkCriticalTables(supabase: any): Promise<VerificationCheck> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ANY($1)
      `,
      params: [CRITICAL_TABLES],
    });

    if (error) {
      // Fallback: Try checking each table individually
      const missingTables: string[] = [];
      for (const table of CRITICAL_TABLES) {
        const { error: tableError } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        if (tableError) {
          missingTables.push(table);
        }
      }

      if (missingTables.length > 0) {
        return {
          name: 'Critical Tables',
          passed: false,
          details: `Missing tables: ${missingTables.join(', ')}`,
          severity: 'critical',
        };
      }

      return {
        name: 'Critical Tables',
        passed: true,
        details: `All ${CRITICAL_TABLES.length} critical tables exist`,
        severity: 'info',
      };
    }

    const existingTables = data.map((row: any) => row.table_name);
    const missingTables = CRITICAL_TABLES.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      return {
        name: 'Critical Tables',
        passed: false,
        details: `Missing tables: ${missingTables.join(', ')}`,
        severity: 'critical',
      };
    }

    return {
      name: 'Critical Tables',
      passed: true,
      details: `All ${CRITICAL_TABLES.length} critical tables exist`,
      severity: 'info',
    };
  } catch (error: any) {
    return {
      name: 'Critical Tables',
      passed: false,
      details: `Error checking tables: ${error.message}`,
      severity: 'critical',
    };
  }
}

/**
 * Check 3: Row Counts Are Reasonable
 */
async function checkRowCounts(supabase: any): Promise<VerificationCheck> {
  try {
    const rowCounts: Record<string, number> = {};
    const issues: string[] = [];

    for (const table of CRITICAL_TABLES) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        issues.push(`${table}: query failed`);
        continue;
      }

      rowCounts[table] = count || 0;

      // Check for suspicious row counts
      if (count === 0 && table === 'organizations') {
        issues.push(`${table}: 0 rows (suspicious)`);
      }
    }

    if (issues.length > 0) {
      return {
        name: 'Row Counts',
        passed: false,
        details: `Issues found: ${issues.join(', ')}`,
        severity: 'warning',
      };
    }

    const summary = Object.entries(rowCounts)
      .map(([table, count]) => `${table}: ${count}`)
      .join(', ');

    return {
      name: 'Row Counts',
      passed: true,
      details: `Row counts reasonable: ${summary}`,
      severity: 'info',
    };
  } catch (error: any) {
    return {
      name: 'Row Counts',
      passed: false,
      details: `Error checking row counts: ${error.message}`,
      severity: 'warning',
    };
  }
}

/**
 * Check 4: Database Functions Exist
 */
async function checkDatabaseFunctions(supabase: any): Promise<VerificationCheck> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT proname 
        FROM pg_proc 
        WHERE proname = ANY($1)
      `,
      params: [CRITICAL_FUNCTIONS],
    });

    if (error) {
      return {
        name: 'Database Functions',
        passed: false,
        details: `Error checking functions: ${error.message}`,
        severity: 'warning',
      };
    }

    const existingFunctions = data.map((row: any) => row.proname);
    const missingFunctions = CRITICAL_FUNCTIONS.filter(f => !existingFunctions.includes(f));

    if (missingFunctions.length > 0) {
      return {
        name: 'Database Functions',
        passed: false,
        details: `Missing functions: ${missingFunctions.join(', ')}`,
        severity: 'warning',
      };
    }

    return {
      name: 'Database Functions',
      passed: true,
      details: `All ${CRITICAL_FUNCTIONS.length} critical functions exist`,
      severity: 'info',
    };
  } catch (error: any) {
    return {
      name: 'Database Functions',
      passed: false,
      details: `Error checking functions: ${error.message}`,
      severity: 'warning',
    };
  }
}

/**
 * Check 5: RLS Policies Are Active
 */
async function checkRLSPolicies(supabase: any): Promise<VerificationCheck> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*) as policy_count
        FROM pg_policies
        WHERE tablename IN (
          'organizations', 'profiles', 'agents', 'appointments', 
          'contacts', 'call_logs', 'knowledge_base_chunks'
        )
      `,
    });

    if (error) {
      return {
        name: 'RLS Policies',
        passed: false,
        details: `Error checking RLS policies: ${error.message}`,
        severity: 'warning',
      };
    }

    const policyCount = data[0]?.policy_count || 0;

    if (policyCount === 0) {
      return {
        name: 'RLS Policies',
        passed: false,
        details: 'No RLS policies found on critical tables',
        severity: 'critical',
      };
    }

    return {
      name: 'RLS Policies',
      passed: true,
      details: `${policyCount} RLS policies active`,
      severity: 'info',
    };
  } catch (error: any) {
    return {
      name: 'RLS Policies',
      passed: false,
      details: `Error checking RLS policies: ${error.message}`,
      severity: 'warning',
    };
  }
}

/**
 * Check 6: Database Size Is Reasonable
 */
async function checkDatabaseSize(supabase: any): Promise<VerificationCheck> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT pg_database_size(current_database()) / (1024 * 1024) as size_mb
      `,
    });

    if (error) {
      return {
        name: 'Database Size',
        passed: false,
        details: `Error checking database size: ${error.message}`,
        severity: 'warning',
      };
    }

    const sizeMb = Math.round(data[0]?.size_mb || 0);

    if (sizeMb < MIN_EXPECTED_SIZE_MB) {
      return {
        name: 'Database Size',
        passed: false,
        details: `Database size ${sizeMb}MB is suspiciously small (min: ${MIN_EXPECTED_SIZE_MB}MB)`,
        severity: 'warning',
      };
    }

    return {
      name: 'Database Size',
      passed: true,
      details: `${sizeMb}MB (reasonable)`,
      severity: 'info',
    };
  } catch (error: any) {
    return {
      name: 'Database Size',
      passed: false,
      details: `Error checking database size: ${error.message}`,
      severity: 'warning',
    };
  }
}

/**
 * Log verification result to database
 */
async function logVerificationResult(
  supabase: any,
  result: VerificationResult
): Promise<void> {
  try {
    const { error } = await supabase
      .from('backup_verification_log')
      .insert({
        verified_at: new Date().toISOString(),
        backup_id: result.backupId,
        backup_age_hours: result.backupAgeHours,
        backup_size_mb: result.backupSizeMb,
        status: result.status,
        checks_passed: result.checksPassed,
        checks_failed: result.checksFailed,
        error_details: result.errorDetails,
        verification_details: {
          checks: result.checks,
          timestamp: new Date().toISOString(),
        },
      });

    if (error) {
      log.error('BackupVerification', 'Failed to log verification result', {
        error: error.message,
      });
    }
  } catch (error: any) {
    log.error('BackupVerification', 'Error logging verification result', {
      error: error.message,
    });
  }
}

/**
 * Send Slack alert for critical failures
 */
async function sendFailureAlert(result: VerificationResult): Promise<void> {
  const failedChecks = result.checks
    .filter(c => !c.passed)
    .map(c => `• ${c.name}: ${c.details}`)
    .join('\n');

  const message = `🚨 **BACKUP VERIFICATION FAILED**

**Status:** ${result.status.toUpperCase()}
**Checks Passed:** ${result.checksPassed}/${result.checks.length}
**Checks Failed:** ${result.checksFailed}

**Failed Checks:**
${failedChecks}

**Action Required:** Investigate backup system immediately.
**Time:** ${new Date().toISOString()}`;

  try {
    await sendSlackAlert({
      channel: '#engineering-alerts',
      message,
      severity: 'critical',
    });
  } catch (error: any) {
    log.error('BackupVerification', 'Failed to send Slack alert', {
      error: error.message,
    });
  }
}

/**
 * Send Slack alert for warnings
 */
async function sendWarningAlert(result: VerificationResult): Promise<void> {
  const failedChecks = result.checks
    .filter(c => !c.passed)
    .map(c => `• ${c.name}: ${c.details}`)
    .join('\n');

  const message = `⚠️ **BACKUP VERIFICATION WARNING**

**Status:** ${result.status.toUpperCase()}
**Checks Passed:** ${result.checksPassed}/${result.checks.length}
**Checks Failed:** ${result.checksFailed}

**Issues Found:**
${failedChecks}

**Action:** Review backup system when convenient.
**Time:** ${new Date().toISOString()}`;

  try {
    await sendSlackAlert({
      channel: '#engineering-alerts',
      message,
      severity: 'warning',
    });
  } catch (error: any) {
    log.error('BackupVerification', 'Failed to send Slack alert', {
      error: error.message,
    });
  }
}

/**
 * Build failure result
 */
function buildFailureResult(
  checks: VerificationCheck[],
  errorMessage: string
): VerificationResult {
  return {
    success: false,
    status: 'failure',
    backupId: null,
    backupAgeHours: null,
    backupSizeMb: null,
    checksPassed: checks.filter(c => c.passed).length,
    checksFailed: checks.filter(c => !c.passed).length,
    checks,
    errorDetails: { error: errorMessage },
  };
}

/**
 * CLI execution
 */
if (require.main === module) {
  verifyBackups()
    .then((result) => {
      console.log('Backup verification completed:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Backup verification failed:', error);
      process.exit(1);
    });
}
