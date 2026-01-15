/**
 * Test Database Utilities
 * Provides database seeding, cleanup, and query helpers for integration and E2E tests
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

export class TestDatabase {
  private client: ReturnType<typeof createClient>;
  private createdRecords: Map<string, string[]> = new Map(); // table -> ids for cleanup

  constructor() {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a test organization
   */
  async createOrg(overrides?: Partial<any>): Promise<string> {
    const orgId = uuid();
    const org = {
      id: orgId,
      name: `Test Org ${Date.now()}`,
      status: 'active',
      plan: 'premium',
      timezone: 'America/New_York',
      ...overrides,
    };

    const { data, error } = await this.client
      .from('organizations')
      .insert(org)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create org: ${error.message}`);
    this.trackRecord('organizations', orgId);
    return orgId;
  }

  /**
   * Create a test contact
   */
  async createContact(
    orgId: string,
    overrides?: Partial<any>
  ): Promise<string> {
    const contactId = uuid();
    const contact = {
      id: contactId,
      org_id: orgId,
      name: `Test Contact ${Date.now()}`,
      phone: `+1555${Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(7, '0')}`,
      email: `contact-${uuid()}@test.local`,
      lead_status: 'new',
      lead_score: 'warm',
      service_interests: ['facelift', 'rhinoplasty'],
      last_contact_at: null,
      booking_source: null,
      booking_completed_at: null,
      ...overrides,
    };

    const { data, error } = await this.client
      .from('contacts')
      .insert(contact)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create contact: ${error.message}`);
    this.trackRecord('contacts', contactId);
    return contactId;
  }

  /**
   * Create a test appointment
   */
  async createAppointment(
    orgId: string,
    contactId: string,
    overrides?: Partial<any>
  ): Promise<string> {
    const appointmentId = uuid();
    const scheduledAt = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const appointment = {
      id: appointmentId,
      org_id: orgId,
      contact_id: contactId,
      service_type: 'facelift',
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      status: 'pending',
      confirmation_sent: false,
      confirmation_sms_sent: false,
      confirmation_sms_id: null,
      otp_verified: false,
      hold_id: null,
      notes: 'Test appointment',
      ...overrides,
    };

    const { data, error } = await this.client
      .from('appointments')
      .insert(appointment)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create appointment: ${error.message}`);
    this.trackRecord('appointments', appointmentId);
    return appointmentId;
  }

  /**
   * Create a test appointment hold (for atomic booking)
   */
  async createAppointmentHold(
    orgId: string,
    overrides?: Partial<any>
  ): Promise<string> {
    const holdId = uuid();
    const expiresAt = new Date(Date.now() + 900000).toISOString(); // 15 minutes from now
    const hold = {
      id: holdId,
      org_id: orgId,
      calendar_id: 'cal_mock_123',
      slot_time: new Date(Date.now() + 86400000).toISOString(),
      call_sid: `call_${uuid()}`,
      patient_name: `Patient ${Date.now()}`,
      patient_phone: `+1555${Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(7, '0')}`,
      status: 'held',
      otp_code: null,
      otp_attempts: 0,
      otp_sent_at: null,
      expires_at: expiresAt,
      appointment_id: null,
      ...overrides,
    };

    const { data, error } = await this.client
      .from('appointment_holds')
      .insert(hold)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create hold: ${error.message}`);
    this.trackRecord('appointment_holds', holdId);
    return holdId;
  }

  /**
   * Get a contact by ID
   */
  async getContact(contactId: string): Promise<any> {
    const { data, error } = await this.client
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error) throw new Error(`Failed to get contact: ${error.message}`);
    return data;
  }

  /**
   * Get an appointment by ID
   */
  async getAppointment(appointmentId: string): Promise<any> {
    const { data, error } = await this.client
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (error) throw new Error(`Failed to get appointment: ${error.message}`);
    return data;
  }

  /**
   * Get an appointment hold by ID
   */
  async getAppointmentHold(holdId: string): Promise<any> {
    const { data, error } = await this.client
      .from('appointment_holds')
      .select('*')
      .eq('id', holdId)
      .single();

    if (error) throw new Error(`Failed to get hold: ${error.message}`);
    return data;
  }

  /**
   * Get SMS logs for a contact
   */
  async getSmsLogs(contactId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('sms_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get SMS logs: ${error.message}`);
    return data || [];
  }

  /**
   * Get booking audit logs for an appointment
   */
  async getBookingAuditLogs(appointmentId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('booking_audit_log')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get audit logs: ${error.message}`);
    return data || [];
  }

  /**
   * Track a created record for cleanup
   */
  private trackRecord(table: string, id: string): void {
    if (!this.createdRecords.has(table)) {
      this.createdRecords.set(table, []);
    }
    this.createdRecords.get(table)!.push(id);
  }

  /**
   * Clean up all created records
   */
  async cleanup(): Promise<void> {
    // Delete in reverse order of creation to respect foreign keys
    const deleteOrder = [
      'sms_confirmation_logs',
      'booking_audit_log',
      'sms_logs',
      'appointments',
      'appointment_holds',
      'contacts',
      'organizations',
    ];

    for (const table of deleteOrder) {
      const ids = this.createdRecords.get(table);
      if (!ids || ids.length === 0) continue;

      for (const id of ids) {
        const { error } = await this.client
          .from(table)
          .delete()
          .eq('id', id);

        if (error) {
          console.warn(`Failed to delete ${table}/${id}: ${error.message}`);
        }
      }
    }

    this.createdRecords.clear();
  }
}

/**
 * Create a new test database instance
 */
export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}
