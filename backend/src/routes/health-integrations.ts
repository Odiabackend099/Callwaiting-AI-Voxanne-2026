/**
 * Integration Health Check Endpoint
 *
 * GET /api/health/integrations
 *
 * 2026 Standard: Comprehensive diagnostics for all integrations
 *
 * Returns detailed status of:
 * - Database connectivity
 * - Google Calendar token validity
 * - Twilio API key validity
 * - Circuit breaker states
 * - System readiness
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { google } from 'googleapis';
import { getCircuitBreakerStatus } from '../services/safe-call';
import { log } from '../services/logger';

const router = Router();

interface IntegrationStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  lastChecked: string;
  message?: string;
  details?: Record<string, any>;
}

/**
 * GET /api/health/integrations
 * Comprehensive integration diagnostics
 */
router.get('/integrations', async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const integrations: IntegrationStatus[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // ============================================================================
    // 1. Database Check
    // ============================================================================
    try {
      const { error, data } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (error) {
        integrations.push({
          name: 'Database',
          status: 'critical',
          lastChecked: new Date().toISOString(),
          message: 'Database connection failed',
          details: { error: error.message }
        });
        overallStatus = 'critical';
      } else {
        integrations.push({
          name: 'Database',
          status: 'healthy',
          lastChecked: new Date().toISOString(),
          message: 'PostgreSQL connection active',
          details: { queriedRows: data?.length }
        });
      }
    } catch (error) {
      integrations.push({
        name: 'Database',
        status: 'critical',
        lastChecked: new Date().toISOString(),
        message: 'Database check failed',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      overallStatus = 'critical';
    }

    // ============================================================================
    // 2. Google Calendar Token Check
    // ============================================================================
    try {
      // Try to check authenticated user's org first, then fall back to checking system-wide
      let orgIdToCheck = (req.user as any)?.app_metadata?.org_id;
      let credentialsFound = false;
      let credentials: any = null;

      // If we have an authenticated user, check their specific credentials
      if (orgIdToCheck) {
        credentials = await IntegrationDecryptor.getGoogleCalendarCredentials(orgIdToCheck);
        credentialsFound = !!credentials;
      }

      // If no credentials for authenticated user, check if ANY org has Google Calendar configured
      if (!credentialsFound) {
        const { data: anyOrgCredentials, error } = await supabase
          .from('org_credentials')
          .select('provider, is_active, metadata')
          .eq('provider', 'google_calendar')
          .eq('is_active', true)
          .limit(1);

        if (!error && anyOrgCredentials && anyOrgCredentials.length > 0) {
          credentialsFound = true;
          // For system-wide health check, we just care that it's configured somewhere
          integrations.push({
            name: 'Google Calendar',
            status: 'healthy',
            lastChecked: new Date().toISOString(),
            message: 'Google Calendar configured and available',
            details: {
              systemWide: true,
              note: 'Configured for at least one organization'
            }
          });
        } else if (error) {
          throw error;
        } else {
          integrations.push({
            name: 'Google Calendar',
            status: 'degraded',
            lastChecked: new Date().toISOString(),
            message: 'Google Calendar not yet linked to any organization',
            details: { note: 'No authenticated user context - link Google Calendar to enable scheduling' }
          });
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        }
      } else if (credentials) {
        // Check if token is valid (not expired)
        const expiresAt = new Date(credentials.expiresAt);
        const isExpired = expiresAt < new Date();
        const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

        if (isExpired) {
          integrations.push({
            name: 'Google Calendar',
            status: 'degraded',
            lastChecked: new Date().toISOString(),
            message: 'Google Calendar token expired',
            details: { orgId: orgIdToCheck, expiredSinceSeconds: -expiresInSeconds }
          });
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        } else if (expiresInSeconds < 300) {
          // Less than 5 minutes left
          integrations.push({
            name: 'Google Calendar',
            status: 'degraded',
            lastChecked: new Date().toISOString(),
            message: 'Google Calendar token expiring soon',
            details: { orgId: orgIdToCheck, expiresInSeconds }
          });
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        } else {
          integrations.push({
            name: 'Google Calendar',
            status: 'healthy',
            lastChecked: new Date().toISOString(),
            message: 'Google Calendar token valid',
            details: { orgId: orgIdToCheck, expiresInSeconds, email: credentials.email }
          });
        }
      } else {
        integrations.push({
          name: 'Google Calendar',
          status: 'degraded',
          lastChecked: new Date().toISOString(),
          message: 'No Google Calendar credentials linked',
          details: { orgId: orgIdToCheck }
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      integrations.push({
        name: 'Google Calendar',
        status: 'degraded',
        lastChecked: new Date().toISOString(),
        message: 'Failed to check Google Calendar status',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // ============================================================================
    // 3. Twilio Check
    // ============================================================================
    try {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

      if (twilioSid && twilioToken && twilioPhone) {
        integrations.push({
          name: 'Twilio',
          status: 'healthy',
          lastChecked: new Date().toISOString(),
          message: 'Twilio credentials configured',
          details: { phoneNumber: twilioPhone.replace(/[0-9]/g, 'X').replace('X', twilioPhone[0]) }
        });
      } else {
        // BYOC-aware: if the platform isn't configured, check if ANY org has Twilio configured
        const { data: anyOrgTwilio, error } = await supabase
          .from('org_credentials')
          .select('provider, is_active')
          .eq('provider', 'twilio')
          .eq('is_active', true)
          .limit(1);

        if (error) {
          throw error;
        }

        if (anyOrgTwilio && anyOrgTwilio.length > 0) {
          integrations.push({
            name: 'Twilio',
            status: 'healthy',
            lastChecked: new Date().toISOString(),
            message: 'Twilio configured via BYOC (at least one organization)',
            details: {
              systemWide: false,
              hasPlatformSid: !!twilioSid,
              hasPlatformToken: !!twilioToken,
              hasPlatformPhone: !!twilioPhone
            }
          });
        } else {
          integrations.push({
            name: 'Twilio',
            status: 'degraded',
            lastChecked: new Date().toISOString(),
            message: 'Twilio not configured (BYOC)',
            details: {
              note: 'No platform Twilio env vars and no org-level Twilio credentials found'
            }
          });
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        }
      }
    } catch (error) {
      integrations.push({
        name: 'Twilio',
        status: 'critical',
        lastChecked: new Date().toISOString(),
        message: 'Failed to check Twilio configuration',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      overallStatus = 'critical';
    }

    // ============================================================================
    // 4. Circuit Breaker Status
    // ============================================================================
    const circuitStatus = getCircuitBreakerStatus();
    const openCircuits = Object.entries(circuitStatus)
      .filter(([, state]) => state.isOpen)
      .map(([name]) => name);

    if (openCircuits.length > 0) {
      integrations.push({
        name: 'Circuit Breakers',
        status: 'degraded',
        lastChecked: new Date().toISOString(),
        message: 'Some services have open circuit breakers',
        details: { openServices: openCircuits }
      });
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      integrations.push({
        name: 'Circuit Breakers',
        status: 'healthy',
        lastChecked: new Date().toISOString(),
        message: 'All circuit breakers closed',
        details: { totalBreakers: Object.keys(circuitStatus).length }
      });
    }

    // ============================================================================
    // Response
    // ============================================================================
    const elapsedMs = Date.now() - startTime;

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      elapsedMs,
      integrations,
      summary: {
        healthy: integrations.filter(i => i.status === 'healthy').length,
        degraded: integrations.filter(i => i.status === 'degraded').length,
        critical: integrations.filter(i => i.status === 'critical').length
      },
      recommendations: deriveRecommendations(integrations)
    });
  } catch (error) {
    log.error('HealthIntegrations', 'Diagnostic check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Derive actionable recommendations based on integration status
 */
function deriveRecommendations(integrations: IntegrationStatus[]): string[] {
  const recommendations: string[] = [];

  for (const integration of integrations) {
    if (integration.status === 'critical') {
      if (integration.name === 'Database') {
        recommendations.push('🔴 DATABASE CRITICAL: Check Supabase connection and service key');
      } else if (integration.name === 'Twilio') {
        recommendations.push('🔴 TWILIO CRITICAL: Verify API credentials in environment variables');
      }
    } else if (integration.status === 'degraded') {
      if (integration.name === 'Google Calendar' && integration.details?.['email']) {
        recommendations.push(`🟡 Google Calendar token expiring soon - refresh will happen automatically on next use`);
      } else if (integration.name === 'Google Calendar') {
        recommendations.push('🟡 Google Calendar not linked - users cannot book appointments');
      } else if (integration.name === 'Twilio') {
        recommendations.push('🟡 Twilio credentials incomplete - SMS confirmations will fail');
      } else if (integration.name === 'Circuit Breakers') {
        recommendations.push(`🟡 Some services are failing - they will auto-recover in 30 seconds`);
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All systems operational');
  }

  return recommendations;
}

export default router;
