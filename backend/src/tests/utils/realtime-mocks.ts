/**
 * Realtime Subscription Mocks
 * Provides mocking for Supabase realtime subscriptions in tests
 */

import { jest } from '@jest/globals';

/**
 * Mock realtime subscription event
 */
export interface MockRealtimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new?: any;
  old?: any;
  eventType?: string;
}

/**
 * Mock realtime subscription
 */
export class MockRealtimeSubscription {
  private callbacks: Array<(event: MockRealtimeEvent) => void> = [];
  private unsubscribed = false;

  on(
    event: string,
    callback: (payload: { new?: any; old?: any }) => void
  ): MockRealtimeSubscription {
    this.callbacks.push((evt) => {
      callback({
        new: evt.new,
        old: evt.old,
      });
    });
    return this;
  }

  subscribe(
    callback?: (status: string) => void
  ): MockRealtimeSubscription {
    if (callback) {
      callback('SUBSCRIBED');
    }
    return this;
  }

  unsubscribe(): Promise<void> {
    this.unsubscribed = true;
    this.callbacks = [];
    return Promise.resolve();
  }

  /**
   * Emit an event to all subscribers (for testing)
   */
  emit(event: MockRealtimeEvent): void {
    if (this.unsubscribed) return;
    this.callbacks.forEach((cb) => cb(event));
  }

  isSubscribed(): boolean {
    return !this.unsubscribed && this.callbacks.length > 0;
  }
}

/**
 * Mock Supabase client with realtime support
 */
export class MockSupabaseRealtimeClient {
  private subscriptions: Map<string, MockRealtimeSubscription> = new Map();

  channel(name: string): MockRealtimeSubscription {
    if (!this.subscriptions.has(name)) {
      this.subscriptions.set(name, new MockRealtimeSubscription());
    }
    return this.subscriptions.get(name)!;
  }

  getChannel(name: string): MockRealtimeSubscription | undefined {
    return this.subscriptions.get(name);
  }

  /**
   * Emit event to all subscribed channels
   */
  emitToChannel(channelName: string, event: MockRealtimeEvent): void {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      subscription.emit(event);
    }
  }

  /**
   * Emit event to table channel pattern
   */
  emitToTable(
    table: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    newData?: any,
    oldData?: any
  ): void {
    const channelName = `public:${table}`;
    this.emitToChannel(channelName, {
      type: eventType,
      table,
      new: newData,
      old: oldData,
    });
  }

  getAllSubscriptions() {
    return Array.from(this.subscriptions.entries());
  }

  clearAllSubscriptions(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions.clear();
  }
}

/**
 * Realtime event simulator for testing workflows
 */
export class RealtimeEventSimulator {
  private realtimeClient: MockSupabaseRealtimeClient;
  private eventHistory: MockRealtimeEvent[] = [];

  constructor(realtimeClient: MockSupabaseRealtimeClient) {
    this.realtimeClient = realtimeClient;
  }

  /**
   * Simulate a contact update
   */
  simulateContactUpdate(contactId: string, newData: any, oldData?: any): void {
    this.recordEvent({
      type: 'UPDATE',
      table: 'contacts',
      new: { id: contactId, ...newData },
      old: oldData,
    });

    this.realtimeClient.emitToTable('contacts', 'UPDATE', newData, oldData);
  }

  /**
   * Simulate an appointment update
   */
  simulateAppointmentUpdate(
    appointmentId: string,
    newData: any,
    oldData?: any
  ): void {
    this.recordEvent({
      type: 'UPDATE',
      table: 'appointments',
      new: { id: appointmentId, ...newData },
      old: oldData,
    });

    this.realtimeClient.emitToTable('appointments', 'UPDATE', newData, oldData);
  }

  /**
   * Simulate an SMS log insertion
   */
  simulateSmsLogInsert(smsData: any): void {
    this.recordEvent({
      type: 'INSERT',
      table: 'sms_logs',
      new: smsData,
    });

    this.realtimeClient.emitToTable('sms_logs', 'INSERT', smsData);
  }

  /**
   * Simulate a booking audit log insertion
   */
  simulateBookingAuditInsert(auditData: any): void {
    this.recordEvent({
      type: 'INSERT',
      table: 'booking_audit_log',
      new: auditData,
    });

    this.realtimeClient.emitToTable('booking_audit_log', 'INSERT', auditData);
  }

  /**
   * Get all events that have been simulated
   */
  getEventHistory(): MockRealtimeEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events for a specific table
   */
  getEventsForTable(table: string): MockRealtimeEvent[] {
    return this.eventHistory.filter((e) => e.table === table);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  private recordEvent(event: MockRealtimeEvent): void {
    this.eventHistory.push({
      ...event,
      eventType: event.type,
    });
  }
}

/**
 * Create a waiting mechanism for realtime events in tests
 */
export async function waitForRealtimeEvent(
  subscription: MockRealtimeSubscription,
  timeout = 1000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for realtime event'));
    }, timeout);

    subscription.on('*', (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
}

/**
 * Create assertion helper for realtime events
 */
export function createRealtimeAssertion(
  simulator: RealtimeEventSimulator
) {
  return {
    expectEvent: (
      table: string,
      type: 'INSERT' | 'UPDATE' | 'DELETE',
      matcher?: (event: MockRealtimeEvent) => boolean
    ): boolean => {
      const events = simulator.getEventsForTable(table);
      return events.some((e) => {
        if (e.type !== type) return false;
        return matcher ? matcher(e) : true;
      });
    },

    expectEventCount: (table: string, count: number): boolean => {
      return simulator.getEventsForTable(table).length === count;
    },

    expectLastEvent: (
      table: string,
      matcher: (event: MockRealtimeEvent) => boolean
    ): boolean => {
      const events = simulator.getEventsForTable(table);
      return events.length > 0 && matcher(events[events.length - 1]);
    },

    getAllEvents: () => simulator.getEventHistory(),

    getTableEvents: (table: string) => simulator.getEventsForTable(table),
  };
}
