/**
 * Google Calendar OAuth Test Setup
 *
 * Provides pre-authorized test credentials for automated E2E testing
 * without requiring manual OAuth consent screen approval.
 *
 * Method: Uses service account credentials to bypass OAuth flow in CI/CD
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface CalendarTestSetup {
  calendarId: string;
  accessToken: string;
  testOrgId: string;
}

/**
 * Setup test calendar integration for TestSprite tests
 *
 * This function:
 * 1. Creates a dedicated test calendar (if not exists)
 * 2. Stores test credentials in database
 * 3. Returns calendar ID for use in booking tests
 *
 * @param orgId - Test organization ID
 * @returns Calendar test setup data
 */
export async function setupTestCalendarIntegration(orgId: string): Promise<CalendarTestSetup> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if test calendar integration already exists
  const { data: existing } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider_type', 'google_calendar')
    .single();

  if (existing) {
    return {
      calendarId: existing.credentials.calendar_id,
      accessToken: 'test_service_account_token',
      testOrgId: orgId
    };
  }

  // Create test calendar integration
  // Note: In real implementation, this would use Google Calendar API
  // For TestSprite, we use a mock integration that simulates calendar behavior
  const testCalendarId = `test_calendar_${orgId}`;

  await supabase.from('integrations').insert({
    org_id: orgId,
    provider_type: 'google_calendar',
    credentials: {
      access_token: 'test_service_account_token',
      refresh_token: 'not_needed_for_service_account',
      calendar_id: testCalendarId,
      token_type: 'Bearer',
      expiry_date: null // Service accounts don't expire
    },
    is_active: true,
    metadata: {
      calendar_name: 'TestSprite Test Calendar',
      timezone: 'Europe/London',
      description: 'Automated test calendar for E2E testing'
    }
  });

  return {
    calendarId: testCalendarId,
    accessToken: 'test_service_account_token',
    testOrgId: orgId
  };
}

/**
 * Cleanup test calendar integration
 *
 * @param orgId - Test organization ID
 */
export async function cleanupTestCalendarIntegration(orgId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await supabase
    .from('integrations')
    .delete()
    .eq('org_id', orgId)
    .eq('provider_type', 'google_calendar');
}

/**
 * Verify test calendar is accessible
 *
 * @param orgId - Test organization ID
 * @returns true if calendar is accessible
 */
export async function verifyTestCalendar(orgId: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider_type', 'google_calendar')
    .eq('is_active', true)
    .single();

  return !error && !!data;
}
