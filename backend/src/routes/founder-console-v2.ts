/**
 * Founder Console API Routes
 * Handles agent configuration, leads, and call management for the Voice AI Founder Console
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import twilio from 'twilio';
import { supabase } from '../services/supabase-client';
import { VapiClient } from '../services/vapi-client';
import { storeApiKey, getApiKey } from '../services/secrets-manager';
import { buildOutboundSystemPrompt, getDefaultPromptConfig, buildCallContextBlock, buildTierSpecificPrompt } from '../prompts/outbound-agent-template';
import { CallOutcome, CallStatus, isActiveCall } from '../types/call-outcome';
import { createLogger } from '../services/logger';
import { wsBroadcast } from '../services/websocket';
import { requireAuth, requireAuthOrDev } from '../middleware/auth';
import { agentConfigLimiter, callCreationLimiter } from '../middleware/rate-limit';
import { validateRequest } from '../middleware/validation';
import { agentBehaviorSchema, agentConfigSchema, agentTestCallSchema, createCallSchema } from '../schemas/founder-console';
import { getIntegrationSettings } from './founder-console-settings';
import { withTimeout } from '../utils/timeout-helper';
import { validateE164Format } from '../utils/phone-validation';
import { phoneNumbersRouter } from './phone-numbers';
import { createWebVoiceSession, endWebVoiceSession } from '../services/web-voice-bridge';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer');
import {
  validateCsv,
  importCsvLeads,
  getImportStatus,
  getImportErrors,
  listImports,
  generateErrorCsv
} from '../services/csv-import-service';

// Generate a unique request ID using crypto
function generateRequestId(): string {
  return crypto.randomUUID();
}

// Sanitize names to prevent template injection
function sanitizeName(name: string): string {
  return (name || '')
    .replace(/[<>"'`]/g, '') // Remove special characters that could break templates
    .substring(0, 50)         // Limit length to prevent overflow
    .trim();
}

// Single source of truth for voice configuration
const VOICE_REGISTRY = [
  // Vapi Standard Voices (Case Sensitive IDs)
  { id: 'Rohan', name: 'Rohan', gender: 'male', provider: 'vapi', description: 'Indian American, Bright, Optimistic' },
  { id: 'Neha', name: 'Neha', gender: 'female', provider: 'vapi', description: 'Indian American, Professional, Charming' },
  { id: 'Hana', name: 'Hana', gender: 'female', provider: 'vapi', description: 'American, Soft, Soothing' },
  { id: 'Harry', name: 'Harry', gender: 'male', provider: 'vapi', description: 'American, Clear, Energetic' },
  { id: 'Elliot', name: 'Elliot', gender: 'male', provider: 'vapi', description: 'Canadian, Soothing, Friendly' },
  { id: 'Lily', name: 'Lily', gender: 'female', provider: 'vapi', description: 'Asian American, Bubbly, Cheerful' },
  { id: 'Paige', name: 'Paige', gender: 'female', provider: 'vapi', description: 'American, Deeper, Calming', default: true },
  { id: 'Cole', name: 'Cole', gender: 'male', provider: 'vapi', description: 'American, Deeper, Calming' },
  { id: 'Savannah', name: 'Savannah', gender: 'female', provider: 'vapi', description: 'American (Southern)' },
  { id: 'Spencer', name: 'Spencer', gender: 'female', provider: 'vapi', description: 'American, Energetic, Quippy' },
  { id: 'Kylie', name: 'Kylie', gender: 'female', provider: 'vapi', description: 'American, New/Beta' },

  // Legacy/Other Provider Voices
  { id: 'jennifer', name: 'Jennifer (PlayHT)', gender: 'female', provider: 'playht' },
  { id: 'alloy', name: 'Alloy (OpenAI)', gender: 'neutral', provider: 'openai' },

  // Deepgram Aura (Fallback support)
  { id: 'aura-asteria-en', name: 'Asteria', gender: 'female', provider: 'deepgram' },
  { id: 'aura-luna-en', name: 'Luna', gender: 'female', provider: 'deepgram' },
] as const;

const DEFAULT_VOICE = 'Paige';

/**
 * Maps a voice ID to its provider (case-insensitive lookup)
 * @param voiceId - Voice identifier
 * @returns Provider name ('vapi', 'playht', 'openai', 'deepgram')
 */
function getVoiceProvider(voiceId: string): string {
  const voice = VOICE_REGISTRY.find(v => v.id.toLowerCase() === (voiceId || '').toLowerCase());
  return voice?.provider || 'vapi';
}

/**
 * Returns list of available voices
 */
function getAvailableVoices() {
  return VOICE_REGISTRY;
}

/**
 * Validates if a voice ID exists in the registry
 */
function isValidVoiceId(voiceId: string): boolean {
  return VOICE_REGISTRY.some(v => v.id.toLowerCase() === (voiceId || '').toLowerCase());
}

/**
 * Validates if a language code is supported
 */
function isValidLanguage(language: string): boolean {
  const supportedLanguages = [
    'en-GB', 'en-US', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'it-IT',
    'pt-BR', 'pt-PT', 'nl-NL', 'pl-PL', 'ru-RU', 'ja-JP',
    'zh-CN', 'zh-TW', 'ko-KR', 'ar-SA', 'hi-IN'
  ];
  return supportedLanguages.includes(language);
}

/**
 * Helper: Get organization and Vapi configuration
 * Eliminates code duplication across routes
 * Returns null if any validation fails (response already sent)
 */
async function getOrgAndVapiConfig(
  req: Request,
  res: Response,
  requestId: string
): Promise<{ orgId: string; vapiApiKey: string; vapiIntegration: any } | null> {
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  if (!org?.id) {
    res.status(500).json({ error: 'Internal server error', requestId });
    return null;
  }

  const { data: vapiIntegration } = await supabase
    .from('integrations')
    .select('config')
    .eq('provider', INTEGRATION_PROVIDERS.VAPI)
    .eq('org_id', org.id)
    .maybeSingle();

  const vapiApiKey: string | undefined =
    vapiIntegration?.config?.vapi_api_key || vapiIntegration?.config?.vapi_secret_key;

  if (!vapiApiKey) {
    res.status(400).json({ error: 'Vapi connection not configured', requestId });
    return null;
  }

  logger.info('Vapi key resolved for request', {
    requestId,
    orgId: org.id,
    source: vapiIntegration?.config?.vapi_api_key
      ? 'integrations.config.vapi_api_key'
      : 'integrations.config.vapi_secret_key',
    keyLast4: vapiApiKey.slice(-4)
  });

  return { orgId: org.id, vapiApiKey, vapiIntegration };
}

// ========== TYPE DEFINITIONS ==========

// Constants for magic strings
const AGENT_ROLES = {
  OUTBOUND: 'outbound',
  INBOUND: 'inbound'
} as const;

const INTEGRATION_PROVIDERS = {
  VAPI: 'vapi',
  TWILIO: 'twilio'
} as const;

// Vapi API defaults
const VAPI_DEFAULTS = {
  MODEL_PROVIDER: 'openai',
  MODEL_NAME: 'gpt-4',
  TRANSCRIBER_PROVIDER: 'deepgram',
  TRANSCRIBER_MODEL: 'nova-2',
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_MAX_DURATION: 600,
  DEFAULT_FIRST_MESSAGE: 'Hello! This is CallWaiting AI calling.'
} as const;

// Retry configuration for network resilience (Nigeria/2G)
const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 250,
  BACKOFF_MULTIPLIER: 2
} as const;

// Interface definitions for type safety
interface VapiConfig {
  vapi_public_key?: string;
  vapi_api_key?: string;
  vapi_secret_key?: string;
  vapi_phone_number_id?: string;
}

interface TwilioConfig {
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
}

interface AgentUpdateData {
  voice?: string;
  system_prompt?: string;
  language?: string;
  first_message?: string;
  max_call_duration?: number;
}

interface VapiRequestBody {
  publicKey?: string;
  secretKey?: string;
  phoneNumberId?: string;
  voice?: string;
  systemPrompt?: string;
  language?: string;
  firstMessage?: string;
  maxCallDuration?: number;
}

interface TwilioRequestBody {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

/** Organization data from database */
interface Organization {
  id: string;
  name?: string;
}

/** Vapi integration configuration */
interface VapiIntegrationConfig {
  vapi_api_key?: string;
  vapi_secret_key?: string;
  vapi_public_key?: string;
  vapi_phone_number_id?: string;
}

/** Twilio integration configuration */
interface TwilioIntegrationConfig {
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_from_number?: string;
}

/** Agent data from database */
interface Agent {
  id: string;
  name: string;
  role: string;
  org_id: string;
  status: string;
  system_prompt?: string;
  voice?: string;
  language?: string;
  max_call_duration?: number;
  first_message?: string;
  vapi_assistant_id?: string | null;
  prompt_synced_at?: Date | string | null;
  prompt_syncing_at?: Date | string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

/** Lead data from database */
interface Lead {
  id: string;
  name?: string;
  contact_name?: string;
  clinic_name?: string;
  company_name?: string;
  city?: string;
  phone?: string;
  email?: string;
  status?: string;
  notes?: string;
  personalization_data?: {
    pain_point_identified?: string;
  };
}

// Extended request type with user and org context
// Extended request type is now defined globally in middleware/auth.ts
// No need for local interface - use Express.Request directly

const logger = createLogger('founder-console');

const router = Router();

// PUBLIC ENDPOINT - CSV template download (no auth required)
router.get('/leads/csv/template', (req: Request, res: Response): void => {
  const template = `phone,name,company_name,email,country,city,notes,source
+2348012345678,John Doe,Acme Clinic,john@acme.com,Nigeria,Lagos,Interested in demo,google_maps
+2348098765432,Jane Smith,Best Health,jane@besthealth.ng,Nigeria,Abuja,Follow up next week,referral
+14155551234,Bob Wilson,US Medical,bob@usmedical.com,USA,San Francisco,Enterprise client,linkedin`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lead-import-template.csv"');
  res.send(template);
});

/**
 * GET /api/founder-console/voices
 * Public: returns list of available voices for agent configuration.
 */
router.get('/voices', async (req: Request, res: Response): Promise<void> => {
  try {
    const voices = getAvailableVoices().map(v => ({
      id: v.id,
      label: `${v.name}${(v as any).description ? ` – ${(v as any).description}` : ''}`,
      provider: v.provider,
      gender: v.gender
    }));

    res.json({
      provider: 'vapi',
      voices,
      default: DEFAULT_VOICE
    });
  } catch (error: any) {
    logger.exception('Failed to fetch voices', error);
    res.status(500).json({ error: error.message });
  }
});

// Protect all founder-console routes with authentication (Supabase JWT)
// ALWAYS require auth - user must be signed in to access founder console
router.use(requireAuthOrDev);

// Rate limiting - prevent abuse of expensive Vapi calls
const callRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // Max 20 calls per minute per user/IP
  message: { error: 'Too many call attempts. Please wait before starting more calls.' },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  skip: (req) => !req.path.includes('/calls/start') && !req.path.includes('/test-call')
});

// Stricter rate limiting for sensitive config endpoints
const configRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Max 10 config changes per minute
  message: { error: 'Too many configuration changes. Please wait before trying again.' },
  standardHeaders: true,
  skip: (req) => req.method === 'GET' // Only apply to mutations
});



router.use(callRateLimiter);
router.use('/agent/config', configRateLimiter);
router.use('/recordings', configRateLimiter);

// Mount phone numbers router under /phone-numbers
// This makes it available at /api/founder-console/phone-numbers
// And inherits the auth and org middleware
router.use('/phone-numbers', phoneNumbersRouter);

// Helper to mask sensitive keys
function maskKey(key: string | undefined | null): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

// Helper to mask phone numbers for logging (PII protection)
function maskPhone(phone: string | undefined | null): string {
  if (!phone) return '[no phone]';
  if (phone.length <= 6) return '***';
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2);
}

// Nuclear API key sanitization - single source of truth
function sanitizeVapiKey(rawKey: string | undefined | null): string {
  if (!rawKey) {
    throw new Error('Vapi secret key is required');
  }

  const sanitized = String(rawKey)
    .trim()
    .replace(/^['"]+|['"]+$/g, '')        // Strip surrounding quotes
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ''); // Strip control characters

  if (!sanitized) {
    throw new Error('Vapi secret key is empty after sanitization');
  }

  return sanitized;
}

// Standardized error response helper
function errorResponse(res: Response, status: number, error: string, details?: { hint?: string; action?: string }): void {
  res.status(status).json({
    error,
    ...(details?.hint && { hint: details.hint }),
    ...(details?.action && { action: details.action })
  });
}

// Validate and sanitize pagination parameters
function getPaginationParams(query: any): { limit: number; offset: number } {
  const rawLimit = parseInt(query.limit as string);
  const rawOffset = parseInt(query.offset as string);
  return {
    limit: Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200)),
    offset: Math.max(0, isNaN(rawOffset) ? 0 : rawOffset)
  };
}

// Helper to check if a value is masked (supports both Unicode bullets and asterisks)
function isMasked(value: string | undefined | null): boolean {
  if (!value) return false;
  // Check for both Unicode bullets (••••) and asterisks (****)
  return value.includes('••••') || value.includes('****');
}

// ========== MIDDLEWARE ==========

/**
 * Request ID middleware - adds unique ID for distributed tracing
 */
router.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  res.setHeader('x-request-id', req.requestId!);
  next();
});

/**
 * Organization middleware - fetches org once per request
 * Caches result on req.org to avoid repeated DB queries
 */
async function loadOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Skip if already loaded
    if (req.org) {
      next();
      return;
    }

    const orgId = req.user?.orgId;
    if (orgId) {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();

      if (error || !org) {
        logger.warn('Organization not found', { requestId: req.requestId, error: error?.message });
        req.org = undefined;
      } else {
        req.org = org as Organization;
      }

      next();
      return;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
      .single();

    if (error || !org) {
      logger.warn('Organization not found', { requestId: req.requestId, error: error?.message });
      // Don't fail - some endpoints may not require org
      req.org = undefined;
    } else {
      req.org = org as Organization;
    }

    next();
  } catch (err) {
    logger.error('Failed to load organization', { requestId: req.requestId, error: (err as Error).message });
    next();
  }
}

