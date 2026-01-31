/**
 * Database Migrations Service
 * Initializes required database views and schemas on server startup
 */

import { supabase } from './supabase-client';
import { log } from './logger';

export async function initializeDatabaseViews() {
  try {
    log.info('DB_INIT', 'Initializing database views...');

    // Check if view exists
    const { data: viewCheck, error: viewCheckError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'view_clinical_dashboard_pulse')
      .maybeSingle();

    if (viewCheck || !viewCheckError) {
      log.info('DB_INIT', '✅ Dashboard pulse view already exists');
      return;
    }

    // View doesn't exist, create it using RPC if available
    log.info('DB_INIT', 'Creating dashboard pulse view...');

    // Create the view and index using a helper function
    const { error: createError } = await supabase.rpc('create_view_clinical_dashboard_pulse');

    if (createError) {
      // If RPC doesn't exist, try via direct insert into a migration tracking table
      log.warn('DB_INIT', 'RPC function not available, attempting direct SQL via helper...');

      // Create a temporary function that can execute the SQL
      const setupSql = `
        -- Temporarily create a helper function to setup views
        CREATE OR REPLACE FUNCTION setup_analytics_views()
        RETURNS void AS $$
        BEGIN
          DROP VIEW IF EXISTS view_clinical_dashboard_pulse;

          CREATE VIEW view_clinical_dashboard_pulse AS
          SELECT
            org_id,
            call_direction,
            COUNT(*) as total_calls,
            AVG(COALESCE(duration_seconds, 0)) as avg_duration_seconds,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
            COUNT(CASE WHEN recording_url IS NOT NULL OR recording_storage_path IS NOT NULL THEN 1 END) as calls_with_recording
          FROM calls
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY org_id, call_direction;

          CREATE INDEX IF NOT EXISTS idx_calls_stats
          ON calls(created_at DESC, call_direction, status, duration_seconds)
          WHERE created_at > NOW() - INTERVAL '30 days';
        END;
        $$ LANGUAGE plpgsql;
      `;

      const { error: funcError } = await supabase.rpc('_execute_sql', { sql: setupSql });

      if (!funcError) {
        // Now execute the function
        const { error: execError } = await supabase.rpc('setup_analytics_views');
        if (execError) {
          log.error('DB_INIT', 'Failed to execute setup function', { error: execError.message });
        } else {
          log.info('DB_INIT', '✅ Database views initialized via helper function');
        }
      } else {
        log.warn('DB_INIT', 'Could not create helper function via RPC', { error: funcError.message });
      }
    } else {
      log.info('DB_INIT', '✅ Database views created via RPC');
    }
  } catch (error: any) {
    log.error('DB_INIT', 'Failed to initialize database views', {
      error: error?.message || 'Unknown error'
    });
    // Don't throw - allow server to continue even if view initialization fails
  }
}

/**
 * Initialize all database schemas and migrations on startup
 */
export async function initializeDatabase() {
  try {
    log.info('DB_INIT', 'Starting database initialization...');

    // Initialize views
    await initializeDatabaseViews();

    log.info('DB_INIT', 'Database initialization complete');
  } catch (error: any) {
    log.error('DB_INIT', 'Database initialization failed', {
      error: error?.message || 'Unknown error'
    });
  }
}
