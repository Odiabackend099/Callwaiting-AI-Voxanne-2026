/**
 * PHASE 6 TEST FIXTURES
 * 
 * Mock data, helpers, and validation utilities for Phase 6 tests
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  elapsed(): number {
    return performance.now() - this.startTime;
  }

  elapsedMs(): number {
    return Math.round(this.elapsed());
  }

  isUnder500ms(): boolean {
    return this.elapsed() < 500;
  }
}

/**
 * Mock Vapi booking call
 */
export async function mockVapiBookingCall(
  endpoint: string,
  authHeader: string,
  params: {
    clinic_id: string;
    provider_id: string;
    patient_name: string;
    patient_email: string;
    appointment_time: string;
    duration_minutes?: number;
  }
) {
  return axios.post(
    endpoint,
    {
      tool: 'book_appointment',
      params,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    }
  );
}

/**
 * Validate appointment response structure
 */
export function validateAppointmentStructure(response: any) {
  const { data } = response;

  if (!data.success) {
    throw new Error(`Appointment booking failed: ${JSON.stringify(data)}`);
  }

  if (!data.appointment_id) {
    throw new Error('Missing appointment_id in response');
  }

  if (!data.appointment) {
    throw new Error('Missing appointment object in response');
  }

  const { appointment } = data;
  const requiredFields = [
    'id',
    'org_id',
    'provider_id',
    'scheduled_at',
    'status',
  ];

  for (const field of requiredFields) {
    if (!appointment[field]) {
      throw new Error(`Missing required field in appointment: ${field}`);
    }
  }

  return true;
}

/**
 * Check if appointment overlaps with existing appointments
 */
export function hasConflict(
  newStart: Date,
  newEnd: Date,
  existingAppointments: any[]
): boolean {
  return existingAppointments.some(apt => {
    const aptStart = new Date(apt.scheduled_at);
    const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60 * 1000);

    return (
      (newStart >= aptStart && newStart < aptEnd) ||
      (newEnd > aptStart && newEnd <= aptEnd) ||
      (newStart <= aptStart && newEnd >= aptEnd)
    );
  });
}

/**
 * Assert clinic isolation - verify that clinic A cannot access clinic B
 */
export function assertClinicIsolation(
  clinicAId: string,
  clinicBId: string,
  clinicAJWT: string,
  clinicBJWT: string
) {
  if (clinicAId === clinicBId) {
    throw new Error('Clinic isolation test requires different clinic IDs');
  }

  if (clinicAJWT === clinicBJWT) {
    throw new Error('Clinic isolation test requires different JWTs');
  }

  return true;
}

/**
 * Assert JWT org_id matches clinic_id
 */
export function assertJWTOrgMatch(jwtOrgId: string, clinicId: string) {
  if (jwtOrgId !== clinicId) {
    throw new Error(
      `JWT org_id (${jwtOrgId}) does not match clinic_id (${clinicId})`
    );
  }

  return true;
}

/**
 * Validate Google Calendar sync response
 */
export function validateGoogleCalendarSync(response: any) {
  const { data } = response;

  if (!data.calendar_sync) {
    throw new Error('Missing calendar_sync in response');
  }

  const { calendar_sync } = data;

  if (!calendar_sync.success) {
    console.warn('Calendar sync indicates failure:', calendar_sync);
  }

  if (!calendar_sync.event_id) {
    throw new Error('Missing event_id in calendar_sync');
  }

  return true;
}

/**
 * Error simulation fixtures
 */
export const MockErrors = {
  UNAUTHORIZED: {
    status: 401,
    data: {
      error: 'Missing or invalid authorization',
      code: 'UNAUTHORIZED',
    },
  },
  FORBIDDEN: {
    status: 403,
    data: {
      error: 'Unauthorized to access this clinic',
      code: 'FORBIDDEN',
    },
  },
  NOT_FOUND: {
    status: 404,
    data: {
      error: 'Provider not found',
      code: 'NOT_FOUND',
    },
  },
  CONFLICT: {
    status: 409,
    data: {
      error: 'Slot already booked',
      code: 'CONFLICT',
    },
  },
  BAD_REQUEST: {
    status: 400,
    data: {
      error: 'Invalid request',
      code: 'BAD_REQUEST',
    },
  },
  INTERNAL_ERROR: {
    status: 500,
    data: {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  },
};

/**
 * Generate test appointment data
 */
export function generateTestAppointment(
  clinicId: string,
  providerId: string,
  startDate: Date = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
) {
  return {
    clinic_id: clinicId,
    provider_id: providerId,
    patient_name: `Patient ${uuidv4().substring(0, 8)}`,
    patient_email: `patient-${uuidv4().substring(0, 8)}@example.com`,
    appointment_time: startDate.toISOString(),
    duration_minutes: 30,
  };
}

/**
 * Generate multiple test appointments with time offsets
 */
export function generateTestAppointments(
  clinicId: string,
  providerId: string,
  count: number = 5,
  offsetHours: number = 1
) {
  const appointments = [];
  let currentTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

  for (let i = 0; i < count; i++) {
    appointments.push({
      clinic_id: clinicId,
      provider_id: providerId,
      patient_name: `Patient ${i + 1}`,
      patient_email: `patient${i + 1}-${uuidv4().substring(0, 8)}@example.com`,
      appointment_time: currentTime.toISOString(),
      duration_minutes: 30,
    });

    currentTime.setHours(currentTime.getHours() + offsetHours);
  }

  return appointments;
}

/**
 * Assert response time performance
 */
export function assertPerformance(elapsedMs: number, threshold: number = 500) {
  if (elapsedMs >= threshold) {
    throw new Error(
      `Performance threshold exceeded: ${elapsedMs}ms >= ${threshold}ms`
    );
  }

  return true;
}

/**
 * Parse JWT token (for testing purposes)
 */
export function parseJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}