// Apply org middleware to all routes
router.use(loadOrganization);

// ========== HELPER FUNCTIONS ==========

/**
 * Retry helper with exponential backoff for network resilience
 * Critical for unstable networks (Nigeria/2G/3G)
 * 
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum retry attempts
 * @returns Result of successful function call
 * @throws Last error if all retries fail
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = RETRY_CONFIG.MAX_ATTEMPTS
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts - 1) {
        const delayMs = RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt);
        logger.debug('Retrying after error', {
          attempt: attempt + 1,
          maxAttempts,
          delayMs,
          error: lastError.message
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError!;
}

/**
 * Idempotent Vapi Assistant Sync Helper (PRODUCTION-READY)
 * 
 * Ensures Vapi assistant exists and matches DB config. This function is safe
 * to call multiple times with the same agentId - it will either update the
 * existing assistant or create a new one.
 * 
 * Features:
 * - Idempotent (safe to retry)
 * - Automatic retries with exponential backoff
 * - Race condition protection
 * - Stale assistant ID validation
 * - Comprehensive error messages
 * 
 * @param agentId - Agent ID to sync
 * @param vapiApiKey - Vapi API key to use
 * @returns Assistant ID (existing or newly created)
 * @throws {Error} If agent not found or Vapi API fails after retries
 */
async function ensureAssistantSynced(agentId: string, vapiApiKey: string, importedPhoneNumberId?: string): Promise<string> {
  const startTime = Date.now();

  // 1. Get agent from DB (source of truth) - SELECT ONLY NEEDED COLUMNS
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, system_prompt, voice, language, first_message, max_call_duration, vapi_assistant_id')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(
      `Agent sync failed: Agent ${agentId} not found. ` +
      `DB Error: ${agentError?.message || 'none'}`
    );
  }

  // 2. Build config from DB state (using constants)
  // Set server.url to webhook endpoint for programmatic event delivery
  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:3000'}/api/webhooks/vapi`;

  const resolvedSystemPrompt = agent.system_prompt || buildOutboundSystemPrompt(getDefaultPromptConfig());
  const resolvedVoiceId = agent.voice || DEFAULT_VOICE;
  const resolvedVoiceProvider = getVoiceProvider(resolvedVoiceId);
  const resolvedLanguage = agent.language || VAPI_DEFAULTS.DEFAULT_LANGUAGE;
  const resolvedFirstMessage = agent.first_message || VAPI_DEFAULTS.DEFAULT_FIRST_MESSAGE;
  const resolvedMaxDurationSeconds = agent.max_call_duration || VAPI_DEFAULTS.DEFAULT_MAX_DURATION;

  // DEBUG: Log voice resolution for troubleshooting
  logger.info('Voice resolution for agent sync', {
    agentId,
    agentRole: agent.name,
    dbVoiceId: agent.voice,
    resolvedVoiceId,
    resolvedVoiceProvider,
    isValidVoice: isValidVoiceId(resolvedVoiceId),
    language: resolvedLanguage
  });

  // NOTE: Vapi expects assistant payload shape with model/voice/transcriber.
  // Using non-standard keys like systemPrompt/voiceId/serverUrl can cause 400 Bad Request.
  const assistantCreatePayload = {
    name: agent.name || 'CallWaiting AI Outbound',
    model: {
      provider: VAPI_DEFAULTS.MODEL_PROVIDER,
      model: VAPI_DEFAULTS.MODEL_NAME,
      messages: [{ role: 'system', content: resolvedSystemPrompt }]
    },
    voice: {
      provider: resolvedVoiceProvider,
      voiceId: resolvedVoiceId
    },
    transcriber: {
      provider: VAPI_DEFAULTS.TRANSCRIBER_PROVIDER,
      model: VAPI_DEFAULTS.TRANSCRIBER_MODEL,
      language: resolvedLanguage
    },
    firstMessage: resolvedFirstMessage,
    maxDurationSeconds: resolvedMaxDurationSeconds,
    serverUrl: webhookUrl,
    serverMessages: ['function-call', 'hang', 'status-update', 'end-of-call-report', 'transcript']
  };

  // 3. Initialize Vapi client with error handling
  let vapiClient: VapiClient;
  try {
    vapiClient = new VapiClient(vapiApiKey);
  } catch (error) {
    throw new Error(`Invalid Vapi API key: ${(error as Error).message}`);
  }

  // 4. If assistant exists, validate and UPDATE it (idempotent)
  if (agent.vapi_assistant_id) {
    try {
      // Validate assistant still exists in Vapi
      await withRetry(() => vapiClient.getAssistant(agent.vapi_assistant_id!));

      // Update with retry
      await withRetry(() => vapiClient.updateAssistant(agent.vapi_assistant_id!, {
        name: assistantCreatePayload.name,
        model: assistantCreatePayload.model,
        voice: assistantCreatePayload.voice,
        transcriber: assistantCreatePayload.transcriber,
        firstMessage: assistantCreatePayload.firstMessage,
        maxDurationSeconds: assistantCreatePayload.maxDurationSeconds,
        serverUrl: assistantCreatePayload.serverUrl,
        serverMessages: assistantCreatePayload.serverMessages
      }));

      const duration = Date.now() - startTime;
      logger.info('Vapi assistant synced (updated)', {
        assistantId: agent.vapi_assistant_id,
        voice: resolvedVoiceId,
        language: resolvedLanguage,
        duration,
        operation: 'update'
      });

      return agent.vapi_assistant_id;
    } catch (updateError: unknown) {
      const error = updateError as Error;
      logger.warn('Failed to update assistant, will create new one', {
        error: error.message,
        assistantId: agent.vapi_assistant_id,
        reason: 'Assistant may be deleted or API key changed'
      });

      // Clear invalid assistant ID
      await supabase
        .from('agents')
        .update({ vapi_assistant_id: null })
        .eq('id', agentId);

      // Fall through to create new assistant
    }
  }

  // 5. CREATE new assistant with retry
  let assistant;
  try {
    assistant = await withRetry(() => vapiClient.createAssistant(assistantCreatePayload as any));
  } catch (createErr: any) {
    const status: number | undefined = createErr?.response?.status;
    const details = createErr?.response?.data?.message || createErr?.response?.data || createErr?.message;
    throw new Error(
      `Vapi assistant creation failed${status ? ` (status ${status})` : ''}: ` +
      `${typeof details === 'string' ? details : JSON.stringify(details)}`
    );
  }

  // 6. Save assistant ID to DB with race condition protection
  const { data: updated } = await supabase
    .from('agents')
    .update({ vapi_assistant_id: assistant.id })
    .eq('id', agentId)
    .eq('vapi_assistant_id', null) // Only update if still null
    .select('vapi_assistant_id')
    .single();

  // If another request already created an assistant, use that one
  if (!updated) {
    logger.warn('Race condition detected, using existing assistant', {
      newAssistantId: assistant.id,
      agentId
    });

    const { data: existing } = await supabase
      .from('agents')
      .select('vapi_assistant_id')
      .eq('id', agentId)
      .single();

    // If existing is still null, use the newly created one (other request also failed)
    if (existing?.vapi_assistant_id) {
      return existing.vapi_assistant_id;
    }

    // Fallback: use the newly created assistant and try to save it
    logger.warn('Existing assistant also null, using newly created one', {
      assistantId: assistant.id,
      agentId
    });

    // Try one more time to save the newly created assistant
    const { data: finalUpdate } = await supabase
      .from('agents')
      .update({ vapi_assistant_id: assistant.id })
      .eq('id', agentId)
      .eq('vapi_assistant_id', null)
      .select('vapi_assistant_id')
      .single();

    return finalUpdate?.vapi_assistant_id || assistant.id;
  }

  const duration = Date.now() - startTime;
  logger.info('Vapi assistant synced (created)', {
    assistantId: assistant.id,
    voice: resolvedVoiceId,
    language: resolvedLanguage,
    duration,
    operation: 'create'
  });

  return assistant.id;
}

// ========== AUTH DEBUG / CURRENT USER ==========

/**
 * GET /api/founder-console/me
 * Returns the authenticated user and org info from the JWT
 */
router.get('/me', (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    id: req.user.id,
    email: req.user.email,
    orgId: req.user.orgId
  });
});

// ========== AGENT CONFIG ==========

/**
 * GET /api/founder-console/agent/config
 * Returns the global agent configuration for the founder console
 */
router.get('/agent/config', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Parallel fetch for performance (P1 fix: avoid sequential queries on 2G/3G)
    const [vapiResult, twilioResult, agentResult] = await Promise.all([
      // Get Vapi integration config (P0 fix: add org_id filter)
      supabase
        .from('integrations')
        .select('config')
        .eq('provider', INTEGRATION_PROVIDERS.VAPI)
        .eq('org_id', orgId)
        .limit(1)
        .single(),
      // Get Twilio integration config (P0 fix: add org_id filter, use constant)
      supabase
        .from('integrations')
        .select('config')
        .eq('provider', INTEGRATION_PROVIDERS.TWILIO)
        .eq('org_id', orgId)
        .limit(1)
        .single(),
      // Get the outbound agent (select only needed columns for performance)
      supabase
        .from('agents')
        .select('id, system_prompt, voice, language, max_call_duration, first_message, vapi_assistant_id')
        .eq('role', AGENT_ROLES.OUTBOUND)
        .eq('org_id', orgId)
        .limit(1)
        .single()
    ]);

    const vapiIntegration = vapiResult.data;
    const twilioIntegration = twilioResult.data;
    const agent = agentResult.data;

    // Build response with masked keys
    const vapiConfig = vapiIntegration?.config || {};
    const twilioConfig = twilioIntegration?.config || {};

    res.json({
      vapi: {
        publicKey: maskKey(vapiConfig.vapi_public_key),
        secretKey: maskKey(vapiConfig.vapi_api_key || vapiConfig.vapi_secret_key),
        systemPrompt: agent?.system_prompt || buildOutboundSystemPrompt(getDefaultPromptConfig()),
        voice: agent?.voice || 'paige',
        language: agent?.language || 'en-GB',
        maxCallDuration: agent?.max_call_duration || 600,

        firstMessage: agent?.first_message || 'Hello! This is CallWaiting AI calling...',
        phoneNumberId: vapiConfig.vapi_phone_number_id || '' // Phone ID is not a secret, don't mask it
      },
      twilio: {
        accountSid: maskKey(twilioConfig.twilio_account_sid),
        authToken: maskKey(twilioConfig.twilio_auth_token),
        fromNumber: twilioConfig.twilio_from_number || ''
      },
      agentId: agent?.id || null,
      vapiAssistantId: agent?.vapi_assistant_id || null
    });
  } catch (error: any) {
    logger.exception('Failed to get agent config', error);
    res.status(500).json({ error: error.message });
  }
});

// NOTE: Duplicate POST /agent/config handler removed - see line 1081 for the proper implementation
// with validation middleware (agentConfigLimiter, validateRequest)


/**
 * Helper to parse structured RPC errors
 * Error prefixes: VALIDATION_FAILED, AGENT_NOT_FOUND, INTEGRATION_UPSERT_FAILED
 */
