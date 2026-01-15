import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Cloud Supabase connection (uses service role key for tests)
export const supabaseUrl = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
export const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

export const db: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
});

/**
 * Setup function: Run before each test to reset database state
 */
export async function setupIntegrationTest() {
  // Delete all test data
  await db.from('knowledge_base').delete().neq('id', '');
  await db.from('bookings').delete().neq('id', '');
  await db.from('orgs').delete().neq('id', '');
  
  // Verify tables exist
  const { error } = await db.from('orgs').select('id').limit(1);
  if (error) {
    console.warn('Warning: Tables may not exist. Run: supabase db reset');
  }
}

/**
 * Cleanup function: Run after each test
 */
export async function teardownIntegrationTest() {
  // Clean up test data
  await db.from('knowledge_base').delete().neq('id', '');
  await db.from('bookings').delete().neq('id', '');
  await db.from('orgs').delete().neq('id', '');
}

/**
 * Helper: Generate OpenAI embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return mock embedding for testing without OpenAI API
    return Array(1536).fill(0.1);
  }
}

/**
 * Helper: Measure performance
 */
export function createTimer() {
  const start = performance.now();
  return {
    elapsed: () => performance.now() - start,
    assert: (maxMs: number, message?: string) => {
      const elapsed = performance.now() - start;
      if (elapsed > maxMs) {
        throw new Error(
          message || 
          `Performance assertion failed: ${elapsed.toFixed(2)}ms > ${maxMs}ms`
        );
      }
      return elapsed;
    }
  };
}
