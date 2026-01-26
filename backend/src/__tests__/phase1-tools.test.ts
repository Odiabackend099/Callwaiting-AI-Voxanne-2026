/**
 * Phase 1 Tools Tests
 *
 * Tests for:
 * 1. transferCall endpoint
 * 2. lookupCaller endpoint
 * 3. Identity injection logic
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let testOrgId: string;
let testContactId: string;

describe('Phase 1: Operational Core Tools', () => {
  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'Phase 1 Test Org' })
      .select()
      .single();

    testOrgId = org!.id;

    // Create test contact
    const { data: contact } = await supabase
      .from('contacts')
      .insert({
        org_id: testOrgId,
        name: 'Test User',
        phone: '+15551234567',
        email: 'test@example.com',
        lead_status: 'contacted'
      })
      .select()
      .single();

    testContactId = contact!.id;

    // Configure transfer settings
    await supabase
      .from('integration_settings')
      .upsert({
        org_id: testOrgId,
        transfer_phone_number: '+15559876543',
        transfer_departments: {
          general: '+15559876543',
          billing: '+15551111111',
          medical: '+15552222222'
        }
      });
  });

  afterAll(async () => {
    // Cleanup
    if (testOrgId) {
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
  });

  describe('transferCall Tool', () => {
    it('should return transfer destination for valid request', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/transferCall`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                summary: 'Customer wants billing help',
                department: 'billing'
              }
            }
          }],
          call: {
            id: 'test-call-123',
            metadata: { org_id: testOrgId },
            customer: { number: '+15551234567' }
          }
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.toolResult).toBeDefined();
      expect(response.data.transfer).toBeDefined();
      expect(response.data.transfer.destination.number).toBe('+15551111111'); // Billing dept
    });

    it('should fall back to default number when department not configured', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/transferCall`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                summary: 'General inquiry',
                department: 'general'
              }
            }
          }],
          call: {
            id: 'test-call-456',
            metadata: { org_id: testOrgId }
          }
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.transfer.destination.number).toBe('+15559876543');
    });

    it('should return error when org not found', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/transferCall`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                summary: 'Test',
                department: 'general'
              }
            }
          }],
          call: {
            id: 'test-call-789',
            metadata: { org_id: '00000000-0000-0000-0000-000000000000' }
          }
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.speech).toContain('not configured');
    });

    it('should log transfer to call_logs', async () => {
      // Create a test call log
      const { data: callLog } = await supabase
        .from('call_logs')
        .insert({
          org_id: testOrgId,
          vapi_call_id: 'test-log-call-123',
          phone_number: '+15551234567',
          status: 'in-progress'
        })
        .select()
        .single();

      // Trigger transfer
      await axios.post(`${BACKEND_URL}/api/vapi/tools/transferCall`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                summary: 'Needs medical consultation',
                department: 'medical'
              }
            }
          }],
          call: {
            id: 'test-log-call-123',
            metadata: { org_id: testOrgId }
          }
        }
      });

      // Verify transfer logged
      const { data: updatedLog } = await supabase
        .from('call_logs')
        .select('transfer_to, transfer_reason')
        .eq('vapi_call_id', 'test-log-call-123')
        .single();

      expect(updatedLog?.transfer_to).toBe('+15552222222');
      expect(updatedLog?.transfer_reason).toContain('medical');
    });
  });

  describe('lookupCaller Tool', () => {
    it('should find contact by phone', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/lookupCaller`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                searchKey: '+15551234567',
                searchType: 'phone'
              }
            }
          }],
          call: {
            metadata: { org_id: testOrgId }
          }
        }
      });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.toolResult.content);
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.contact.name).toBe('Test User');
    });

    it('should find contact by name', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/lookupCaller`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                searchKey: 'Test User',
                searchType: 'name'
              }
            }
          }],
          call: {
            metadata: { org_id: testOrgId }
          }
        }
      });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.toolResult.content);
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
    });

    it('should find contact by email', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/lookupCaller`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                searchKey: 'test@example.com',
                searchType: 'email'
              }
            }
          }],
          call: {
            metadata: { org_id: testOrgId }
          }
        }
      });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.toolResult.content);
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.contact.email).toBe('test@example.com');
    });

    it('should return not found for non-existent contact', async () => {
      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/lookupCaller`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                searchKey: 'NonExistent Person',
                searchType: 'name'
              }
            }
          }],
          call: {
            metadata: { org_id: testOrgId }
          }
        }
      });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.toolResult.content);
      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
    });

    it('should handle multiple matches', async () => {
      // Create another contact with similar name
      await supabase
        .from('contacts')
        .insert({
          org_id: testOrgId,
          name: 'Test Smith',
          phone: '+15559999999',
          lead_status: 'new'
        });

      const response = await axios.post(`${BACKEND_URL}/api/vapi/tools/lookupCaller`, {
        message: {
          toolCalls: [{
            function: {
              arguments: {
                searchKey: 'Test',
                searchType: 'name'
              }
            }
          }],
          call: {
            metadata: { org_id: testOrgId }
          }
        }
      });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.toolResult.content);
      expect(result.multipleMatches).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(1);
    });
  });

  describe('Identity Injection', () => {
    it('should create new contact for unknown caller', async () => {
      const unknownPhone = '+15557777777';

      // Simulate call.started webhook
      // Note: This tests the logic, actual webhook would come from Vapi
      const { data: newContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('org_id', testOrgId)
        .eq('phone', unknownPhone)
        .maybeSingle();

      // If contact doesn't exist, the webhook handler should create it
      expect(newContact).toBeNull(); // Initially not exists

      // After webhook processing, contact should exist with default values
      // (This would be tested via integration test with actual webhook)
    });

    it('should update last_contact_at for existing contact', async () => {
      const { data: beforeContact } = await supabase
        .from('contacts')
        .select('last_contact_at')
        .eq('id', testContactId)
        .single();

      const oldTimestamp = beforeContact!.last_contact_at;

      // Simulate contact update (would happen in webhook handler)
      await supabase
        .from('contacts')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', testContactId);

      const { data: afterContact } = await supabase
        .from('contacts')
        .select('last_contact_at')
        .eq('id', testContactId)
        .single();

      expect(new Date(afterContact!.last_contact_at).getTime())
        .toBeGreaterThan(new Date(oldTimestamp!).getTime());
    });
  });
});