function parseRpcError(errorMessage: string): { code: string; message: string } {
  const prefixes = ['VALIDATION_FAILED', 'AGENT_NOT_FOUND', 'INTEGRATION_UPSERT_FAILED'];
  for (const prefix of prefixes) {
    if (errorMessage.startsWith(`${prefix}:`)) {
      return {
        code: prefix,
        message: errorMessage.substring(prefix.length + 1).trim()
      };
    }
  }
  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

/**
 * Syncs agent's system prompt to Vapi in the background with retry logic.
 * 
 * This function:
 * - Checks if sync is needed (idempotency: only syncs if >24h since last sync)
 * - Prevents concurrent syncs using prompt_syncing_at flag
 * - Validates prompt output before sending
 * - Retries with exponential backoff on transient failures
 * - Differentiates error types (auth vs rate limit vs server error)
 * - Never throws (non-blocking operation)
 * 
 * @param vapiClient - Vapi API client
 * @param agent - Agent with vapi_assistant_id and prompt_synced_at
 * @param orgId - Organization ID for logging
 * @throws {never} This function never throws; errors are logged and ignored
 */
async function syncAssistantPromptInBackground(
  vapiClient: VapiClient,
  agent: Agent,
  orgId: string
): Promise<void> {
  // Validate inputs
  if (!agent?.id || !orgId?.trim()) {
    logger.warn('Invalid agent or org for prompt sync', { agentId: agent?.id, orgId });
    return;
  }

  // Validate assistant ID exists and is non-null
  if (!agent.vapi_assistant_id) {
    logger.debug('No assistant ID to sync', { agentId: agent.id, orgId });
    return;
  }

  // Check if sync is already in progress (prevent concurrent syncs)
  const SYNC_TIMEOUT_MS = 5000; // 5 second timeout for concurrent sync check
  if (agent.prompt_syncing_at) {
    try {
      const syncStartTime = new Date(agent.prompt_syncing_at).getTime();
      const timeSinceSyncStart = Date.now() - syncStartTime;

      if (timeSinceSyncStart < SYNC_TIMEOUT_MS) {
        logger.debug('Sync already in progress, skipping concurrent sync', {
          agentId: agent.id,
          orgId,
          syncStartedAt: agent.prompt_syncing_at,
          timeSinceSyncStart
        });
        return;
      }
    } catch (parseError: any) {
      logger.warn('Failed to parse prompt_syncing_at', {
        agentId: agent.id,
        orgId,
        error: parseError.message
      });
    }
  }

  // Idempotency check: only sync if >24h since last sync
  const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  if (agent.prompt_synced_at) {
    try {
      // Safely parse prompt_synced_at (could be Date or ISO string from Supabase)
      const lastSyncTime = new Date(agent.prompt_synced_at).getTime();
      if (isNaN(lastSyncTime)) {
        logger.warn('Invalid prompt_synced_at timestamp', {
          agentId: agent.id,
          orgId,
          value: agent.prompt_synced_at
        });
      } else {
        const timeSinceLastSync = Date.now() - lastSyncTime;
        if (timeSinceLastSync < SYNC_INTERVAL_MS) {
          logger.debug('Assistant prompt recently synced, skipping', {
            assistantId: agent.vapi_assistant_id,
            agentId: agent.id,
            orgId,
            lastSyncedAt: agent.prompt_synced_at,
            nextSyncAt: new Date(lastSyncTime + SYNC_INTERVAL_MS).toISOString()
          });
          return;
        }
      }
    } catch (parseError: any) {
      logger.warn('Failed to parse prompt_synced_at', {
        agentId: agent.id,
        orgId,
        error: parseError.message
      });
      // Continue with sync if parsing fails
    }
  }

  // Retry configuration
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [250, 500, 1000];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Build and validate prompt
      const promptConfig = getDefaultPromptConfig();
      const systemPrompt = buildOutboundSystemPrompt(promptConfig);

      // Validate prompt output (warn if short, but still retry)
      if (!systemPrompt) {
        logger.error('Empty system prompt generated', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId
        });
        return; // Don't retry if completely empty
      }

      if (systemPrompt.length < 100) {
        logger.warn('System prompt is unusually short', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId,
          promptLength: systemPrompt.length,
          attempt: attempt + 1
        });
        // Continue - still try to sync short prompts
      }

      // Update assistant's system prompt with new {{variable}} syntax
      await vapiClient.updateAssistant(agent.vapi_assistant_id, {
        model: {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ]
        }
      });

      // Update prompt_synced_at in database (with separate error handling)
      try {
        const { error: updateError } = await supabase
          .from('agents')
          .update({ prompt_synced_at: new Date().toISOString() })
          .eq('id', agent.id)
          .eq('org_id', orgId);

        if (updateError) {
          logger.error('Failed to update prompt_synced_at in database', {
            agentId: agent.id,
            orgId,
            error: updateError.message
          });
          // Vapi sync succeeded but DB update failed - log but don't retry
          return;
        }
      } catch (dbError: any) {
        logger.error('Database update exception during prompt sync', {
          agentId: agent.id,
          orgId,
          error: dbError.message
        });
        // Vapi sync succeeded but DB update failed - log but don't retry
        return;
      }

      logger.info('Assistant prompt synced to Vapi and database', {
        assistantId: agent.vapi_assistant_id,
        agentId: agent.id,
        orgId,
        attempt: attempt + 1
      });
      return; // Success
    } catch (syncError: any) {
      const status = syncError.response?.status;
      const isRetryable = status >= 500 || status === 429;
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      // Differentiate error types
      if (status === 401) {
        logger.error('Vapi auth failed - check API key (non-blocking)', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId
        });
        return; // Don't retry auth errors
      } else if (status === 404) {
        logger.error('Assistant not found in Vapi (non-blocking)', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId
        });
        return; // Don't retry 404
      } else if (status === 429) {
        logger.warn('Vapi rate limited, will retry next call (non-blocking)', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES
        });
      } else if (status >= 500) {
        logger.warn('Vapi server error, retrying (non-blocking)', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId,
          status,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES
        });
      } else {
        logger.warn('Failed to sync prompt (non-blocking)', {
          agentId: agent.id,
          assistantId: agent.vapi_assistant_id,
          orgId,
          status,
          message: syncError.message,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES
        });
      }

      // Retry on transient failures
      if (isRetryable && !isLastAttempt) {
        await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]));
        continue;
      }

      return; // Don't throw - this is non-blocking
    }
  }
}

/**
 * POST /api/founder-console/agent/config
 * Save agent configuration from founder console
 * Uses atomic RPC transaction for agents + integrations
 * Rate limited to 10 requests per minute
 */
router.post(
  '/agent/config',
  agentConfigLimiter,
  validateRequest(agentConfigSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { vapi, twilio: twilioBody, testing } = req.body;

      const requestId = req.requestId || generateRequestId();

      const steps: {
        stored: boolean;
        vapiValidated: boolean;
        twilioValidated: boolean;
        phoneNumberImported: boolean;
        assistantSynced: boolean;
      } = {
        stored: false,
        vapiValidated: false,
        twilioValidated: false,
        phoneNumberImported: false,
        assistantSynced: false
      };

      logger.info('Agent config request received', {
        requestId,
        hasVapiPublicKey: Boolean(vapi?.publicKey),
        hasVapiSecretKey: Boolean(vapi?.secretKey),
        hasTwilioSid: Boolean(twilioBody?.accountSid),
        hasTwilioToken: Boolean(twilioBody?.authToken),
        twilioFromNumber: maskPhone(twilioBody?.fromNumber),
        hasTestDestination: Boolean(testing?.testDestinationNumber)
      });

      // Get the first/default organization
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1)
        .single();

      if (!org) {
        logger.error('No organization found in database');
        res.status(500).json({
          error: 'No organization found. Please create an organization first.'
        });
        return;
      }

      const orgId = org.id;

      // Track whether Vapi secret key changed (controls assistant reset)
      const { data: existingVapiRowBeforeSave } = await supabase
        .from('integrations')
        .select('config')
        .eq('provider', INTEGRATION_PROVIDERS.VAPI)
        .eq('org_id', orgId)
        .maybeSingle();

      const existingVapiSecretKey: string | undefined =
        existingVapiRowBeforeSave?.config?.vapi_api_key || existingVapiRowBeforeSave?.config?.vapi_secret_key;
      const vapiSecretKeyChanged = Boolean(existingVapiSecretKey && vapi?.secretKey && existingVapiSecretKey !== vapi.secretKey);

      // ===== Enforce "6 inputs only" contract + validate phone formats =====
      if (!vapi?.publicKey || !vapi?.secretKey || !twilioBody?.accountSid || !twilioBody?.authToken || !twilioBody?.fromNumber) {
        res.status(400).json({
          error: 'Missing required configuration fields',
          requestId
        });
        return;
      }

      if (!validateE164Format(twilioBody.fromNumber)) {
        res.status(400).json({ error: 'Twilio Phone Number must be E.164 format (e.g. +234...)', requestId });
        return;
      }

      if (testing?.testDestinationNumber && !validateE164Format(testing.testDestinationNumber)) {
        res.status(400).json({ error: 'Test Destination Number must be E.164 format (e.g. +234...)', requestId });
        return;
      }

      // Helper: merge JSON config into integrations row
      const mergeIntegrationConfig = async (
        provider: string,
        patch: Record<string, any>
      ): Promise<void> => {
        const { data: row } = await supabase
          .from('integrations')
          .select('config')
          .eq('provider', provider)
          .eq('org_id', orgId)
          .maybeSingle();

        const merged = {
          ...(row?.config || {}),
          ...patch
        };

        // Upsert so this never no-ops if the row is missing
        await supabase
          .from('integrations')
          .upsert(
            {
              org_id: orgId,
              provider,
              config: merged,
              connected: true,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'org_id,provider' }
          );
      };

      // ========== VALIDATION PHASE ==========
      // For 6-input setup we set defaults server-side; user does not provide voice/prompt/etc.
      // We validate credentials after storing them.

      // ========== GET OR CREATE AGENT ==========
      let agentId: string | null = null;
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('role', AGENT_ROLES.OUTBOUND)
        .eq('org_id', orgId)
        .single();

      if (existingAgent) {
        agentId = existingAgent.id;
      } else if (vapi) {
        // Create agent first if it doesn't exist (RPC expects agent to exist)
        const { data: newAgent, error: insertError } = await supabase
          .from('agents')
          .insert({
            role: AGENT_ROLES.OUTBOUND,
            name: 'CallWaiting AI Outbound',
            status: 'active',
            org_id: orgId
          })
          .select('id')
          .single();

        if (insertError || !newAgent) {
          logger.error('Failed to create agent', insertError);
          res.status(500).json({ error: 'Failed to create agent' });
          return;
        }
        agentId = newAgent.id;
        logger.info('Agent created', { agentId });
      }

      // ========== ATOMIC UPDATE VIA RPC ==========
      // Build RPC parameters (only include non-masked, changed values)
      const rpcParams: Record<string, any> = {
        p_org_id: orgId,
        p_agent_id: agentId
      };

      // Agent fields
      if (vapi?.voice) rpcParams.p_agent_voice = vapi.voice;
      if (vapi?.language) rpcParams.p_agent_language = vapi.language;
      if (vapi?.systemPrompt !== undefined) rpcParams.p_agent_system_prompt = vapi.systemPrompt;
      if (vapi?.firstMessage !== undefined) rpcParams.p_agent_first_message = vapi.firstMessage;
      if (vapi?.maxCallDuration !== undefined) rpcParams.p_agent_max_call_duration = vapi.maxCallDuration;

      // Vapi integration fields
      if (vapi?.publicKey && !isMasked(vapi.publicKey)) rpcParams.p_vapi_public_key = vapi.publicKey;
      if (vapi?.secretKey && !isMasked(vapi.secretKey)) rpcParams.p_vapi_secret_key = vapi.secretKey;
      // Phone number ID is NOT a secret; always allow it to be updated from the UI.
      if (vapi?.phoneNumberId) rpcParams.p_vapi_phone_number_id = vapi.phoneNumberId;

      // Twilio integration fields
      rpcParams.p_twilio_account_sid = twilioBody.accountSid;
      rpcParams.p_twilio_auth_token = twilioBody.authToken;
      rpcParams.p_twilio_from_number = twilioBody.fromNumber;

      // Mark Vapi validation as pending until checks pass
      rpcParams.p_vapi_validation_status = 'pending';

      // Execute atomic update
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'update_agent_and_integrations',
        rpcParams
      );

      if (rpcError) {
        const parsed = parseRpcError(rpcError.message);
        logger.error('Atomic config update failed', {
          code: parsed.code,
          message: parsed.message,
          orgId,
          agentId
        });

        // Return appropriate HTTP status based on error type
        if (parsed.code === 'AGENT_NOT_FOUND') {
          res.status(404).json({ error: 'Agent not found', details: parsed.message });
          return;
        }
        if (parsed.code === 'VALIDATION_FAILED') {
          res.status(400).json({ error: 'Validation failed', details: parsed.message });
          return;
        }
        res.status(500).json({ error: 'Failed to save configuration', details: parsed.message });
        return;
      }

      logger.info('Atomic config update succeeded', {
        result: rpcResult,
        orgId,
        agentId
      });

      steps.stored = true;

      // Persist test destination (non-secret) for later re-tests
      if (testing?.testDestinationNumber) {
        await mergeIntegrationConfig(INTEGRATION_PROVIDERS.VAPI, {
          test_destination_number: testing.testDestinationNumber
        });
      }

      // ===== Step 2: Validate Vapi credentials =====
      try {
        // Use nuclear sanitization before creating client
        const sanitizedVapiKey = sanitizeVapiKey(vapi.secretKey);
        const testClient = new VapiClient(sanitizedVapiKey);
        await testClient.listAssistants();
        await mergeIntegrationConfig(INTEGRATION_PROVIDERS.VAPI, {
          validation_status: 'ok',
          validated_at: new Date().toISOString(),
          last_error: null
        });
        steps.vapiValidated = true;
      } catch (err: any) {
        await mergeIntegrationConfig(INTEGRATION_PROVIDERS.VAPI, {
          validation_status: 'error',
          validated_at: null,
          last_error: err?.message || 'Vapi validation failed'
        });
        res.status(400).json({
          error: 'Vapi key invalid',
          details: err?.message,
          steps,
          requestId
        });
        return;
      }

      // ===== Step 2b: Validate Twilio credentials =====
      try {
        const twilioClient = twilio(twilioBody.accountSid, twilioBody.authToken);
        await twilioClient.api.accounts(twilioBody.accountSid).fetch();
        await mergeIntegrationConfig(INTEGRATION_PROVIDERS.TWILIO, {
          validation_status: 'ok',
          validated_at: new Date().toISOString(),
          last_error: null
        });
        steps.twilioValidated = true;
      } catch (err: any) {
        await mergeIntegrationConfig(INTEGRATION_PROVIDERS.TWILIO, {
          validation_status: 'error',
          last_error: err?.message || 'Twilio validation failed'
        });
        res.status(400).json({
          error: 'Twilio credentials invalid',
          details: err?.message,
          steps,
          requestId
        });
        return;
      }

      // ========== VAPI SYNC PHASE (post-commit) ==========
      // For 6-input setup, the secretKey is required and is the API key for Vapi.
      const vapiApiKey = vapi.secretKey;

      // Only reset assistant if secret key truly changed.
      // Otherwise update in-place to avoid creating duplicate assistants.
      if (agentId && vapiSecretKeyChanged) {
        await supabase
          .from('agents')
          .update({ vapi_assistant_id: null })
          .eq('id', agentId);
      }

      // ========== PROGRAMMATIC TWILIO IMPORT INTO VAPI ==========
      let phoneNumberId: string | undefined;
      try {
        const { data: vapiRow } = await supabase
          .from('integrations')
          .select('config')
          .eq('provider', INTEGRATION_PROVIDERS.VAPI)
          .eq('org_id', orgId)
          .maybeSingle();

        phoneNumberId = vapiRow?.config?.vapi_phone_number_id || vapiRow?.config?.vapi_phone_numberId;
      } catch {
        phoneNumberId = undefined;
      }

      if (!phoneNumberId) {
        try {
          logger.info('Importing Twilio number into Vapi', {
            requestId,
            orgId,
            twilioNumber: maskPhone(twilioBody.fromNumber)
          });

          const vapiClient = new VapiClient(vapiApiKey);
          const importedNumber = await vapiClient.importTwilioNumber({
            phoneNumber: twilioBody.fromNumber,
            twilioAccountSid: twilioBody.accountSid,
            twilioAuthToken: twilioBody.authToken,
            name: `${org?.name || 'Organization'} Outbound Number`
          });

          if (!importedNumber?.id) {
            throw new Error('Vapi did not return a phoneNumberId');
          }

          phoneNumberId = importedNumber.id;
          await mergeIntegrationConfig(INTEGRATION_PROVIDERS.VAPI, {
            vapi_phone_number_id: importedNumber.id,
            last_error: null
          });

          steps.phoneNumberImported = true;
        } catch (err: any) {
          await mergeIntegrationConfig(INTEGRATION_PROVIDERS.VAPI, {
            last_error: err?.message || 'Failed to import Twilio number into Vapi'
          });
          res.status(400).json({
            error: 'Failed to import Twilio number into Vapi',
            details: err?.message,
            steps,
            requestId
          });
          return;
        }
      } else {
        steps.phoneNumberImported = true;
      }

      // Sync agent config to Vapi (idempotent)
      let assistantId: string | undefined;
      if (agentId) {
        try {
          assistantId = await ensureAssistantSynced(agentId, vapiApiKey);
          steps.assistantSynced = true;
        } catch (err: any) {
          res.status(400).json({
            error: 'Failed to sync assistant to Vapi',
            details: err?.message,
            steps,
            requestId
          });
          return;
        }
      }

      res.status(200).json({
        ready: Boolean(steps.vapiValidated && steps.twilioValidated && steps.phoneNumberImported && steps.assistantSynced),
        steps,
        orgId,
        agentId,
        assistantId,
        phoneNumberId,
        requestId
      });
    } catch (error: any) {
      logger.exception('Failed to save agent config', error);
      res.status(500).json({ error: error.message });
    }
  });

