/**
 * Phase 6 Test Fixtures: Shared Test Data & Helpers
 * 
 * Provides:
 * - Mock Vapi tool call payloads
 * - Appointment validation helpers
 * - Performance measurement utilities
 * - Assertion helpers
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Vapi Tool Call Payload Structure
 */
export interface VapiToolCall {
  tool: string;
  params: Record<string, unknown>;
}

/**
 * Appointment data structure
 */
export interface Appointment {
  id: string;
  org_id: string;
  clinic_id: string;
  provider_id: string;
  patient_name: string;
  patient_email: string;
  scheduled_at: string; // ISO timestamp
  duration_minutes: number;
  status: 'booked' | 'confirmed' | 'completed' | 'cancelled';
  google_calendar_event_id?: string;
  created_at: string;
}

/**
 * Generate mock Vapi tool call for book_appointment
 */
export function mockVapiBookingCall(overrides?: Partial<VapiToolCall>): VapiToolCall {
  const appointmentTime = new Date();
  appointmentTime.setHours(14, 0, 0, 0); // 2 PM today

  return {
    tool: 'book_appointment',
    params: {
      clinic_id: uuidv4(),
      provider_id: uuidv4(),
      patient_name: 'John Doe',
      patient_email: 'john.doe@example.com',
      appointment_time: appointmentTime.toISOString(),
      duration_minutes: 30,
      ...(overrides?.params || {}),
    },
    ...overrides,
  };
}

/**
 * Generate mock appointment object
 */
export function mockAppointment(overrides?: Partial<Appointment>): Appointment {
  const appointmentTime = new Date();
  appointmentTime.setHours(14, 0, 0, 0);

  return {
    id: uuidv4(),
    org_id: uuidv4(),
    clinic_id: uuidv4(),
    provider_id: uuidv4(),
    patient_name: 'Jane Smith',
    patient_email: 'jane.smith@example.com',
    scheduled_at: appointmentTime.toISOString(),
    duration_minutes: 30,
    status: 'booked',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Performance measurement helper
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): void {
    this.endTime = performance.now();
  }

  elapsed(): number {
    return this.endTime - this.startTime;
  }

  assertUnder(threshold: number, message?: string): void {
    const actual = this.elapsed();
    if (actual > threshold) {
      throw new Error(
        `⏱️ Performance check failed: ${actual.toFixed(2)}ms > ${threshold}ms ${
          message ? `(${message})` : ''
        }`
      );
    }
  }

  report(): string {
    return `${this.elapsed().toFixed(2)}ms`;
  }
}

/**
 * Validate appointment structure
 */
export function validateAppointmentStructure(appointment: unknown): asserts appointment is Appointment {
  if (!appointment || typeof appointment !== 'object') {
    throw new Error('Appointment must be an object');
  }

  const apt = appointment as Record<string, unknown>;

  const requiredFields = ['id', 'org_id', 'provider_id', 'patient_email', 'scheduled_at', 'status'];
  const missing = requiredFields.filter((field) => !apt[field]);

  if (missing.length > 0) {
    throw new Error(`Appointment missing required fields: ${missing.join(', ')}`);
  }

  if (typeof apt.scheduled_at !== 'string' || !isValidISO8601(apt.scheduled_at)) {
    throw new Error(`Appointment scheduled_at must be valid ISO 8601: ${apt.scheduled_at}`);
  }

  if (!['booked', 'confirmed', 'completed', 'cancelled'].includes(String(apt.status))) {
    throw new Error(`Appointment status must be one of: booked, confirmed, completed, cancelled`);
  }
}

/**
 * Check for appointment conflicts
 * Returns true if new appointment overlaps with existing
 */
export function hasConflict(newApt: Appointment, existing: Appointment[]): boolean {
  const newStart = new Date(newApt.scheduled_at);
  const newEnd = new Date(newStart.getTime() + newApt.duration_minutes * 60000);

  return existing.some((apt) => {
    // Only check confirmed appointments
    if (apt.status !== 'booked' && apt.status !== 'confirmed') return false;

    // Must be same provider
    if (apt.provider_id !== newApt.provider_id) return false;

    const existingStart = new Date(apt.scheduled_at);
    const existingEnd = new Date(existingStart.getTime() + apt.duration_minutes * 60000);

    // Check overlap: new starts before existing ends AND new ends after existing starts
    return newStart < existingEnd && newEnd > existingStart;
  });
}

