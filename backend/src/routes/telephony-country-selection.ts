/**
 * Telephony Country Selection API Routes (NEW - 2026-01-30)
 *
 * Handles country selection for Global Hybrid Telephony Infrastructure
 * This is the first step in the new 6-step wizard flow
 *
 * Endpoints:
 * - POST /api/telephony/select-country - Select user's country
 * - GET /api/telephony/supported-countries - List all supported countries
 * - GET /api/telephony/carriers/:countryCode - Get carriers for country
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAuthOrDev } from '../middleware/auth';
import { orgRateLimit } from '../middleware/org-rate-limiter';
import { log } from '../services/logger';
import * as GSMCodeGeneratorV2 from '../services/gsm-code-generator-v2';

const router = Router();

// ============================================
// CONSTANTS
// ============================================

// Whitelist of supported country codes (ISO 3166-1 alpha-2)
// This provides defense-in-depth alongside database `is_active` checks
const SUPPORTED_COUNTRY_CODES = ['US', 'GB', 'NG', 'TR'] as const;

/**
 * Validate country code against whitelist
 * @param countryCode - ISO 3166-1 alpha-2 code
 * @returns True if country is supported
 */
function isSupportedCountry(countryCode: string): boolean {
  return SUPPORTED_COUNTRY_CODES.includes(countryCode as any);
}

// ============================================
// COUNTRY SELECTION ENDPOINTS
// ============================================

/**
 * POST /api/telephony/select-country
 * Step 1 of new wizard flow: User selects their country
 *
 * Request Body:
 * {
 *   "countryCode": "NG" // ISO 3166-1 alpha-2
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "countryName": "Nigeria",
 *   "recommendedProvisionCountry": "US",
 *   "availableCarriers": [
 *     { "slug": "glo", "displayName": "Glo" },
 *     { "slug": "mtn", "displayName": "Mtn" }
 *   ],
 *   "warning": "⚠️ IMPORTANT: For standard rates...",
 *   "requestId": "req_1234567890"
 * }
 */
router.post(
  '/select-country',
  orgRateLimit, // Rate limiting: 1000 req/hr per org, 100 req/15min per IP
  requireAuthOrDev,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId || `req_${Date.now()}`;

    try {
      const orgId = req.user?.orgId;
      const { countryCode } = req.body;

      // Validation
      if (!orgId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      if (!countryCode) {
        res.status(400).json({
          error: 'countryCode is required (ISO 3166-1 alpha-2 format, e.g., "NG", "US")',
          requestId,
        });
        return;
      }

      // Validate country code format (2 uppercase letters)
      if (!/^[A-Z]{2}$/.test(countryCode)) {
        res.status(400).json({
          error: 'Invalid countryCode format. Must be 2 uppercase letters (e.g., "NG", "US")',
          requestId,
        });
        return;
      }

      // Validate country code against whitelist (defense-in-depth)
      if (!isSupportedCountry(countryCode)) {
        res.status(400).json({
          error: `Country ${countryCode} is not supported. Supported countries: ${SUPPORTED_COUNTRY_CODES.join(', ')}`,
          requestId,
        });
        return;
      }

      log.info('TelephonyCountrySelection', 'Country selection requested', {
        orgId,
        countryCode,
        requestId,
      });

      // Step 1: Validate country is supported and active
      const { data: countryRules, error: countryError } = await supabaseAdmin
        .from('carrier_forwarding_rules')
        .select('country_name, recommended_twilio_country, carrier_codes, warning_message')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single();

      if (countryError || !countryRules) {
        log.error('TelephonyCountrySelection', 'Country not supported', {
          orgId,
          countryCode,
          error: countryError,
          requestId,
        });
        res.status(400).json({
          error: `Country ${countryCode} not supported. Supported countries: US, GB, NG, TR`,
          requestId,
        });
        return;
      }

      // Step 2: Update organization's telephony_country with optimistic locking
      // Fetch current updated_at timestamp first to prevent race conditions
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('updated_at')
        .eq('id', orgId)
        .single();

      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update({
          telephony_country: countryCode,
          updated_at: new Date().toISOString() // Trigger optimistic locking
        })
        .eq('id', orgId)
        .eq('updated_at', currentOrg?.updated_at); // Only update if not modified since read

      if (updateError) {
        log.error('TelephonyCountrySelection', 'Failed to update organization', {
          orgId,
          countryCode,
          error: updateError,
          requestId,
        });
        res.status(500).json({
          error: 'Failed to save country selection',
          requestId,
        });
        return;
      }

      // Step 3: Extract available carriers from JSONB
      const availableCarriers = Object.keys(countryRules.carrier_codes).map((key) => ({
        slug: key,
        displayName: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      }));

      log.info('TelephonyCountrySelection', 'Country selected successfully', {
        orgId,
        countryCode,
        countryName: countryRules.country_name,
        carrierCount: availableCarriers.length,
        requestId,
      });

      // Step 4: Return country details with carriers and warning
      res.status(200).json({
        success: true,
        countryName: countryRules.country_name,
        recommendedProvisionCountry: countryRules.recommended_twilio_country,
        availableCarriers,
        warning: countryRules.warning_message || null,
        requestId,
      });
    } catch (error: any) {
      log.error('TelephonyCountrySelection', 'Unexpected error', {
        error: error.message,
        stack: error.stack,
        requestId,
      });
      res.status(500).json({
        error: 'Internal server error',
        requestId,
      });
    }
  }
);