/**
 * POST /api/founder-console/agent/behavior
 * Save agent behavior fields independently for inbound and outbound agents.
 * Accepts separate configs for inbound and outbound agents.
 * Only updates fields that are provided (undefined fields are skipped).
 * Syncs to Vapi for both assistants concurrently.
 */
router.post(
  '/agent/behavior',
  requireAuthOrDev,
  configRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.requestId || generateRequestId();
    const user = req.user;

    // SECURITY: Do NOT log full req.body as it contains system prompts
    logger.info('POST /agent/behavior received', {
      requestId,
      userId: user?.id,
      orgId: user?.orgId
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized', requestId });
      return;
    }

    try {
      const orgId: string = user.orgId;
      const { inbound, outbound } = req.body;

      logger.info('Parsed request - independent agent configs', {
        requestId,
        hasInbound: Boolean(inbound),
        hasOutbound: Boolean(outbound),
        inboundFields: inbound ? Object.keys(inbound).join(',') : 'none',
        outboundFields: outbound ? Object.keys(outbound).join(',') : 'none'
      });

      // Validate at least one agent config is provided
      if (!inbound && !outbound) {
        res.status(400).json({ error: 'No agent configuration provided', requestId });
        return;
      }

      // Helper function to validate and build update payload
      const buildUpdatePayload = (config: any, agentRole: string): Record<string, any> | null => {
        if (!config) return null;

        const payload: Record<string, any> = {};

        // Validate and add fields only if provided
        if (config.systemPrompt !== undefined && config.systemPrompt !== null) {
          payload.system_prompt = config.systemPrompt;
        }
        if (config.firstMessage !== undefined && config.firstMessage !== null) {
          payload.first_message = config.firstMessage;
        }
        if (config.voiceId !== undefined && config.voiceId !== null) {
          if (!isValidVoiceId(config.voiceId)) {
            throw new Error(`Invalid voice selection for ${agentRole} agent`);
          }
          payload.voice = config.voiceId;
        }
        if (config.language !== undefined && config.language !== null) {
          if (!isValidLanguage(config.language)) {
            throw new Error(`Invalid language selection for ${agentRole} agent`);
          }
          payload.language = config.language;
        }
        if (config.maxDurationSeconds !== undefined && config.maxDurationSeconds !== null) {
          if (typeof config.maxDurationSeconds !== 'number' || config.maxDurationSeconds < 60) {
            throw new Error(`Max duration must be at least 60 seconds for ${agentRole} agent`);
          }
          payload.max_call_duration = config.maxDurationSeconds;
        }

        return Object.keys(payload).length > 0 ? payload : null;
      };

      // Build payloads for each agent
      const inboundPayload = buildUpdatePayload(inbound, 'inbound');
      const outboundPayload = buildUpdatePayload(outbound, 'outbound');

      // Fetch org and vapi integration
      const [{ data: org, error: orgError }, { data: vapiIntegration }] =
        await Promise.all([
          supabase
            .from('organizations')
            .select('id')
            .eq('id', orgId)
            .single(),
          supabase
            .from('integrations')
            .select('config')
            .eq('provider', INTEGRATION_PROVIDERS.VAPI)
            .eq('org_id', orgId)
            .maybeSingle()
        ]);

      if (orgError || !org) {
        logger.error('Org not found for user', { orgId, userId: user.id, requestId });
        res.status(404).json({ error: 'Organization not found', requestId });
        return;
      }

      // Get the stored Vapi API key
      let vapiApiKey: string | undefined = vapiIntegration?.config?.vapi_api_key || vapiIntegration?.config?.vapi_secret_key;

      if (!vapiApiKey) {
        res.status(400).json({
          error: 'Vapi API key not configured. Please save your Vapi API key in Settings first.',
          requestId
        });
        return;
      }

      // Sanitize Vapi key
      try {
        vapiApiKey = sanitizeVapiKey(vapiApiKey);
      } catch (sanitizeErr: any) {
        logger.error('Failed to sanitize Vapi key', { orgId, requestId, error: sanitizeErr.message });
        res.status(400).json({
          error: 'Vapi connection is not valid. Please save connection again.',
          requestId
        });
        return;
      }

      // INDEPENDENT AGENT UPDATES: Find or create agents by role
      const agentMap: Record<string, string> = {}; // role -> agentId

      for (const role of [AGENT_ROLES.OUTBOUND, AGENT_ROLES.INBOUND]) {
        const { data: existingAgent } = await supabase
          .from('agents')
          .select('id')
          .eq('role', role)
          .eq('org_id', orgId)
          .maybeSingle();

        let agentId = existingAgent?.id;

        if (!agentId) {
          const name = role === AGENT_ROLES.OUTBOUND ? 'CallWaiting AI Outbound' : 'CallWaiting AI Inbound';
          const { data: newAgent, error: insertError } = await supabase
            .from('agents')
            .insert({
              role: role,
              name: name,
              status: 'active',
              org_id: orgId
            })
            .select('id')
            .single();

          if (insertError) {
            logger.error(`Failed to create ${role} agent`, { requestId, error: insertError });
            continue;
          }
          agentId = newAgent?.id;
        }

        if (agentId) {
          agentMap[role] = agentId;
        }
      }

      // Update each agent independently with its own payload
      const updateResults: Array<{ role: string; agentId: string; success: boolean; error?: string }> = [];

      // Update INBOUND agent if payload exists
      if (inboundPayload && agentMap[AGENT_ROLES.INBOUND]) {
        const inboundAgentId = agentMap[AGENT_ROLES.INBOUND];
        const { error: updateError } = await supabase
          .from('agents')
          .update(inboundPayload)
          .eq('id', inboundAgentId)
          .eq('org_id', orgId);

        if (updateError) {
          logger.error('Failed to update inbound agent', { agentId: inboundAgentId, updateError, requestId });
          updateResults.push({ role: AGENT_ROLES.INBOUND, agentId: inboundAgentId, success: false, error: updateError.message });
        } else {
          logger.info('Inbound agent updated', { agentId: inboundAgentId, requestId });
          updateResults.push({ role: AGENT_ROLES.INBOUND, agentId: inboundAgentId, success: true });
        }
      }

      // Update OUTBOUND agent if payload exists
      if (outboundPayload && agentMap[AGENT_ROLES.OUTBOUND]) {
        const outboundAgentId = agentMap[AGENT_ROLES.OUTBOUND];
        const { error: updateError } = await supabase
          .from('agents')
          .update(outboundPayload)
          .eq('id', outboundAgentId)
          .eq('org_id', orgId);

        if (updateError) {
          logger.error('Failed to update outbound agent', { agentId: outboundAgentId, updateError, requestId });
          updateResults.push({ role: AGENT_ROLES.OUTBOUND, agentId: outboundAgentId, success: false, error: updateError.message });
        } else {
          logger.info('Outbound agent updated', { agentId: outboundAgentId, requestId });
          updateResults.push({ role: AGENT_ROLES.OUTBOUND, agentId: outboundAgentId, success: true });
        }
      }

      // Collect agent IDs that need Vapi sync
      const agentIdsToSync = updateResults
        .filter(r => r.success)
        .map(r => r.agentId);

      if (agentIdsToSync.length === 0) {
        res.status(400).json({ error: 'No agents were updated', requestId });
        return;
      }

      // Parallel Vapi Sync for updated agents
      logger.info('Syncing agents to Vapi', { 
        agentIds: agentIdsToSync, 
        requestId,
        inboundUpdated: Boolean(inboundPayload),
        outboundUpdated: Boolean(outboundPayload)
      });

      const syncPromises = agentIdsToSync.map(id => ensureAssistantSynced(id, vapiApiKey!));
      const syncResults = await Promise.allSettled(syncPromises);

      const successfulSyncs = syncResults.filter(r => r.status === 'fulfilled').map((r: any) => r.value);
      const failedSyncs = syncResults.filter(r => r.status === 'rejected');

      if (failedSyncs.length > 0) {
        logger.warn('Some agents failed to sync to Vapi', {
          successCount: successfulSyncs.length,
          failCount: failedSyncs.length,
          errors: failedSyncs.map((r: any) => r.reason?.message || String(r.reason)),
          requestId
        });
      } else {
        logger.info('All agents synced successfully to Vapi', { 
          count: successfulSyncs.length, 
          requestId,
          assistantIds: successfulSyncs
        });
      }

      // Verify voice was synced by checking agent records
      const { data: syncedAgents } = await supabase
        .from('agents')
        .select('id, role, voice, vapi_assistant_id')
        .in('id', agentIdsToSync);

      logger.info('Agent sync verification', {
        requestId,
        agents: syncedAgents?.map(a => ({
          role: a.role,
          voice: a.voice,
          hasVapiId: Boolean(a.vapi_assistant_id)
        }))
      });

      res.status(200).json({
        success: true,
        syncedAgentIds: successfulSyncs,
        message: `Agent configuration saved and synced to Vapi. ${successfulSyncs.length} assistant(s) updated.`,
        voiceSynced: successfulSyncs.length > 0,
        knowledgeBaseSynced: successfulSyncs.length > 0,
        agentDetails: syncedAgents?.map(a => ({
          role: a.role,
          voice: a.voice,
          vapiAssistantId: a.vapi_assistant_id
        })),
        requestId
      });

    } catch (error: any) {
      logger.error('Failed to save agent behavior', {
        errorMessage: error?.message,
        requestId
      });
      logger.exception('Stack trace', error);
      res.status(500).json({ error: error?.message || 'Internal server error', requestId });
    }
  }
);

/**
 * POST /api/founder-console/agent/test-call
 * Run a test call using stored config.
 * Returns vapiCallId (primary realtime ID) and trackingId.
 */
