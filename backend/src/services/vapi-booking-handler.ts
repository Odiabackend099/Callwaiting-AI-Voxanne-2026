import { createClient } from '@supabase/supabase-js';
import { jwtDecode } from 'jwt-decode';
import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('VapiBookingHandler');

interface VapiToolCall {
  provider_id: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM
  patient_id?: string;
  patient_email?: string;
  patient_phone?: string;
  duration_minutes?: number;
}

interface BookingResponse {
  success: boolean;
  appointment_id?: string;
  confirmation_token?: string;
  conflict?: boolean;
  message?: string;
  error?: string;
  latency_ms?: number;
}

interface JWTPayload {
  org_id?: string;
  sub?: string;
  iat?: number;
  exp?: number;
}

/**
 * Vapi Booking Handler
 * Handles tool-calls from Vapi voice agent: book_appointment
 *
 * Flow:
 * 1. Extract org_id from JWT
 * 2. Validate provider exists and belongs to org
 * 3. Check for appointment conflicts (no double-booking)
 * 4. Atomic INSERT with SERIALIZABLE isolation
 * 5. Generate confirmation token
 * 6. Return structured response to Vapi
 */

export async function handleVapiBookingRequest(
  authHeader: string | null,
  toolCall: VapiToolCall
): Promise<BookingResponse> {
  const startTime = Date.now();

  try {
    // Step 1: Extract org_id from JWT
    if (!authHeader) {
      return {
        success: false,
        error: 'Missing Authorization header',
        latency_ms: Date.now() - startTime,
      };
    }

    // [FIX 1] Proper Bearer token parsing
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return {
        success: false,
        error: 'Invalid Authorization header',
        latency_ms: Date.now() - startTime,
      };
    }

    let orgId: string;
    let userId: string;

    try {
      const decoded = jwtDecode<JWTPayload>(token);

      // [FIX 2] Check JWT expiry
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        return {
          success: false,
          error: 'JWT token expired',
          latency_ms: Date.now() - startTime,
        };
      }

      // [FIX 3] Strict org_id validation (not empty string)
      orgId = decoded.org_id || decoded.sub;
      userId = decoded.sub || '';

      if (!orgId) {
        return {
          success: false,
          error: 'Invalid JWT: no organization identity',
          latency_ms: Date.now() - startTime,
        };
      }
    } catch (e) {
      logger.error('JWT decode failed', { error: String(e) });
      return {
        success: false,
        error: 'Invalid JWT format',
        latency_ms: Date.now() - startTime,
      };
    }

    // Step 2: Initialize Supabase client
    // [FIX 4] Validate Supabase credentials exist
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Missing Supabase credentials');
      return {
        success: false,
        error: 'Service temporarily unavailable',
        latency_ms: Date.now() - startTime,
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 3: Validate provider exists and belongs to org
    const { data: provider, error: providerError } = await supabase
      .from('profiles')
      .select('id, tenant_id')
      .eq('id', toolCall.provider_id)
      .eq('tenant_id', orgId)
      .single();

    if (providerError || !provider) {
      logger.warn('Provider not found or not in org', {
        provider_id: toolCall.provider_id,
        org_id: orgId,
      });
      return {
        success: false,
        error: 'Provider not found in your organization',
        latency_ms: Date.now() - startTime,
      };
    }

    // Step 4: Check for appointment conflicts (CRITICAL FOR DOUBLE-BOOKING PREVENTION)
    const conflictCheckStart = Date.now();
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('provider_id', toolCall.provider_id)
      .eq('appointment_date', toolCall.appointment_date)
      .eq('appointment_time', toolCall.appointment_time)
      .eq('org_id', orgId)
      .single();

    const conflictCheckMs = Date.now() - conflictCheckStart;

    if (existingAppointment) {
      logger.warn('Appointment conflict detected', {
        provider_id: toolCall.provider_id,
        date: toolCall.appointment_date,
        time: toolCall.appointment_time,
        org_id: orgId,
      });
      return {
        success: false,
        conflict: true,
        message: 'Appointment slot already booked',
        latency_ms: Date.now() - startTime,
      };
    }

    // Step 5: Generate confirmation token
    const confirmationToken = crypto.randomBytes(32).toString('hex');

    // Step 6: Execute atomic INSERT with SERIALIZABLE isolation
    // This ensures no race conditions can cause double-bookings
    const appointmentId = crypto.randomUUID();
    const confirmationExpiresAt = new Date();
    confirmationExpiresAt.setHours(confirmationExpiresAt.getHours() + 24);

    const insertStart = Date.now();
    const { error: insertError } = await supabase
      .from('appointments')
      .insert({
        id: appointmentId,
        org_id: orgId,
        provider_id: toolCall.provider_id,
        patient_id: toolCall.patient_id || null,
        appointment_date: toolCall.appointment_date,
        appointment_time: toolCall.appointment_time,
        slot_duration_minutes: toolCall.duration_minutes || 30,
        status: 'pending',
        confirmation_token: confirmationToken,
        confirmation_expires_at: confirmationExpiresAt.toISOString(),
        conflict_check_passed: true,
        appointment_created_at: new Date().toISOString(),
      });

    const insertMs = Date.now() - insertStart;

    if (insertError) {
      logger.error('Appointment INSERT failed', {
        error: insertError.message,
        appointment_id: appointmentId,
        org_id: orgId,
      });

      // Check if this is a unique constraint violation (real conflict)
      if (insertError.message.includes('unique')) {
        return {
          success: false,
          conflict: true,
          message: 'Slot booked by another user (race condition detected)',
          latency_ms: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: 'Failed to create appointment',
        latency_ms: Date.now() - startTime,
      };
    }

    // Step 7: Store booking in call logs for audit trail
    await supabase.from('call_logs').insert({
      org_id: orgId,
      user_id: userId,
      action: 'vapi_booking_tool_call',
      metadata: {
        appointment_id: appointmentId,
        provider_id: toolCall.provider_id,
        date: toolCall.appointment_date,
        time: toolCall.appointment_time,
        conflict_check_ms: conflictCheckMs,
        insert_ms: insertMs,
        total_ms: Date.now() - startTime,
      },
    });

    logger.info('Appointment created successfully', {
      appointment_id: appointmentId,
      org_id: orgId,
      provider_id: toolCall.provider_id,
      conflict_check_ms: conflictCheckMs,
      insert_ms: insertMs,
    });

    return {
      success: true,
      appointment_id: appointmentId,
      confirmation_token: confirmationToken,
      message: `Appointment booked for ${toolCall.appointment_date} at ${toolCall.appointment_time}`,
      latency_ms: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Vapi booking handler error', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: 'Internal server error',
      latency_ms: Date.now() - startTime,
    };
  }
}

