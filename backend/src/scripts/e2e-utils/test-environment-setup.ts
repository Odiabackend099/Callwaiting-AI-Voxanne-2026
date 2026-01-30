#!/usr/bin/env ts-node
/**
 * E2E Test Environment Setup & Cleanup
 *
 * Creates isolated test organization with:
 * - Test org with unique name
 * - Google Calendar test credentials
 * - Twilio test credentials
 * - Knowledge base with test content
 * - Test contact
 *
 * Cleanup removes all test data including:
 * - Google Calendar events
 * - Database records (cascading delete)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getCalendarClient } from '../../services/google-oauth-service';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface TestEnvironment {
  orgId: string;
  contactId: string;
  kbId: string;
}

/**
 * Creates a complete test environment
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  console.log('⚙️  Setting up test environment...');

  // 1. Create test organization
  const timestamp = Date.now();
  const testOrg = await supabase
    .from('organizations')
    .insert({
      name: `E2E Test Org ${timestamp}`,
      email: `e2e-${timestamp}@voxanne-demo.ai`,
      timezone: 'America/New_York',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (testOrg.error) {
    throw new Error(`Failed to create test org: ${testOrg.error.message}`);
  }

  const orgId = testOrg.data.id;
  console.log(`   ✅ Test org created: ${orgId.substring(0, 8)}...`);

  try {
    // 2. Seed Google Calendar test credentials
    const googleCreds = {
      access_token: process.env.GOOGLE_TEST_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_TEST_REFRESH_TOKEN,
      expiry_date: Date.now() + 3600000, // 1 hour from now
      email: 'test@voxanne-demo.ai'
    };

    // Store encrypted credentials
    await supabase
      .from('org_credentials')
      .insert({
        org_id: orgId,
        provider: 'google_calendar',
        encrypted_config: JSON.stringify(googleCreds), // In production this would be encrypted
        is_active: true,
        connected_calendar_email: 'test@voxanne-demo.ai',
        metadata: { email: 'test@voxanne-demo.ai' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    console.log('   ✅ Google Calendar credentials seeded');

    // 3. Seed Twilio test credentials
    const twilioCreds = {
      accountSid: process.env.TWILIO_TEST_ACCOUNT_SID,
      authToken: process.env.TWILIO_TEST_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_TEST_PHONE || '+15005550006'
    };

    await supabase
      .from('org_credentials')
      .insert({
        org_id: orgId,
        provider: 'twilio',
        encrypted_config: JSON.stringify(twilioCreds), // In production this would be encrypted
        is_active: true,
        metadata: { phoneNumber: twilioCreds.phoneNumber },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    console.log('   ✅ Twilio credentials seeded');

    // 4. Seed knowledge base
    const kb = await seedTestKnowledgeBase(orgId);
    console.log(`   ✅ Knowledge base seeded: ${kb.id.substring(0, 8)}...`);

    // 5. Create test contact
    const contact = await supabase
      .from('contacts')
      .insert({
        org_id: orgId,
        phone: '+15550001234',
        name: 'Test Patient',
        email: 'test.patient@example.com',
        lead_status: 'warm',
        lead_score: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (contact.error) {
      throw new Error(`Failed to create test contact: ${contact.error.message}`);
    }

    console.log(`   ✅ Test contact created: ${contact.data.id.substring(0, 8)}...`);

    return {
      orgId,
      contactId: contact.data.id,
      kbId: kb.id
    };
  } catch (error) {
    // Cleanup on error
    await supabase.from('organizations').delete().eq('id', orgId);
    throw error;
  }
}

/**
 * Seeds test knowledge base with realistic clinic data
 */
async function seedTestKnowledgeBase(orgId: string): Promise<any> {
  const kbContent = `
# Services & Pricing

## Botox Treatment
- Forehead lines: $400
- Crow's feet: $350
- Frown lines: $300
- Full face: $900

## Chemical Peels
- Superficial peel: $200
- Medium peel: $350
- Deep peel: $600

## Dermal Fillers
- Per syringe: $600
- Package of 3: $1,500

# Office Hours

Monday-Friday: 9:00 AM - 6:00 PM
Saturday: 10:00 AM - 4:00 PM
Sunday: Closed

# Location

123 Medical Plaza, Suite 200
New York, NY 10001
Phone: (555) 123-4567

# About Our Team

Dr. Sarah Johnson, MD - Board Certified Dermatologist
15 years of experience in cosmetic dermatology

Dr. Michael Chen, MD - Aesthetic Medicine Specialist
10 years specializing in non-surgical facial rejuvenation
  `.trim();

  const kb = await supabase
    .from('knowledge_base')
    .insert({
      org_id: orgId,
      filename: 'e2e-test-kb.txt',
      content: kbContent,
      category: 'products_services',
      active: true,
      version: 1,
      metadata: { source: 'e2e-test', bytes: kbContent.length },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (kb.error) {
    throw new Error(`Failed to create knowledge base: ${kb.error.message}`);
  }

  // TODO: Auto-chunk and embed the KB content
  // For now, we'll skip this step as it requires additional setup
  // The chunks would normally be created by the auto-chunking service

  return kb.data;
}

/**
 * Cleans up all test data
 */
export async function cleanupTestEnvironment(orgId: string): Promise<void> {
  console.log('\n🧹 Cleaning up test environment...');

  try {
    // 1. Delete Google Calendar events created during test
    try {
      const { calendar } = await getCalendarClient(orgId);
      const events = await calendar.events.list({
        calendarId: 'primary',
        q: 'E2E Test',
        maxResults: 100
      });

      const eventsToDelete = events.data.items || [];
      for (const event of eventsToDelete) {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: event.id!
        });
      }

      if (eventsToDelete.length > 0) {
        console.log(`   ✅ Deleted ${eventsToDelete.length} Google Calendar events`);
      }
    } catch (error) {
      // Calendar cleanup is best-effort - don't fail if it doesn't work
      console.log(`   ⚠️  Could not clean up calendar events: ${error.message}`);
    }

    // 2. Delete organization (cascades to all related records via FK constraints)
    const result = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (result.error) {
      throw new Error(`Failed to delete test org: ${result.error.message}`);
    }

    console.log('   ✅ Test organization and all related data deleted');
  } catch (error) {
    console.error(`   ❌ Cleanup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Helper assertion function for tests
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