/**
 * GET /api/telephony/supported-countries
 * Get list of all supported countries for telephony
 *
 * Response:
 * {
 *   "success": true,
 *   "countries": [
 *     {
 *       "code": "NG",
 *       "name": "Nigeria",
 *       "recommendedProvisionCountry": "US"
 *     }
 *   ],
 *   "requestId": "req_1234567890"
 * }
 */
router.get(
  '/supported-countries',
  orgRateLimit, // Rate limiting: 1000 req/hr per org, 100 req/15min per IP
  requireAuthOrDev,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId || `req_${Date.now()}`;

    try {
      const orgId = req.user?.orgId;

      if (!orgId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      // Fetch all active countries
      const countries = await GSMCodeGeneratorV2.default.getSupportedCountries();

      log.info('TelephonyCountrySelection', 'Supported countries fetched', {
        orgId,
        countryCount: countries.length,
        requestId,
      });

      res.status(200).json({
        success: true,
        countries,
        requestId,
      });
    } catch (error: any) {
      log.error('TelephonyCountrySelection', 'Failed to fetch countries', {
        error: error.message,
        requestId,
      });
      res.status(500).json({
        error: 'Internal server error',
        requestId,
      });
    }
  }
);

/**
 * GET /api/telephony/carriers/:countryCode
 * Get available carriers for a specific country
 *
 * Path Params:
 * - countryCode: ISO 3166-1 alpha-2 (e.g., "NG", "US")
 *
 * Response:
 * {
 *   "success": true,
 *   "countryCode": "NG",
 *   "countryName": "Nigeria",
 *   "carriers": [
 *     { "slug": "glo", "displayName": "Glo" },
 *     { "slug": "mtn", "displayName": "Mtn" }
 *   ],
 *   "warning": "⚠️ IMPORTANT: For standard rates...",
 *   "requestId": "req_1234567890"
 * }
 */
router.get(
  '/carriers/:countryCode',
  orgRateLimit, // Rate limiting: 1000 req/hr per org, 100 req/15min per IP
  requireAuthOrDev,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId || `req_${Date.now()}`;

    try {
      const orgId = req.user?.orgId;
      const { countryCode } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Not authenticated', requestId });
        return;
      }

      if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
        res.status(400).json({
          error: 'Invalid countryCode format. Must be 2 uppercase letters (e.g., "NG", "US")',
          requestId,
        });
        return;
      }

      // Validate country code against whitelist (defense-in-depth)
      if (!isSupportedCountry(countryCode)) {
        res.status(400).json({
          error: `Country ${countryCode} is not supported. Supported countries: ${SUPPORTED_COUNTRY_CODES.join(', ')}`,
          requestId,
        });
        return;
      }

      // Fetch carriers for country
      const carriers = await GSMCodeGeneratorV2.default.getAvailableCarriers(countryCode);
      const warning = await GSMCodeGeneratorV2.default.getCountryWarning(countryCode);

      if (carriers.length === 0) {
        res.status(404).json({
          error: `No carriers found for country ${countryCode}`,
          requestId,
        });
        return;
      }

      // Get country name from database
      const { data: countryData } = await supabaseAdmin
        .from('carrier_forwarding_rules')
        .select('country_name')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single();

      log.info('TelephonyCountrySelection', 'Carriers fetched for country', {
        orgId,
        countryCode,
        carrierCount: carriers.length,
        requestId,
      });

      res.status(200).json({
        success: true,
        countryCode,
        countryName: countryData?.country_name || countryCode,
        carriers,
        warning: warning || null,
        requestId,
      });
    } catch (error: any) {
      log.error('TelephonyCountrySelection', 'Failed to fetch carriers', {
        error: error.message,
        requestId,
      });
      res.status(500).json({
        error: 'Internal server error',
        requestId,
      });
    }
  }
);

export default router;
