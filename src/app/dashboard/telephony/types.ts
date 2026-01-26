/**
 * Frontend type definitions for Hybrid Telephony feature
 */

// ============================================
// API REQUEST TYPES
// ============================================

export interface VerifyCallerIdInitiateRequest {
  phoneNumber: string;
  friendlyName?: string;
}

export interface VerifyCallerIdConfirmRequest {
  verificationId?: string;
  phoneNumber?: string;
}

export interface CreateForwardingConfigRequest {
  verifiedCallerId: string;
  forwardingType: 'total_ai' | 'safety_net';
  carrier: 'att' | 'tmobile' | 'verizon' | 'sprint' | 'other_gsm' | 'other_cdma' | 'international';
  ringTimeSeconds?: number;
}

export interface ConfirmSetupRequest {
  configId: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface VerifyCallerIdInitiateResponse {
  success: boolean;
  verificationId: string;
  message: string;
  expiresAt: string;
  requestId: string;
}

export interface VerifiedNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  verifiedAt: string | null;
  hasForwardingConfig?: boolean;
  forwardingStatus?: string | null;
}

export interface VerifyCallerIdConfirmResponse {
  success: boolean;
  verifiedNumber: VerifiedNumber;
  requestId: string;
}

export interface GetVerifiedNumbersResponse {
  success: boolean;
  numbers: VerifiedNumber[];
  requestId: string;
}

export interface DeleteVerifiedNumberResponse {
  success: boolean;
  message: string;
  requestId: string;
}

export interface ForwardingConfig {
  id: string;
  forwardingType: string;
  carrier: string;
  twilioForwardingNumber: string;
  ringTimeSeconds: number;
  activationCode: string;
  deactivationCode: string;
  status: string;
}

export interface CreateForwardingConfigResponse {
  success: boolean;
  config: ForwardingConfig;
  requestId: string;
}

export interface ForwardingConfigRecord {
  id: string;
  sim_phone_number: string;
  forwarding_type: 'total_ai' | 'safety_net';
  carrier: string;
  twilio_forwarding_number: string;
  ring_time_seconds: number;
  generated_activation_code: string;
  generated_deactivation_code: string;
  status: 'pending_setup' | 'active' | 'inactive' | 'failed';
  user_confirmed_setup: boolean;
  confirmed_at: string | null;
  created_at: string;
  verified_caller_id: string;
}

export interface GetForwardingConfigResponse {
  success: boolean;
  configs: ForwardingConfigRecord[];
  requestId: string;
}

export interface ForwardingCodes {
  activation: string;
  deactivation: string;
  instructions: string[];
}

export interface GetForwardingCodeResponse {
  success: boolean;
  codes: ForwardingCodes;
  carrier: string;
  forwardingType: string;
  simPhoneNumber: string;
  twilioNumber: string;
  requestId: string;
}

export interface ConfirmSetupResponse {
  success: boolean;
  message: string;
  requestId: string;
}

export interface ErrorResponse {
  error: string;
  requestId: string;
  retryAfter?: number;
  attemptsRemaining?: number;
}
