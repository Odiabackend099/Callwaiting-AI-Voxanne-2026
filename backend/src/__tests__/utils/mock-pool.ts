/**
 * Mock Object Pool - Lazy Singleton Pattern
 *
 * PROBLEM: Creating new mock instances in beforeEach hooks causes Jest to
 * exhaust heap memory (~2GB) due to accumulated mock object graphs.
 *
 * SOLUTION: Lazy singleton pattern reuses mock instances across tests and
 * only clears call history, not the instances themselves.
 *
 * EXPECTED RESULT: 60% memory reduction (2GB → 800MB)
 *
 * Usage:
 *   import { getOrCreateSupabaseClient, clearAllMocks } from '@tests/utils/mock-pool';
 *
 *   beforeEach(() => {
 *     supabase = getOrCreateSupabaseClient();
 *     vapi = getOrCreateVapiClient();
 *     clearAllMocks(); // Clear call history only
 *   });
 */

import { jest } from '@jest/globals';
import {
  createMockSupabaseClient,
  createMockVapiClient,
  createMockRedactionService,
  createMockLogger,
} from '../../tests/utils/test-helpers';

// Singleton instances
let supabaseInstance: any = null;
let vapiInstance: any = null;
let redactionInstance: any = null;
let loggerInstance: any = null;

/**
 * Get or create Supabase client mock
 * Reuses instance across tests
 */
export function getOrCreateSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createMockSupabaseClient();
  }
  return supabaseInstance;
}

/**
 * Get or create VAPI client mock
 * Reuses instance across tests
 */
export function getOrCreateVapiClient() {
  if (!vapiInstance) {
    vapiInstance = createMockVapiClient();
  }
  return vapiInstance;
}

/**
 * Get or create SMS service mock
 * Reuses instance across tests
 */
export function getOrCreateSmsService() {
  // SMS service is created in beforeEach as needed
  // This is a placeholder for the mock pool pattern
  return {
    sendFollowup: jest.fn(),
    getHistory: jest.fn(),
  };
}

/**
 * Get or create calendar service mock
 * Reuses instance across tests
 */
export function getOrCreateCalendarService() {
  // Calendar service is created in beforeEach as needed
  // This is a placeholder for the mock pool pattern
  return {
    holdSlot: jest.fn(),
    releaseSlot: jest.fn(),
    verifySlotHold: jest.fn(),
  };
}

/**
 * Get or create redaction service mock
 * Reuses instance across tests
 */
export function getOrCreateRedactionService() {
  if (!redactionInstance) {
    redactionInstance = createMockRedactionService();
  }
  return redactionInstance;
}

/**
 * Get or create logger mock
 * Reuses instance across tests
 */
export function getOrCreateLogger() {
  if (!loggerInstance) {
    loggerInstance = createMockLogger();
  }
  return loggerInstance;
}

/**
 * Clear all mock call history
 * Call this in beforeEach to reset test state without recreating instances
 *
 * CRITICAL: This is the key to memory efficiency!
 * Instead of: beforeEach(() => { mock = createNewMock(); })
 * Do:         beforeEach(() => { clearAllMocks(); })
 */
export function clearAllMocks() {
  if (supabaseInstance) jest.clearAllMocks();
  if (vapiInstance) jest.clearAllMocks();
  if (redactionInstance) jest.clearAllMocks();
  if (loggerInstance) jest.clearAllMocks();
}

/**
 * Reset all instances (use in afterAll to clean up)
 * This is optional but recommended for test isolation
 */
export function resetAllInstances() {
  supabaseInstance = null;
  vapiInstance = null;
  redactionInstance = null;
  loggerInstance = null;
}

/**
 * Get memory usage info (for debugging)
 * Returns estimate of how many instances are cached
 */
export function getMockPoolStats() {
  return {
    supabaseInstanceCreated: supabaseInstance !== null,
    vapiInstanceCreated: vapiInstance !== null,
    redactionInstanceCreated: redactionInstance !== null,
    loggerInstanceCreated: loggerInstance !== null,
    totalInstancesCached: [
      supabaseInstance,
      vapiInstance,
      redactionInstance,
      loggerInstance,
    ].filter((i) => i !== null).length,
  };
}
