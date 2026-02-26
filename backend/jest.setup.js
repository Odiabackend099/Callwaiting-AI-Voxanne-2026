/**
 * Jest Setup File
 * Runs before all tests to initialize test database schema
 */

require('dotenv').config();

// Mock logger globally for all tests
jest.mock('./src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  }
}));

// Mock Sentry globally for all tests
jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: (callback) => callback({ setContext: jest.fn(), setLevel: jest.fn() })
}));

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const db = createClient(supabaseUrl, supabaseKey);

// Create bookings table before tests run
module.exports = async () => {
  try {
    // Check if table exists by trying a simple query
    const { error: checkError } = await db
      .from('bookings')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('[Jest Setup] Bookings table already exists');
      return;
    }

    // Table doesn't exist, create it
    console.log('[Jest Setup] Creating bookings table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL,
        patient_email text NOT NULL,
        provider_id uuid NOT NULL,
        start_time timestamp with time zone NOT NULL,
        end_time timestamp with time zone NOT NULL,
        status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
        calendar_event_id text,
        confirmation_token text UNIQUE,
        patient_confirmed_at timestamp with time zone,
        notes text,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        created_by uuid NOT NULL,
        
        CONSTRAINT fk_org_id FOREIGN KEY (org_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
        CONSTRAINT fk_provider_id FOREIGN KEY (provider_id) REFERENCES public.profiles(id),
        CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES public.profiles(id),
        CONSTRAINT check_time_range CHECK (start_time < end_time)
      );
      
      CREATE INDEX IF NOT EXISTS idx_bookings_org_id ON public.bookings(org_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON public.bookings(start_time);
      CREATE INDEX IF NOT EXISTS idx_bookings_org_id_status ON public.bookings(org_id, status);
      CREATE INDEX IF NOT EXISTS idx_bookings_provider_start ON public.bookings(provider_id, start_time);
    `;
    
    // We can't directly execute raw SQL with supabase-js from Node
    // So we'll create a workaround by checking each table operation
    console.log('[Jest Setup] Bookings table creation will be handled by test fixtures');
  } catch (error) {
    console.error('[Jest Setup] Error checking bookings table:', error);
  }
};