/**
 * Assert clinic isolation
 * Throws error if appointment can be seen across clinics
 */
export function assertClinicIsolation(
  apt: Appointment,
  clinicId: string,
  otherClinicAppointments: Appointment[]
): void {
  if (apt.clinic_id !== clinicId) {
    throw new Error(
      `Clinic isolation violated: Clinic ${clinicId} can see appointment from clinic ${apt.clinic_id}`
    );
  }

  const crossOrgMatch = otherClinicAppointments.find((other) => other.id === apt.id);
  if (crossOrgMatch) {
    throw new Error(
      `Clinic isolation violated: Appointment ${apt.id} visible in multiple clinics`
    );
  }
}

/**
 * Assert org_id in JWT matches clinic org
 */
export function assertJWTOrgMatch(jwtOrgId: string, clinicOrgId: string): void {
  if (jwtOrgId !== clinicOrgId) {
    throw new Error(
      `JWT org_id mismatch: JWT has ${jwtOrgId}, clinic is ${clinicOrgId}`
    );
  }
}

/**
 * Mock Google Calendar sync response
 */
export function mockGoogleCalendarResponse(appointmentId: string): Record<string, unknown> {
  return {
    event_id: `google-event-${uuidv4()}`,
    appointment_id: appointmentId,
    synced_at: new Date().toISOString(),
    calendar_link: `https://calendar.google.com/calendar/u/0?cid=${uuidv4()}`,
  };
}

/**
 * Validate Google Calendar event was created
 */
export function validateGoogleCalendarSync(
  response: unknown,
  appointmentId: string
): asserts response is Record<string, unknown> {
  if (!response || typeof response !== 'object') {
    throw new Error('Google Calendar sync response must be an object');
  }

  const res = response as Record<string, unknown>;

  if (!res.event_id || typeof res.event_id !== 'string') {
    throw new Error('Google Calendar response missing event_id');
  }

  if (res.appointment_id !== appointmentId) {
    throw new Error(
      `Google Calendar appointment_id mismatch: ${res.appointment_id} !== ${appointmentId}`
    );
  }

  if (!res.synced_at || !isValidISO8601(String(res.synced_at))) {
    throw new Error('Google Calendar response missing valid synced_at timestamp');
  }
}

/**
 * Validate ISO 8601 timestamp
 */
function isValidISO8601(str: string): boolean {
  try {
    const date = new Date(str);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Mock error responses
 */
export const MockErrors = {
  CONFLICT: {
    status: 409,
    code: 'CONFLICT',
    message: 'Time slot is already booked',
  },
  UNAUTHORIZED: {
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'Missing or invalid authorization token',
  },
  FORBIDDEN: {
    status: 403,
    code: 'FORBIDDEN',
    message: 'You do not have permission to book appointments for this clinic',
  },
  NOT_FOUND: {
    status: 404,
    code: 'NOT_FOUND',
    message: 'Clinic or provider not found',
  },
  INVALID_REQUEST: {
    status: 400,
    code: 'INVALID_REQUEST',
    message: 'Invalid request parameters',
  },
};

/**
 * Helper to generate availability slots
 */
export function generateAvailableSlots(
  date: Date,
  startHour: number = 9,
  endHour: number = 17,
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = [];
  const current = new Date(date);
  current.setHours(startHour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);

  while (current < end) {
    slots.push(current.toISOString());
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }

  return slots;
}

/**
 * Helper to check if slot is available
 */
export function isSlotAvailable(
  slotTime: string,
  existingAppointments: Appointment[],
  duration: number = 30
): boolean {
  const slotStart = new Date(slotTime);
  const slotEnd = new Date(slotStart.getTime() + duration * 60000);

  return !existingAppointments.some((apt) => {
    const aptStart = new Date(apt.scheduled_at);
    const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
    return slotStart < aptEnd && slotEnd > aptStart;
  });
}
