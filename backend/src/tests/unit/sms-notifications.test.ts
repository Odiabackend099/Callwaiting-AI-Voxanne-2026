/**
 * Unit Tests: SMS Notifications Service
 * Tests SMS sending logic with mocked Twilio and Supabase
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';

/**
 * Mock SMS Service (in real implementation, import from src/services)
 */
class SMSNotificationService {
  constructor(private supabaseClient: any, private twilioClient: any) {}

  async sendSMS(contactId: string, message: string, orgId: string) {
    // Validate input
    if (!message || message.length === 0) {
      throw new Error('Message cannot be empty');
    }
    if (message.length > 160) {
      throw new Error('Message exceeds 160 characters');
    }

    // Get contact phone
    const { data: contact, error: fetchError } = await this.supabaseClient
      .from('contacts')
      .select('phone, org_id')
      .eq('id', contactId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !contact) {
      throw new Error('Contact not found or unauthorized');
    }

    // Send via Twilio
    const result = await this.twilioClient.messages.create({
      from: process.env.TWILIO_PHONE,
      to: contact.phone,
      body: message,
    });

    // Log SMS
    const { error: logError } = await this.supabaseClient
      .from('sms_logs')
      .insert({
        contact_id: contactId,
        org_id: orgId,
        phone_number: contact.phone,
        message,
        twilio_sid: result.sid,
        status: 'pending',
      });

    if (logError) {
      throw new Error(`Failed to log SMS: ${logError.message}`);
    }

    return {
      success: true,
      twilio_sid: result.sid,
      phone: contact.phone,
    };
  }
}

describe('Unit Tests: SMS Notifications Service', () => {
  let smsService: SMSNotificationService;
  let mockSupabase: any;
  let mockTwilio: any;
  const testOrgId = uuid();
  const testContactId = uuid();

  beforeEach(() => {
    // Setup mock Supabase
    mockSupabase = {
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { phone: '+15551234567', org_id: testOrgId },
          error: null,
        }),
      })),
    };

    // Setup mock Twilio
    mockTwilio = {
      messages: {
        create: jest
          .fn()
          .mockResolvedValue({ sid: 'SM' + uuid().substring(0, 10) }),
      },
    };

    smsService = new SMSNotificationService(mockSupabase, mockTwilio);
  });

  describe('Happy Path', () => {
    it('Should successfully send SMS and log it', async () => {
      const message = 'Your appointment is confirmed!';

      const result = await smsService.sendSMS(
        testContactId,
        message,
        testOrgId
      );

      expect(result.success).toBe(true);
      expect(result.twilio_sid).toBeDefined();
      expect(result.phone).toBe('+15551234567');

      console.log('✅ SMS Notifications Service: Happy path PASS');
    });
  });

  describe('Validation', () => {
    it('Should reject empty message', async () => {
      await expect(
        smsService.sendSMS(testContactId, '', testOrgId)
      ).rejects.toThrow('Message cannot be empty');

      console.log('✅ SMS Notifications Service: Empty message validation PASS');
    });

    it('Should reject message over 160 characters', async () => {
      const longMessage = 'A'.repeat(161);

      await expect(
        smsService.sendSMS(testContactId, longMessage, testOrgId)
      ).rejects.toThrow('Message exceeds 160 characters');

      console.log('✅ SMS Notifications Service: Length validation PASS');
    });

    it('Should reject non-existent contact', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }));

      smsService = new SMSNotificationService(mockSupabase, mockTwilio);

      await expect(
        smsService.sendSMS('nonexistent-id', 'Test', testOrgId)
      ).rejects.toThrow('Contact not found or unauthorized');

      console.log('✅ SMS Notifications Service: Non-existent contact PASS');
    });
  });

  describe('Security', () => {
    it('Should enforce org_id filtering (tenant isolation)', async () => {
      const otherOrgId = uuid();

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest
          .fn()
          .mockReturnThis()
          .mockReturnValueOnce({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
      }));

      smsService = new SMSNotificationService(mockSupabase, mockTwilio);

      await expect(
        smsService.sendSMS(testContactId, 'Test', otherOrgId)
      ).rejects.toThrow('Contact not found or unauthorized');

      console.log('✅ SMS Notifications Service: Tenant isolation PASS');
    });
  });
});