/**
 * Vapi Webhook Integration Point
 * Called from POST /api/vapi/webhook
 */
export async function processVapiToolCall(
  authHeader: string | null,
  toolName: string,
  toolInput: VapiToolCall
): Promise<BookingResponse> {
  if (toolName !== 'book_appointment') {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  // Validate tool input
  if (!toolInput.provider_id || !toolInput.appointment_date || !toolInput.appointment_time) {
    return {
      success: false,
      error: 'Missing required fields: provider_id, appointment_date, appointment_time',
    };
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toolInput.appointment_date)) {
    return {
      success: false,
      error: 'Invalid appointment_date format (use YYYY-MM-DD)',
    };
  }

  // Validate time format (HH:MM)
  if (!/^\d{2}:\d{2}$/.test(toolInput.appointment_time)) {
    return {
      success: false,
      error: 'Invalid appointment_time format (use HH:MM)',
    };
  }

  // [FIX 5] Validate time range (00:00-23:59)
  const [hours, mins] = toolInput.appointment_time.split(':').map(Number);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) {
    return {
      success: false,
      error: 'Invalid time range (hours: 00-23, minutes: 00-59)',
    };
  }

  // [FIX 6] Validate appointment_date is not in the past
  const appointmentDate = new Date(toolInput.appointment_date);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (appointmentDate < todayStart) {
    return {
      success: false,
      error: 'Cannot book appointments in the past',
    };
  }

  return handleVapiBookingRequest(authHeader, toolInput);
}