router.post(
  '/agent/test-call',
  requireAuthOrDev,
  callRateLimiter,
  validateRequest(agentTestCallSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.requestId || generateRequestId();
    try {
      const userId = req.user?.id;
      const orgId = req.user?.orgId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      const { testDestinationNumber } = req.body;

      // Fetch integration settings from database (keys stored securely)
      const settings = await getIntegrationSettings();

      if (!settings?.vapi_api_key) {
        res.status(400).json({ error: 'Vapi API key not configured. Save settings first.', requestId });
        return;
      }

      const vapiApiKey = settings.vapi_api_key;
      const storedDest = settings.test_destination_number;

      const destination = testDestinationNumber || storedDest;
      if (!destination) {
        res.status(400).json({ error: 'Test destination number required', requestId });
        return;
      }
      if (!validateE164Format(destination)) {
        res.status(400).json({ error: 'Test Destination Number must be E.164 format (e.g. +234...)', requestId });
        return;
      }

      const { data: agent } = await supabase
        .from('agents')
        .select('id, vapi_assistant_id, system_prompt, first_message, voice, max_call_duration')
        .eq('role', AGENT_ROLES.OUTBOUND)
        .eq('org_id', orgId)
        .maybeSingle();

      if (!agent?.id) {
        res.status(400).json({ error: 'Agent not configured. Save Agent Behavior first.', requestId });
        return;
      }

      // CRITICAL: Validate agent has all required behavior fields
      if (!agent.system_prompt || !agent.first_message || !agent.voice || !agent.max_call_duration) {
        const missingFields = [
          !agent.system_prompt && 'System Prompt',
          !agent.first_message && 'First Message',
          !agent.voice && 'Voice',
          !agent.max_call_duration && 'Max Call Duration'
        ].filter(Boolean);

        res.status(400).json({
          error: `Agent behavior incomplete. Missing: ${missingFields.join(', ')}. Fill all fields and save.`,
          requestId
        });
        return;
      }

      // HIGH: Check if user already has an active call (rapid call deduplication)
      const { data: activeCall } = await supabase
        .from('call_tracking')
        .select('id')
        .eq('metadata->>userId', userId)
        .in('status', ['queued', 'ringing', 'in_progress'])
        .maybeSingle();

      if (activeCall) {
        res.status(400).json({
          error: 'You already have an active call. End it first.',
          requestId
        });
        return;
      }

      // Always re-sync to pick up latest system_prompt, voice, language, and other changes
      const assistantId = await ensureAssistantSynced(agent.id, vapiApiKey);

      // Get Twilio phone number from settings
      const twilioFromNumber = settings.twilio_from_number;
      if (!twilioFromNumber) {
        res.status(400).json({ error: 'Twilio phone number not configured. Save settings first.', requestId });
        return;
      }

      const { data: trackingRow, error: trackingInsertError } = await supabase
        .from('call_tracking')
        .insert({
          org_id: orgId,
          lead_id: null,
          agent_id: agent.id,
          phone: destination,
          vapi_call_id: `pending-${requestId}`,
          called_at: new Date().toISOString(),
          call_outcome: CallOutcome.QUEUED,
          metadata: { userId, is_test_call: true }
        })
        .select('id')
        .single();

      if (trackingInsertError || !trackingRow?.id) {
        res.status(500).json({ error: 'Failed to initialize call tracking', requestId });
        return;
      }

      const vapiClient = new VapiClient(vapiApiKey);
      const call = await vapiClient.createOutboundCall({
        assistantId,
        phoneNumberId: twilioFromNumber,
        customer: {
          number: destination,
          name: 'Test Call'
        }
      });

      const vapiCallId = call?.id;
      if (!vapiCallId) {
        // Clean up orphaned tracking row on Vapi failure
        await supabase.from('call_tracking').delete().eq('id', trackingRow.id);
        res.status(500).json({ error: 'Vapi did not return a call id', requestId });
        return;
      }

      // CRITICAL: Update call_tracking with real vapiCallId immediately (atomic with Vapi response)
      // This prevents race condition where webhooks arrive before tracking row is updated
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({ vapi_call_id: vapiCallId })
        .eq('id', trackingRow.id);

      if (updateError) {
        // Clean up orphaned tracking row on update failure
        await supabase.from('call_tracking').delete().eq('id', trackingRow.id);
        logger.error('Failed to link call to vapi_call_id', { trackingId: trackingRow.id, vapiCallId, updateError, requestId });
        res.status(500).json({ error: 'Failed to initialize call', requestId });
        return;
      }

      wsBroadcast({
        type: 'call_status',
        vapiCallId,
        trackingId: trackingRow.id,
        userId,
        status: 'connecting'
      });

      res.status(200).json({
        success: true,
        vapiCallId,
        trackingId: trackingRow.id,
        userId,
        requestId
      });
    } catch (error: any) {
      logger.exception('Failed to run test call', error);
      res.status(500).json({ error: error.message, requestId });
    }
  }
);

/**
 * POST /api/founder-console/calls/end
 * End an active call (live test or web test)
 * 
 * Request: { callId: "<vapi-call-id>" }
 * Response: { success: true }
 * 
 * Sends end-call message to Vapi and broadcasts call_ended event to UI.
 */
router.post(
  '/calls/end',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { callId } = req.body;

      if (!callId) {
        res.status(400).json({ error: 'callId required' });
        return;
      }

      // Find call_tracking by vapi_call_id
      const { data: callTracking, error: trackingError } = await supabase
        .from('call_tracking')
        .select('id, vapi_call_id, metadata')
        .eq('vapi_call_id', callId)
        .maybeSingle();

      if (trackingError) {
        logger.error('Error fetching call tracking for end call', { callId, trackingError });
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      if (!callTracking) {
        res.status(404).json({ error: 'Call not found' });
        return;
      }

      // Send end-call message to Vapi via WebSocket
      // Note: This is handled by the Vapi client or webhook handler
      // For now, we just update the status and broadcast
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callTracking.id);

      if (updateError) {
        logger.error('Error updating call status', { callId, updateError });
        res.status(500).json({ error: 'Failed to end call' });
        return;
      }

      // Broadcast call_ended event to UI
      wsBroadcast({
        type: 'call_ended',
        vapiCallId: callId,
        trackingId: callTracking.id,
        userId: (callTracking?.metadata as any)?.userId,
        reason: 'user_ended',
        durationSeconds: 0
      });

      logger.info('Call ended by user', { callId, trackingId: callTracking.id });
      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.exception('Failed to end call', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/founder-console/agent/web-test
 * Initiate a web-based test call using Vapi WebSocket transport.
 * 
 * Request: { userId: "<current-user-id>" }
 * Response: { success, vapiCallId, trackingId, userId, bridgeWebsocketUrl, requestId }
 * 
 * Key invariants:
 * - Never expose raw Vapi WebSocket URL
 * - bridgeWebsocketUrl always points to backend bridge (/api/web-voice/:trackingId)
 * - call_tracking.vapi_call_id = Vapi call id (once known)
 * - call_tracking.id = trackingId
 * - Both IDs carried into every event and bridge session
 */
/**
 * POST /api/founder-console/agent/web-test
 * 
 * Initiates a web-based test call using the INBOUND agent.
 * 
 * The inbound agent is designed for:
 * - Browser-based voice interactions via WebSocket
 * - Real-time audio streaming (PCM 16-bit, 16kHz)
 * - Interactive conversation testing
 * 
 * Agent Configuration Source:
 * - Fetched from 'agents' table where role = 'INBOUND'
 * - System prompt, first message, voice, language, max duration required
 * 
 * Response:
 * - bridgeWebsocketUrl: URL for frontend to connect to for audio streaming
 * - trackingId: Unique session identifier
 * - vapiCallId: Vapi call identifier
 */
router.post(
  '/agent/web-test',
  callRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.requestId || generateRequestId();
    let trackingId: string | null = null;

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      // Use helper to eliminate code duplication
      const config = await getOrgAndVapiConfig(req, res, requestId);
      if (!config) return;
      const { orgId, vapiApiKey, vapiIntegration } = config;

      const { data: agent } = await supabase
        .from('agents')
        .select('id, system_prompt, first_message, voice, language, max_call_duration')
        .eq('role', AGENT_ROLES.INBOUND)
        .eq('org_id', orgId)
        .maybeSingle();

      if (!agent?.id) {
        res.status(400).json({ error: 'Agent not configured. Save Agent Behavior first.', requestId });
        return;
      }

      // Validate agent has all required behavior fields
      if (!agent.system_prompt || !agent.first_message || !agent.voice || !agent.language || !agent.max_call_duration) {
        const missingFields = [
          !agent.system_prompt && 'System Prompt',
          !agent.first_message && 'First Message',
          !agent.voice && 'Voice',
          !agent.language && 'Language',
          !agent.max_call_duration && 'Max Call Duration'
        ].filter(Boolean);

        res.status(400).json({
          error: `Agent behavior incomplete. Missing: ${missingFields.join(', ')}. Fill all fields and save.`,
          requestId
        });
        return;
      }

      // Always re-sync to pick up latest system_prompt, voice, language, and other changes
      const assistantId = await ensureAssistantSynced(agent.id, vapiApiKey);

      // Create call_tracking row for web test
      const { data: trackingRow, error: trackingInsertError } = await supabase
        .from('call_tracking')
        .insert({
          org_id: orgId,
          lead_id: null,
          agent_id: agent.id,
          phone: null,
          vapi_call_id: `pending-${requestId}`,
          called_at: new Date().toISOString(),
          call_outcome: CallOutcome.QUEUED,
          metadata: { userId, is_test_call: true, channel: 'web' }
        })
        .select('id')
        .single();

      if (trackingInsertError || !trackingRow?.id) {
        if (trackingInsertError) {
          logger.exception('Failed to insert call tracking', trackingInsertError as Error);
        }
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      const trackingId = trackingRow.id;

      // Create Vapi WebSocket call
      const wsVapiClient = new VapiClient(vapiApiKey);
      let call;
      try {
        call = await wsVapiClient.createWebSocketCall({
          assistantId,
          audioFormat: {
            format: 'pcm_s16le',
            container: 'raw',
            sampleRate: 16000
          }
        });
      } catch (vapiError: any) {
        // Clean up orphaned tracking row on Vapi failure
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        const status: number | undefined = vapiError?.response?.status;
        const message: string | undefined =
          vapiError?.response?.data?.message ||
          vapiError?.response?.data?.error ||
          vapiError?.message;

        logger.exception('Failed to create Vapi WebSocket call', vapiError);

        // Surface provider failures so the frontend doesn't spin forever.
        // Do NOT include secrets; only return Vapi's message.
        if (status && status >= 400 && status < 500) {
          res.status(402).json({
            error: message || 'Vapi rejected the request',
            requestId,
            provider: 'vapi',
            providerStatus: status
          });
          return;
        }

        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      const vapiCallId = call?.id;
      const vapiTransportUrl = call?.transport?.websocketCallUrl;

      if (!vapiCallId || !vapiTransportUrl) {
        // Clean up orphaned tracking row
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        logger.error('Vapi call missing id or transport url', { call });
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      // Update call_tracking with actual vapiCallId
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({ vapi_call_id: vapiCallId })
        .eq('id', trackingId);

      if (updateError) {
        // Clean up on update failure
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        logger.exception('Failed to update call tracking', updateError);
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      // Create backend WebSocket bridge session with timeout protection
      // This returns a Promise that resolves only when Vapi connection is open
      try {
        const bridgePromise = createWebVoiceSession(vapiCallId, trackingId, userId, vapiTransportUrl);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('WebSocket bridge timeout after 30s')), 30000)
        );
        await Promise.race([bridgePromise, timeoutPromise]);
      } catch (bridgeError: any) {
        // Clean up on bridge creation failure
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        logger.exception('Failed to create WebSocket bridge', bridgeError);
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      // Broadcast initial call_status
      wsBroadcast({
        type: 'call_status',
        vapiCallId,
        trackingId,
        userId,
        status: 'connecting'
      });

      // Return backend bridge URL (NOT Vapi's internal URL)
      // CRITICAL FIX: Use X-Forwarded-Host if available (from reverse proxy), otherwise use Host header
      // This ensures WebSocket URL matches the frontend's origin for same-origin policy
      const forwardedHost = req.get('x-forwarded-host');
      const requestHost = forwardedHost || req.get('host') || 'localhost:3001';
      const forwardedProto = req.get('x-forwarded-proto');
      const wsProtocol = (forwardedProto === 'https' || req.protocol === 'https') ? 'wss' : 'ws';
      const baseUrl = `${wsProtocol}://${requestHost}`;
      const bridgeWebsocketUrl = `${baseUrl}/api/web-voice/${trackingId}?userId=${encodeURIComponent(userId)}`;

      logger.info('Web test session created', {
        trackingId,
        userId,
        baseUrl,
        bridgeWebsocketUrl,
        requestId
      });

      res.status(200).json({
        success: true,
        vapiCallId,
        trackingId,
        userId,
        bridgeWebsocketUrl,
        requestId
      });
    } catch (error: any) {
      logger.exception('Failed to initiate web test', error);
      res.status(500).json({ error: 'Internal server error', requestId });
    }
  }
);

/**
 * POST /api/founder-console/agent/web-test/end
 * End an active web test call.
 */
router.post(
  '/agent/web-test/end',
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.requestId || generateRequestId();
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      const { trackingId } = req.body;
      if (!trackingId) {
        res.status(400).json({ error: 'trackingId required', requestId });
        return;
      }

      // End the web voice session
      await endWebVoiceSession(trackingId);

      // Update call_tracking status
      await supabase
        .from('call_tracking')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', trackingId);

      res.status(200).json({
        success: true,
        requestId
      });
    } catch (error: any) {
      logger.exception('Failed to end web test', error);
      res.status(500).json({ error: error.message, requestId });
    }
  }
);

/**
 * POST /api/founder-console/agent/web-test-outbound
 * Initiate an outbound test call to a phone number using Vapi.
 * 
 * Request: { phoneNumber: string }
 * Response: { success, vapiCallId, trackingId, userId, bridgeWebsocketUrl, requestId }
 */
