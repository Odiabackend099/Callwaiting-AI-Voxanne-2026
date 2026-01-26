/**
 * Type definitions for Hybrid Telephony feature
 */

import type { Twilio } from 'twilio';

// ============================================
// TWILIO TYPES
// ============================================

export type TwilioClient = ReturnType<typeof Twilio>;

export interface TwilioOutgoingCallerId {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  dateCreated: Date;
  dateUpdated: Date;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface AuthenticatedRequest {
  user?: {
    id: string;
    orgId: string;
  };
  requestId?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiErrorResponse {
  error: string;
  requestId: string;
  retryAfter?: number;
  attemptsRemaining?: number;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  requestId: string;
  data?: T;
}

// ============================================
// RATE LIMITING TYPES
// ============================================

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================
// ERROR HANDLING TYPES
// ============================================

export interface TelephonyError extends Error {
  attemptsRemaining?: number;
  retryAfter?: number;
  statusCode?: number;
}

export function isTelephonyError(error: unknown): error is TelephonyError {
  return error instanceof Error;
}

export function createTelephonyError(
  message: string,
  options?: { attemptsRemaining?: number; retryAfter?: number; statusCode?: number }
): TelephonyError {
  const error = new Error(message) as TelephonyError;
  if (options?.attemptsRemaining !== undefined) {
    error.attemptsRemaining = options.attemptsRemaining;
  }
  if (options?.retryAfter !== undefined) {
    error.retryAfter = options.retryAfter;
  }
  if (options?.statusCode !== undefined) {
    error.statusCode = options.statusCode;
  }
  return error;
}

// ============================================
// DATABASE TYPES
// ============================================

export interface VerifiedCallerIdRecord {
  id: string;
  org_id: string;
  phone_number: string;
  friendly_name: string | null;
  twilio_call_sid: string | null;
  twilio_caller_id_sid: string | null;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  verification_code_hash: string | null;
  verification_code_expires_at: string | null;
  verification_attempts: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HybridForwardingConfigRecord {
  id: string;
  org_id: string;
  verified_caller_id: string;
  sim_phone_number: string;
  forwarding_type: 'total_ai' | 'safety_net';
  carrier: 'att' | 'tmobile' | 'verizon' | 'sprint' | 'other_gsm' | 'other_cdma' | 'international';
  twilio_forwarding_number: string;
  ring_time_seconds: number;
  generated_activation_code: string;
  generated_deactivation_code: string;
  status: 'pending_setup' | 'active' | 'inactive' | 'failed';
  user_confirmed_setup: boolean;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}
