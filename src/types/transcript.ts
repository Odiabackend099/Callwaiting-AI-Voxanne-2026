/**
 * Transcript Type Definitions
 * Ensures consistent speaker naming across all layers:
 * - Vapi: 'agent' | 'user'
 * - Database: 'agent' | 'customer'
 * - Frontend: 'agent' | 'user'
 * - WebSocket: 'agent' | 'customer'
 */

export type VapiSpeaker = 'agent' | 'user';
export type DbSpeaker = 'agent' | 'customer';
export type FrontendSpeaker = 'agent' | 'user';

export interface TranscriptEvent {
  type: 'transcript';
  speaker: DbSpeaker;
  text: string;
  is_final: boolean;
  confidence: number;
  vapiCallId: string;
  trackingId: string;
  userId?: string;
  ts: number;
}

export interface TranscriptMessage {
  id: string;
  speaker: FrontendSpeaker;
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

/**
 * Convert speaker from database format to frontend format
 */
export function mapDbSpeakerToFrontend(dbSpeaker: DbSpeaker): FrontendSpeaker {
  return dbSpeaker === 'customer' ? 'user' : 'agent';
}

/**
 * Convert speaker from frontend format to database format
 */
export function mapFrontendSpeakerToDb(frontendSpeaker: FrontendSpeaker): DbSpeaker {
  return frontendSpeaker === 'user' ? 'customer' : 'agent';
}