router.post(
  '/agent/web-test-outbound',
  callRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.requestId || generateRequestId();
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      const { phoneNumber } = req.body;
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        res.status(400).json({ error: 'phoneNumber required and must be a string', requestId });
        return;
      }

      // CRITICAL FIX #5: E.164 phone number validation
      // E.164 format: + followed by country code + number (7-15 digits total)
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, ''); // Remove formatting
      const e164Regex = /^\+[1-9]\d{6,14}$/; // E.164: must start with +, then 7-15 digits
      if (!e164Regex.test(cleanPhone)) {
        res.status(400).json({
          error: 'Invalid phone number. Use E.164 format: +1234567890 (include country code)',
          requestId
        });
        return;
      }

      // Prefer authenticated org context to avoid cross-org mismatches between UI and dev tools.
      const orgId = req.user?.orgId;
      if (!orgId) {
        res.status(400).json({
          error: 'Organization not resolved from auth context',
          requestId
        });
        return;
      }

      const { data: vapiIntegration } = await supabase
        .from('integrations')
        .select('config')
        .eq('provider', INTEGRATION_PROVIDERS.VAPI)
        .eq('org_id', orgId)
        .maybeSingle();

      const vapiApiKey: string | undefined = vapiIntegration?.config?.vapi_api_key || vapiIntegration?.config?.vapi_secret_key;

      if (!vapiApiKey) {
        res.status(400).json({ error: 'Vapi connection not configured', requestId });
        return;
      }

      // CRITICAL FIX: Fetch from outbound_agent_config source of truth
      // The 'agents' table is legacy/stale for this specific new config flow
      const { data: outboundConfig } = await supabase
        .from('outbound_agent_config')
        .select('system_prompt, first_message, voice_id, language, max_call_duration, vapi_assistant_id')
        .eq('org_id', orgId)
        .maybeSingle();

      const { data: agent } = await supabase
        .from('agents')
        .select('id, system_prompt, first_message, voice, language, max_call_duration')
        .eq('role', AGENT_ROLES.OUTBOUND)
        .eq('org_id', orgId)
        .maybeSingle();

      if (!agent?.id) {
        res.status(400).json({ error: 'Agent not initialized in database. Please contact support.', requestId });
        return;
      }

      // Use outbound_config if available (Source of Truth), otherwise fallback to agents table
      const activeConfig = {
        system_prompt: outboundConfig?.system_prompt || agent.system_prompt,
        first_message: outboundConfig?.first_message || agent.first_message,
        voice: outboundConfig?.voice_id || agent.voice,
        language: outboundConfig?.language || agent.language,
        max_call_duration: outboundConfig?.max_call_duration || agent.max_call_duration,
        vapi_assistant_id: outboundConfig?.vapi_assistant_id
      };

      // CRITICAL FIX: Complete validation of all required outbound config fields
      const missingFields = [
        !activeConfig.system_prompt?.trim() && 'System Prompt',
        !activeConfig.first_message?.trim() && 'First Message',
        !activeConfig.voice?.trim() && 'Voice',
        !activeConfig.language?.trim() && 'Language',
        !activeConfig.max_call_duration && 'Max Call Duration'
      ].filter(Boolean);

      if (missingFields.length > 0) {
        res.status(400).json({
          error: `Outbound agent configuration incomplete. Missing: ${missingFields.join(', ')}. Please save the Outbound Configuration in the dashboard first.`,
          requestId
        });
        return;
      }

      // Sync/Get Assistant
      // If we have a vapi_assistant_id from the new config, use it directly.
      // Otherwise, fall back to the legacy ensureAssistantSynced which might create one.
      let assistantId = activeConfig.vapi_assistant_id;

      if (!assistantId) {
        logger.warn('No vapi_assistant_id in outbound config, falling back to legacy agent sync', { orgId });
        try {
          assistantId = await ensureAssistantSynced(agent.id, vapiApiKey);
        } catch (syncError: any) {
          logger.error('Failed to sync assistant from legacy agents table', { error: syncError?.message });
          res.status(500).json({
            error: 'Failed to sync agent configuration. Please save the Outbound Configuration again.',
            requestId
          });
          return;
        }
      }

      // CRITICAL FIX: Force-Update Assistant with latest Active Config
      // This ensures we don't use stale data from the 'agents' table if ensureAssistantSynced was used,
      // and ensures the assistant is 100% aligned with what the user sees in the UI right now.
      if (assistantId) {
        try {
          const vapiClient = new VapiClient(vapiApiKey);
          await vapiClient.updateAssistant(assistantId, {
            name: 'Voxanne Outbound Agent (Test)',
            model: {
              provider: VAPI_DEFAULTS.MODEL_PROVIDER,
              model: VAPI_DEFAULTS.MODEL_NAME,
              messages: [{ role: 'system', content: activeConfig.system_prompt }]
            },
            voice: {
              provider: getVoiceProvider(activeConfig.voice || 'Paige'),
              voiceId: activeConfig.voice || 'Paige'
            },
            firstMessage: activeConfig.first_message,
            maxDurationSeconds: activeConfig.max_call_duration || VAPI_DEFAULTS.DEFAULT_MAX_DURATION,
            language: activeConfig.language || VAPI_DEFAULTS.DEFAULT_LANGUAGE,
            // Ensure we receive async failure reports
            serverMessages: ['function-call', 'hangup', 'status-update', 'end-of-call-report', 'transcript']
          });

          // If we relied on a fresh sync and didn't have the ID in our new config table, patch it now
          if (!activeConfig.vapi_assistant_id) {
            await supabase.from('outbound_agent_config')
              .update({ vapi_assistant_id: assistantId })
              .eq('org_id', orgId);
          }

          logger.info('Assistant synced with current outbound config', { assistantId });
        } catch (syncError: any) {
          // This is a warning, not a blocker - assistant may still work with old config
          logger.warn('Failed to update assistant with latest config, proceeding with existing state', {
            assistantId,
            error: syncError?.message
          });
        }
      }

      // CRITICAL FIX: Deterministic Phone Number Selection
      // Single-number policy: Outbound ALWAYS uses the inbound Twilio/Vapi mapping.
      // This prevents conflicting imports and removes any ambiguity.
      const { data: inboundMapping, error: inboundMappingError } = await supabase
        .from('integrations')
        .select('config')
        .eq('org_id', orgId)
        .eq('provider', 'twilio_inbound')
        .maybeSingle();

      if (inboundMappingError && inboundMappingError.code !== 'PGRST116') {
        res.status(500).json({ error: 'Failed to load inbound number mapping', requestId });
        return;
      }

      const inboundCfg: any = inboundMapping?.config || null;
      const phoneNumberId: string | undefined = inboundCfg?.vapiPhoneNumberId;
      const inboundCallerNumber: string | undefined = inboundCfg?.phoneNumber;

      if (!phoneNumberId) {
        res.status(400).json({
          error: 'Inbound phone number is not provisioned yet. Please complete Inbound Setup first.',
          action: 'Go to Inbound Config and click Save & Activate Inbound.',
          requestId
        });
        return;
      }

      logger.info('Outbound test resolved context (single-number)', {
        requestId,
        orgId,
        assistantId: assistantId ? assistantId.slice(-6) : null,
        inboundCallerLast4: inboundCallerNumber ? inboundCallerNumber.slice(-4) : null,
        phoneNumberIdLast6: phoneNumberId.slice(-6)
      });

      // Create call_tracking row for outbound test
      const { data: trackingRow, error: trackingInsertError } = await supabase
        .from('call_tracking')
        .insert({
          org_id: orgId,
          lead_id: null,
          agent_id: agent.id,
          phone: cleanPhone,
          vapi_call_id: `pending-${requestId}`,
          called_at: new Date().toISOString(),
          call_outcome: CallOutcome.QUEUED,
          metadata: { userId, is_test_call: true, channel: 'outbound', testPhoneNumber: cleanPhone }
        })
        .select('id')
        .single();

      if (trackingInsertError || !trackingRow?.id) {
        if (trackingInsertError) {
          logger.exception('Failed to insert call tracking for outbound test', trackingInsertError as Error);
        }
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      const trackingId = trackingRow.id;

      // Create Vapi outbound call with CORRECT parameters
      // Phone calls use webhooks for transcription (not WebSocket bridge)
      // Note: vapiClient already declared above for phone number lookup
      let call;
      try {
        const vapiClient = new VapiClient(vapiApiKey);
        call = await vapiClient.createOutboundCall({
          assistantId,
          phoneNumberId,  // Vapi phone number ID (caller ID)
          customer: {
            number: cleanPhone  // Phone number to call
          }
        });
      } catch (vapiError: any) {
        // Clean up orphaned tracking row on Vapi failure
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        logger.exception('Failed to create Vapi outbound call', vapiError);
        const errorMsg = vapiError?.response?.data?.message || vapiError?.message || 'Unknown error';
        res.status(500).json({
          error: `Failed to initiate outbound call: ${errorMsg}`,
          requestId
        });
        return;
      }

      const vapiCallId = call?.id;

      if (!vapiCallId) {
        // Clean up orphaned tracking row
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        logger.error('Vapi outbound call missing id', { call });
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      // Update call_tracking with actual vapiCallId
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({ vapi_call_id: vapiCallId })
        .eq('id', trackingId);

      if (updateError) {
        // Clean up on update failure
        await supabase.from('call_tracking').delete().eq('id', trackingId);

        logger.exception('Failed to update call tracking for outbound test', updateError);
        res.status(500).json({ error: 'Internal server error', requestId });
        return;
      }

      // NOTE: No WebSocket bridge for phone calls - transcription comes via Vapi webhooks
      // The webhook handler (webhooks.ts) broadcasts transcripts to /ws/live-calls
      // Frontend connects to /ws/live-calls and filters by trackingId

      // Broadcast initial call_status
      wsBroadcast({
        type: 'call_status',
        vapiCallId,
        trackingId,
        userId,
        status: 'connecting'
      });

      // For phone calls, frontend connects to main WebSocket /ws/live-calls
      // and filters by trackingId to receive transcripts from Vapi webhooks
      logger.info('Outbound test call initiated', {
        trackingId,
        vapiCallId,
        userId,
        phoneNumber: cleanPhone.slice(-4), // Log only last 4 digits for privacy
        requestId
      });

      res.status(200).json({
        success: true,
        vapiCallId,
        trackingId,
        userId,
        // No bridgeWebsocketUrl - phone calls use webhooks, not WebSocket bridge
        // Frontend should connect to /ws/live-calls and filter by trackingId
        requestId
      });
    } catch (error: any) {
      logger.exception('Failed to initiate outbound test', error);
      res.status(500).json({ error: 'Internal server error', requestId });
    }
  }
);

/**
 * GET /api/founder-console/metrics/usage
 * Get call usage metrics and estimated costs
 */
router.get('/metrics/usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get the first/default organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !org?.id) {
      res.status(400).json({
        error: 'Organization not initialized. Please create an organization first.'
      });
      return;
    }

    const orgId = org.id;

    // Query today's calls
    const { data: todayCalls } = await supabase
      .from('call_tracking')
      .select('duration_seconds, answered, call_outcome')
      .eq('org_id', orgId)
      .gte('called_at', todayStart.toISOString())
      .lte('called_at', now.toISOString());

    // Query month's calls
    const { data: monthlyCalls } = await supabase
      .from('call_tracking')
      .select('duration_seconds, answered, call_outcome')
      .eq('org_id', orgId)
      .gte('called_at', monthStart.toISOString())
      .lte('called_at', now.toISOString());

    const todayCallsList = todayCalls || [];
    const monthlyCallsList = monthlyCalls || [];

    // Calculate metrics
    const todayCallCount = todayCallsList.length;
    const todayAnsweredCount = todayCallsList.filter(c => c.answered).length;
    const todayTotalSeconds = todayCallsList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const todayTotalMinutes = Math.round((todayTotalSeconds / 60) * 100) / 100;

    const monthlyCallCount = monthlyCallsList.length;
    const monthlyAnsweredCount = monthlyCallsList.filter(c => c.answered).length;
    const monthlyTotalSeconds = monthlyCallsList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const monthlyTotalMinutes = Math.round((monthlyTotalSeconds / 60) * 100) / 100;

    // Estimate cost (Vapi charges roughly $0.05 per minute for calls)
    const costPerMinute = 0.05;
    const estimatedDailyCost = Math.round((todayTotalMinutes * costPerMinute) * 100) / 100;
    const estimatedMonthlyCost = Math.round((monthlyTotalMinutes * costPerMinute) * 100) / 100;

    // Calculate success rates
    const todaySuccessRate = todayCallCount > 0
      ? Math.round((todayAnsweredCount / todayCallCount) * 100)
      : 0;
    const monthlySuccessRate = monthlyCallCount > 0
      ? Math.round((monthlyAnsweredCount / monthlyCallCount) * 100)
      : 0;

    res.json({
      today: {
        calls: todayCallCount,
        answeredCalls: todayAnsweredCount,
        successRate: todaySuccessRate,
        totalMinutes: todayTotalMinutes,
        estimatedCost: estimatedDailyCost
      },
      monthly: {
        calls: monthlyCallCount,
        answeredCalls: monthlyAnsweredCount,
        successRate: monthlySuccessRate,
        totalMinutes: monthlyTotalMinutes,
        estimatedCost: estimatedMonthlyCost
      },
      creditWarningThreshold: 0.8 // 80% of budget
    });
  } catch (error: any) {
    logger.exception('Failed to get usage metrics', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/founder-console/recordings
 * List all call recordings for the organization
 */
router.get('/recordings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, offset } = getPaginationParams(req.query);

    // Get the first/default organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !org?.id) {
      res.status(400).json({
        error: 'Organization not initialized. Please create an organization first.'
      });
      return;
    }

    const orgId = org.id;

    // Query call logs with recordings
    const { data: recordings } = await supabase
      .from('call_logs')
      .select('id, vapi_call_id, to_number, started_at, duration_seconds, recording_url, transcript')
      .eq('org_id', orgId)
      .not('recording_url', 'is', null)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const mappedRecordings = (recordings || []).map(rec => ({
      id: rec.id,
      callId: rec.vapi_call_id,
      phoneNumber: rec.to_number,
      recordedAt: rec.started_at,
      durationSeconds: rec.duration_seconds,
      recordingUrl: rec.recording_url,
      hasTranscript: !!rec.transcript
    }));

    res.json(mappedRecordings);
  } catch (error: any) {
    logger.exception('Failed to get recordings', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/founder-console/recordings/:id
 * Delete a specific recording
 * Security: Verifies org ownership before deletion
 */
router.delete('/recordings/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get the first/default organization for ownership check
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    const orgId = org?.id;

    if (!orgId) {
      errorResponse(res, 400, 'Organization not initialized');
      return;
    }

    // Get recording with org_id check for ownership verification
    const { data: recording } = await supabase
      .from('call_logs')
      .select('vapi_call_id, recording_url, org_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!recording) {
      res.status(404).json({ error: 'Recording not found or access denied' });
      return;
    }

    // Mark as deleted in our database (soft delete)
    await supabase
      .from('call_logs')
      .update({ recording_url: null })
      .eq('id', id)
      .eq('org_id', orgId);

    logger.info('Recording deleted', { callId: recording.vapi_call_id });
    res.status(204).send();
  } catch (error: any) {
    logger.exception('Failed to delete recording', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== LEADS ==========

/**
 * GET /api/founder-console/leads
 * List all leads for the leads table with pagination
 * Scoped to authenticated user's organization
 * Optimized with single query using LEFT JOIN to avoid N+1 problem
 */
router.get('/leads', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || generateRequestId();
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', requestId });
      return;
    }

    const orgId: string = user.orgId;
    const { limit, offset } = getPaginationParams(req.query);

    // Single optimized query with LEFT JOIN to get leads and their latest call outcome
    // Scoped to user's organization
    const { data: leadsWithOutcomes, error } = await supabase
      .from('leads')
      .select(`
        id,
        name,
        contact_name,
        clinic_name,
        company_name,
        city,
        phone,
        email,
        status,
        personalization_data,
        call_tracking!call_tracking_lead_id_fkey (
          call_outcome,
          called_at
        )
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .eq('opted_out', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to query leads', { orgId, error: error.message, requestId });
      res.status(500).json({ error: 'Internal server error', requestId });
      return;
    }

    // Extract latest call outcome for each lead (most recent call first)
    const mappedLeads = (leadsWithOutcomes || []).map((lead: any) => {
      const calls = (lead.call_tracking as any[]) || [];
      // Get the most recent call (first one since order is DESC)
      const latestCall = calls.length > 0 ? calls[0] : null;

      return {
        id: lead.id,
        name: lead.contact_name || lead.name || 'Unknown',
        clinic: lead.clinic_name || lead.company_name || 'Unknown Clinic',
        city: lead.city || '',
        phone: lead.phone || '',
        email: lead.email || '',
        lastOutcome: latestCall?.call_outcome || null,
        painPoint: lead.personalization_data?.pain_point_identified || null
      };
    });

    res.json(mappedLeads);
  } catch (error: any) {
    logger.exception('Failed to get leads', error);
    res.status(500).json({ error: 'Internal server error', requestId });
  }
});

// ========== CALLS ==========

/**
 * POST /api/founder-console/calls/start
 * Start an outbound call to a lead
 * Rate limited to 30 requests per minute
 * Validates leadId is a UUID
 */
router.post(
  '/calls/start',
  requireAuthOrDev,  // Dev bypass (no manual JWT) + prod auth
  callCreationLimiter,
  validateRequest(createCallSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { leadId, assistantId: assistantIdOverride } = req.body;

      // Ensure user is authenticated (should be guaranteed by requireAuth middleware)
      if (!req.user?.id) {
        logger.error('User not authenticated despite requireAuth middleware');
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = req.user.id;
      const requestId = crypto.randomUUID();  // Generate unique request ID for tracing

      logger.info('Starting call', { requestId, leadId, userId });

      // Get organization from authenticated user context
      // FIX #2: Use .maybeSingle() to avoid crashes if user has 0 or >1 orgs
      const { data: userOrgs, error: userOrgError } = await supabase
        .from('user_org_roles')
        .select('org_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }) // Deterministic sort
        .limit(1)
        .maybeSingle();

      if (userOrgError || !userOrgs?.org_id) {
        logger.error('User not assigned to any organization', {
          requestId,
          userId,
          error: userOrgError?.message,
          code: userOrgError?.code
        });
        res.status(403).json({
          error: 'User not assigned to any organization',
          requestId
        });
        return;
      }

      const orgId = userOrgs.org_id;

      // Batch fetch lead, active calls, and agent in parallel for performance
      // FIX #3: Use .maybeSingle() for lead query to avoid crashes if lead doesn't exist
      const [leadResult, activeCallsResult, agentResult] = await Promise.all([
        supabase.from('leads').select('*').eq('id', leadId).eq('org_id', orgId).maybeSingle(),
        supabase.from('call_tracking').select('id, status, called_at, call_outcome, metadata').eq('lead_id', leadId)
          .in('call_outcome', [CallOutcome.NO_ANSWER, CallOutcome.RINGING, CallOutcome.QUEUED, CallOutcome.IN_PROGRESS])
          .limit(1),
        supabase.from('agents').select('*').eq('role', AGENT_ROLES.OUTBOUND).eq('org_id', orgId).limit(1)
      ]);

      // Verify user has permission to call this lead (optional: implement if lead_access table exists)
      // For now, org_id check is sufficient, but this can be enhanced with granular permissions

      const { data: lead, error: leadError } = leadResult;
      const { data: activeCalls, error: activeCallsError } = activeCallsResult;
      const agentData = agentResult.data as Agent[] | null;
      const { error: agentError } = agentResult;

      // Handle Supabase query errors
      if (activeCallsError) {
        logger.error('Failed to check active calls', { leadId, error: activeCallsError.message });
        res.status(500).json({ error: 'Failed to check call status' });
        return;
      }

      if (agentError && agentError.code !== 'PGRST116') {
        logger.error('Failed to fetch agent', { error: agentError.message });
        res.status(500).json({ error: 'Failed to fetch agent configuration' });
        return;
      }

      if (leadError || !lead) {
        logger.error('Lead not found', { leadId, error: leadError?.message });
        res.status(404).json({ error: 'Lead not found' });
        return;
      }

      logger.debug('Lead fetched', { leadId, phone: maskPhone(lead.phone), name: lead.name });

      // Normalize and validate phone number
      // Remove all whitespace, dashes, parentheses, and other formatting characters
      const phone = (lead.phone || '')
        .trim()
        .replace(/[\s\-()]/g, '');

      if (!phone) {
        logger.warn('Lead has no phone number', { requestId, leadId, name: lead.name });
        res.status(400).json({ error: 'Lead has no phone number', requestId });
        return;
      }

      // FIX #6: Character whitelist - only allow + and digits
      if (!/^[+\d]+$/.test(phone)) {
        logger.warn('Phone contains invalid characters', { requestId, leadId, phone: maskPhone(phone) });
        res.status(400).json({
          error: 'Phone number contains invalid characters. Only digits and + allowed.',
          requestId
        });
        return;
      }

      // FIX #5: Strict E.164 validation - requires 7-15 total digits
      // E.164 format: + followed by country code (1-3 digits) + number (4-12 digits)
      const E164_REGEX = /^\+[1-9]\d{6,14}$/;
      if (!E164_REGEX.test(phone)) {
        logger.warn('Invalid E.164 format', { requestId, leadId, phone: maskPhone(phone) });
        res.status(400).json({
          error: `Invalid phone number format. Expected E.164 format (e.g., +15551234567), got: ${maskPhone(phone)}`,
          requestId
        });
        return;
      }

      // Check if phone number is blacklisted
      const { data: blacklistedPhone, error: blacklistError } = await supabase
        .from('phone_blacklist')
        .select('id')
        .eq('phone', phone)
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();

      // If table doesn't exist (PGRST116) or other non-critical error, log and continue
      if (blacklistError && blacklistError.code !== 'PGRST116') {
        logger.warn('Failed to check phone blacklist', {
          leadId,
          phone: maskPhone(phone),
          error: blacklistError.message
        });
        // Continue anyway - don't block calls due to blacklist check failure
      }

      if (blacklistedPhone) {
        logger.warn('Attempted call to blacklisted phone number', { leadId, phone: maskPhone(phone), orgId });
        res.status(400).json({
          error: 'This phone number is blacklisted and cannot be called'
        });
        return;
      }

      // Check for existing active calls to this lead (prevent duplicate calls)
      if (activeCalls && activeCalls.length > 0) {
        const existingCall = activeCalls[0];

        // STALE LOCK CHECK: If call is 'queued' OR 'ringing' but older than 5 minutes, assume server/webhook failure
        const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
        const calledAt = new Date(existingCall.called_at).getTime();
        const isStale = (Date.now() - calledAt) > STALE_THRESHOLD_MS;

        // Use call_outcome from DB
        // Cover both QUEUED (Server crash pre-dial) and RINGING (Webhook failure)
        const isZombieCandidate = [CallOutcome.QUEUED, CallOutcome.RINGING].includes(existingCall.call_outcome as CallOutcome);

        if (isStale && isZombieCandidate) {
          logger.warn('Found potential zombie lock. Verifying with Vapi before healing.', {
            leadId,
            staleCallId: existingCall.id,
            status: existingCall.call_outcome
          });

          // OPTION 2: PERFECT FIX - Check Vapi for "Ghost Calls" before failing
          // We need to fetch Vapi credentials early to perform this check
          let ghostFound = false;
          try {
            const vapiConfig = await getApiKey('vapi', orgId || 'default');
            const apiKey = process.env.VAPI_API_KEY || vapiConfig?.vapi_api_key;

            if (apiKey) {
              const vapiClient = new VapiClient(apiKey);
              // List recent calls to check if this lead is actually active
              const recentCalls = await vapiClient.listCalls(50);

              // Normalize phone for comparison
              const targetPhone = phone.replace(/\D/g, ''); // Digits only

              if (Array.isArray(recentCalls)) {
                const activeGhost = recentCalls.find((c: any) => {
                  const cPhone = c.customer?.number?.replace(/\D/g, '') || '';
                  const isActive = ['ringing', 'in-progress'].includes(c.status);
                  return cPhone.includes(targetPhone) && isActive;
                });

                if (activeGhost) {
                  ghostFound = true;
                  logger.info('Ghost Call Found! Resurrecting active call.', { vapiId: activeGhost.id });

                  // RESURRECT: Update DB with real Vapi ID and correct status
                  await supabase.from('call_tracking').update({
                    vapi_call_id: activeGhost.id,
                    call_outcome: CallOutcome.IN_PROGRESS,
                    metadata: { ...existingCall.metadata, recovered_from: 'ghost_check' }
                  }).eq('id', existingCall.id);

                  res.status(400).json({
                    error: 'Call is actually active (System state recovered). Please check dashboard.',
                    callId: existingCall.id,
                    recovered: true
                  });
                  return;
                }
              }
            }
          } catch (vapiCheckError) {
            logger.warn('Failed to verify ghosts with Vapi, assuming safe to heal', { error: vapiCheckError });
            // Fall through to heal logic
          }

          if (!ghostFound) {
            // HEAL: No active call found on Vapi. Safe to mark FAILED.
            logger.warn('No ghost call found. Healing stale lock.', { staleCallId: existingCall.id });

            const { error: healError } = await supabase
              .from('call_tracking')
              .update({
                call_outcome: CallOutcome.FAILED,
                metadata: { ...existingCall.metadata, failure_reason: 'stale_lock_auto_recovered' }
              })
              .eq('id', existingCall.id);

            if (healError) {
              logger.error('Failed to heal stale lock', { error: healError.message });
              res.status(500).json({ error: 'System error: Could not clear stale lock' });
              return;
            }
            // PROCEED: Lock cleared.
          }

        } else {
          // Valid active call exists - block the request
          res.status(400).json({
            error: 'Lead already has an active call in progress',
            callId: existingCall.id
          });
          return;
        }
      }

      // Validate outbound agent exists
      const agent = agentData?.[0];
      if (!agent) {
        res.status(400).json({ error: 'No outbound agent configured. Please configure agent settings first.' });
        return;
      }

      // Get Vapi credentials using secrets manager (supports Vault and encryption)
      const vapiConfig = await getApiKey('vapi', orgId || 'default');

      // Always prefer the runtime env key (used by setup scripts) and fall back to stored key
      const vapiApiKey = process.env.VAPI_API_KEY || vapiConfig?.vapi_api_key;

      logger.debug('Vapi credentials check', {
        hasApiKey: !!vapiApiKey,
        source: process.env.VAPI_API_KEY ? 'env' : 'db'
      });

      if (!vapiApiKey) {
        logger.error('Vapi API key not configured', { orgId, provider: 'vapi' });
        const isDebugEnabled = process.env.NODE_ENV === 'development' && process.env.EXPOSE_DEBUG_INFO === 'true';
        res.status(400).json({
          error: 'Vapi API key not configured',
          action: 'Please configure your Vapi credentials in Agent Settings',
          debugInfo: isDebugEnabled ? { orgId, hasKeys: !!vapiConfig } : undefined
        });
        return;
      }

      // Single-number policy: Outbound ALWAYS uses inbound mapping.
      const { data: inboundMapping } = await supabase
        .from('integrations')
        .select('config')
        .eq('org_id', orgId)
        .eq('provider', 'twilio_inbound')
        .maybeSingle();

      const phoneNumberId = (inboundMapping as any)?.config?.vapiPhoneNumberId;

      logger.debug('Phone number ID check', {
        hasPhoneNumberId: !!phoneNumberId
      });

      if (!phoneNumberId) {
        logger.error('Vapi phone number not configured', { orgId });
        const isDebugEnabled = process.env.NODE_ENV === 'development' && process.env.EXPOSE_DEBUG_INFO === 'true';
        res.status(400).json({
          error: 'Vapi phone number not configured',
          action: 'Please complete Inbound Setup to provision your phone number (Inbound Config -> Save & Activate Inbound).',
          debugInfo: isDebugEnabled ? {
            hasInboundMapping: !!(inboundMapping as any)?.config?.vapiPhoneNumberId,
            availableEnvVars: Object.keys(process.env).filter(k => k.includes('VAPI')).join(', ')
          } : undefined
        });
        return;
      }

      // Require agent to already have a Vapi assistant (created by setup script)
      // Allow override from request body for testing/recovery
      const assistantId = assistantIdOverride || agent.vapi_assistant_id;
      logger.debug('Agent assistant check', {
        agentId: agent.id,
        hasAssistantId: !!assistantId,
        isOverride: !!assistantIdOverride
      });

      if (!assistantId) {
        res.status(400).json({
          error: 'No Vapi assistant configured for outbound agent.',
          action:
            'Run the setup-vapi-production script or configure vapi_assistant_id for the outbound agent in the database.'
        });
        return;
      }

      // Get lead's tier from personalization_data
      const leadTier = (lead.personalization_data as any)?.tier || 'C';

      // Build tier-specific prompt
      const tierPrompt = buildTierSpecificPrompt(
        getDefaultPromptConfig(),
        leadTier as 'A' | 'B' | 'C'
      );

      // Build call context
      const callContext = buildCallContextBlock({
        leadName: lead.contact_name || lead.name,
        clinicName: lead.clinic_name || lead.company_name,
        city: lead.city,
        painPoint: lead.personalization_data?.pain_point_identified,
        previousOutcome: 'new_lead',
        notes: lead.notes
      });

      // 1. Insert initial call record (Status: QUEUED) - Prevents "Zombie Calls"
      // This reserves the slot and prevents duplicate calls via DB uniqueness constraint
      const { data: callRecord, error: insertError } = await supabase
        .from('call_tracking')
        .insert({
          org_id: orgId,
          lead_id: leadId,
          agent_id: agent.id,
          phone: phone,
          vapi_call_id: `pending-${requestId}`, // Placeholder to be updated
          called_at: new Date().toISOString(),
          call_outcome: CallOutcome.QUEUED,
          metadata: { call_context: callContext }
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to insert call record', { error: insertError.message, leadId });
        if (insertError.code === '23505') { // Unique violation
          res.status(409).json({ error: 'Call already in progress for this lead' });
          return;
        }
        res.status(500).json({ error: 'Failed to initialize call tracking' });
        return;
      }

      // 2. Create outbound call via Vapi
      let vapiCall;
      const VAPI_TIMEOUT_MS = 30000; // 30 second timeout

      try {
        const vapiClient = new VapiClient(vapiApiKey);

        // Generate idempotency key for deduplication on retries
        const idempotencyKey = `${orgId}-${leadId}-${crypto.randomUUID()}`;

        // BATTLE-TESTED DEBUGGING: Log everything before hitting Vapi
        logger.info('Creating Vapi Outbound Call', {
          step: 'Pre-Vapi-Call',
          requestId,
          assistantId,
          phoneNumberId,
          leadPhone: maskPhone(phone),
          vapiApiKey: vapiApiKey ? 'present' : 'missing',
          orgId,
          idempotencyKey
        });

        vapiCall = await withTimeout(
          vapiClient.createOutboundCall({
            assistantId,
            phoneNumberId,
            idempotencyKey,
            customer: {
              number: phone,
              name: lead.contact_name || lead.name
            },
            assistantOverrides: {
              variableValues: {
                lead_name: lead.contact_name || lead.name || 'there',
                clinic_name: lead.clinic_name || lead.company_name || 'your clinic',
                city: lead.city || 'your area',
                pain_point: lead.personalization_data?.pain_point_identified || '',
                previous_outcome: 'new_lead',
                notes: lead.notes || ''
              },
              metadata: {
                lead_id: lead.id,
                org_id: orgId,
                agent_id: agent.id,
                call_tracking_id: callRecord.id // Link Vapi call back to our DB record
              },
              firstMessage: `Hi ${sanitizeName(lead.contact_name || lead.name || 'there')}, this is ${process.env.COMPANY_NAME || 'CallWaiting AI'} calling on behalf of ${process.env.FOUNDER_NAME || 'Austyn'} from ${process.env.COMPANY_NAME || 'CallWaiting AI'}. We help aesthetic clinics like ${sanitizeName(lead.clinic_name || lead.company_name || 'your clinic')} reduce missed calls and turn more phone calls into booked appointments.`
            }
          }),
          VAPI_TIMEOUT_MS,
          'Vapi API timeout - request took longer than 30 seconds'
        );

        // Validate Vapi response
        if (!vapiCall?.id || typeof vapiCall.id !== 'string') {
          throw new Error('Invalid response from Vapi');
        }

        logger.info('Outbound call created successfully', { vapiCallId: vapiCall.id });

        // 3. Update call record with real Vapi ID
        const { error: updateError } = await supabase
          .from('call_tracking')
          .update({
            vapi_call_id: vapiCall.id,
            // Keep status as QUEUED or update to RINGING? Vapi webhook will update to RINGING/IN_PROGRESS shortly.
            // Keeping as QUEUED is safe.
          })
          .eq('id', callRecord.id);

        if (updateError) {
          logger.error('Failed to update call record with Vapi ID', { callId: callRecord.id, error: updateError.message });
          // Non-fatal, webhook should eventually fix it, or Vapi ID will remain "pending-..." 
        }

        // Sync assistant prompt in background
        syncAssistantPromptInBackground(vapiClient, agent, orgId).catch((err) => {
          logger.warn('Background prompt sync failed', { agentId: agent.id, error: err.message });
        });

      } catch (vapiError: any) {
        logger.error('Vapi Call Rejected', {
          error: vapiError.message,
          status: vapiError.response?.status,
          details: vapiError.response?.data, // CRITICAL: Log the actual Vapi error details
          leadId: lead.id,
          requestId
        });

        // 4. Handle Failure: Mark record as failed
        await supabase
          .from('call_tracking')
          .update({
            call_outcome: CallOutcome.FAILED,
            metadata: {
              ...callRecord.metadata,
              error: vapiError.message,
              vapi_details: vapiError.response?.data
            }
          })
          .eq('id', callRecord.id);

        res.status(500).json({
          error: 'Vapi Refused Call',
          details: vapiError.response?.data || vapiError.message,
          requestId,
          hint: 'Check Vapi Dashboard Logs or Backend Logs for "Vapi Call Rejected"'
        });
        return;
      }

      // Broadcast WebSocket event
      wsBroadcast({
        type: 'call_status',
        vapiCallId: vapiCall.id,
        trackingId: callRecord.id,
        userId: callRecord.metadata?.userId,
        status: 'connecting'
      });

      res.json({
        success: true,
        call: {
          id: callRecord.id,
          vapiCallId: vapiCall.id,
          status: 'queued'
        },
        message: 'Call initiated successfully'
      });
    } catch (error: any) {
      logger.exception('Unexpected error in startCall', error);
      const isDebugEnabled = process.env.NODE_ENV === 'development' && process.env.EXPOSE_DEBUG_INFO === 'true';
      res.status(500).json({
        error: 'An unexpected error occurred',
        details: isDebugEnabled ? error.message : undefined,
        debugInfo: isDebugEnabled ? error.stack : undefined
      });
    }
  });

/**
 * POST /api/founder-console/calls/end
 * Manually end an active call
 * Requires authentication to prevent unauthorized call termination
 */
router.post('/calls/end', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = generateRequestId();

  try {
    const { callId } = req.body;

    if (!callId) {
      res.status(400).json({ error: 'callId is required', requestId });
      return;
    }

    // Look up by vapi_call_id (what frontend sends)
    const { data: callRecord, error: lookupError } = await supabase
      .from('call_tracking')
      .select('*')
      .eq('vapi_call_id', callId)
      .maybeSingle();

    if (lookupError && lookupError.code !== 'PGRST116') {
      logger.error('Failed to lookup call', { callId, error: lookupError.message, requestId });
      res.status(500).json({ error: 'Failed to lookup call', requestId });
      return;
    }

    if (!callRecord) {
      res.status(404).json({ error: 'Call not found', requestId });
      return;
    }

    // Verify user owns this call (check userId in metadata)
    if (callRecord.metadata?.userId && callRecord.metadata.userId !== req.user?.id) {
      logger.warn('Unauthorized call end attempt', { callId, userId: req.user?.id, requestId });
      res.status(403).json({ error: 'Unauthorized', requestId });
      return;
    }

    // Update call status using correct DB id
    const { error: updateError } = await supabase
      .from('call_tracking')
      .update({
        call_outcome: CallOutcome.CANCELLED,
        metadata: { ...callRecord.metadata, manually_ended: true, ended_at: new Date().toISOString() }
      })
      .eq('id', callRecord.id);

    if (updateError) {
      logger.error('Failed to update call', { callId, error: updateError.message, requestId });
      res.status(500).json({ error: 'Failed to end call', requestId });
      return;
    }

    // Broadcast WebSocket event with userId filter
    wsBroadcast({
      type: 'call_ended',
      vapiCallId: callRecord.vapi_call_id,
      trackingId: callRecord.id,
      userId: callRecord.metadata?.userId,
      reason: 'user_ended'
    });

    logger.info('Call ended by user', { callId, userId: req.user?.id, requestId });
    res.status(204).send();
  } catch (error: any) {
    logger.exception('Failed to end call', error, { requestId });
    res.status(500).json({ error: error.message, requestId });
  }
});

/**
 * GET /api/founder-console/calls/recent
 * Return recent call history for analytics
 * Security: Filters by org_id to prevent cross-tenant data access
 */
router.get('/calls/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = getPaginationParams(req.query);

    // Get the first/default organization for filtering
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    const orgId = org?.id;

    if (!orgId) {
      errorResponse(res, 400, 'Organization not initialized');
      return;
    }

    const { data: calls, error } = await supabase
      .from('call_tracking')
      .select(`
        id,
        lead_id,
        called_at,
        duration_seconds,
        call_outcome,
        answered,
        voicemail,
        leads (
          contact_name,
          name,
          clinic_name,
          company_name
        )
      `)
      .eq('org_id', orgId)
      .order('called_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Map to frontend shape
    const mappedCalls = (calls || []).map(call => {
      const lead = call.leads as any;
      const duration = call.duration_seconds || 0;

      return {
        id: call.id,
        leadName: lead?.contact_name || lead?.name || 'Unknown',
        clinicName: lead?.clinic_name || lead?.company_name || 'Unknown Clinic',
        outcome: call.call_outcome || (call.answered ? 'answered' : call.voicemail ? 'voicemail' : 'no_answer'),
        durationSeconds: duration,
        calledAt: call.called_at
      };
    });

    res.json(mappedCalls);
  } catch (error: any) {
    logger.exception('Failed to get recent calls', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CSV LEAD IMPORT ENDPOINTS
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * POST /api/founder-console/leads/csv/validate
 * Validate a CSV file before import (preview headers, sample rows, detect issues)
 */
router.post('/leads/csv/validate', upload.single('file'), async (req: Request & { file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } }, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const result = await validateCsv(req.file.buffer);

    res.json({
      valid: result.valid,
      errors: result.errors,
      headers: result.headers,
      sampleRows: result.sampleRows,
      totalRows: result.totalRows,
      suggestedMapping: result.suggestedMapping,
    });
  } catch (error: any) {
    logger.exception('CSV validation failed', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/founder-console/leads/csv/import
 * Import leads from a CSV file
 * Body: multipart/form-data with 'file' and optional 'dedupeMode', 'columnMapping'
 */
router.post('/leads/csv/import', upload.single('file'), async (req: Request & { file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } }, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Get org ID
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org?.id) {
      res.status(400).json({ error: 'Organization not initialized' });
      return;
    }

    const dedupeMode = (req.body.dedupeMode || 'skip') as 'skip' | 'update' | 'create';
    const columnMapping = req.body.columnMapping ? JSON.parse(req.body.columnMapping) : undefined;

    const result = await importCsvLeads(req.file.buffer, {
      orgId: org.id,
      dedupeMode,
      columnMapping,
      uploadedBy: req.body.uploadedBy || 'api',
      uploadedIp: req.ip,
    });

    res.json(result);
  } catch (error: any) {
    logger.exception('CSV import failed', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/founder-console/leads/imports
 * List recent imports for the organization
 */
router.get('/leads/imports', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org?.id) {
      res.status(400).json({ error: 'Organization not initialized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const imports = await listImports(org.id, limit);

    res.json(imports);
  } catch (error: any) {
    logger.exception('Failed to list imports', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/founder-console/leads/imports/:importId
 * Get status of a specific import
 */
router.get('/leads/imports/:importId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { importId } = req.params;

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org?.id) {
      res.status(400).json({ error: 'Organization not initialized' });
      return;
    }

    const importRecord = await getImportStatus(importId, org.id);

    if (!importRecord) {
      res.status(404).json({ error: 'Import not found' });
      return;
    }

    res.json(importRecord);
  } catch (error: any) {
    logger.exception('Failed to get import status', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/founder-console/leads/imports/:importId/errors
 * Get errors for a specific import
 */
router.get('/leads/imports/:importId/errors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { importId } = req.params;

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org?.id) {
      res.status(400).json({ error: 'Organization not initialized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const errors = await getImportErrors(importId, org.id, limit);

    res.json(errors);
  } catch (error: any) {
    logger.exception('Failed to get import errors', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/founder-console/calls/:trackingId/state
 * Get current call state and transcript history for WS reconnect recovery
 * 
 * Allows clients to fetch the latest state when reconnecting after network outage.
 * Returns call status, transcript deltas, and other metadata needed to resume live updates.
 */
router.get(
  '/calls/:trackingId/state',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { trackingId } = req.params;

      // Fetch call tracking
      const { data: tracking, error: trackingError } = await supabase
        .from('call_tracking')
        .select('id, vapi_call_id, status, metadata, started_at, ended_at, duration_seconds')
        .eq('id', trackingId)
        .maybeSingle();

      if (trackingError) {
        console.error('[GET /calls/:trackingId/state] Error fetching call tracking:', trackingError);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      if (!tracking) {
        res.status(404).json({ error: 'Call not found' });
        return;
      }

      // Fetch transcript history (source of truth)
      const { data: transcripts, error: transcriptError } = await supabase
        .from('call_transcripts')
        .select('id, speaker, text, timestamp')
        .eq('call_id', trackingId)
        .order('timestamp', { ascending: true });

      if (transcriptError) {
        console.error('[GET /calls/:trackingId/state] Error fetching transcripts:', transcriptError);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      // Return snapshot for client to resume from
      res.status(200).json({
        trackingId: tracking.id,
        vapiCallId: tracking.vapi_call_id,
        status: tracking.status,
        metadata: tracking.metadata,
        startedAt: tracking.started_at,
        endedAt: tracking.ended_at,
        durationSeconds: tracking.duration_seconds,
        transcripts: (transcripts || []).map(t => ({
          speaker: t.speaker,
          text: t.text,
          timestamp: t.timestamp
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[GET /calls/:trackingId/state] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/founder-console/leads/imports/:importId/errors/download
 * Download errors as CSV for correction and re-upload
 */
router.get('/leads/imports/:importId/errors/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const { importId } = req.params;

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org?.id) {
      res.status(400).json({ error: 'Organization not initialized' });
      return;
    }

    const csv = await generateErrorCsv(importId, org.id);

    if (!csv) {
      res.status(404).json({ error: 'No errors found for this import' });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${importId}.csv"`);
    res.send(csv);
  } catch (error: any) {
    logger.exception('Failed to download import errors', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
