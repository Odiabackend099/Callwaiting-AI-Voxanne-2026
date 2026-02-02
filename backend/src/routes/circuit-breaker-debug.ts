import { Router, Request, Response } from 'express';
import { getCircuitBreakerStatus } from '../services/safe-call';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/debug/circuit-breakers
 * Returns status of all circuit breakers (for diagnostics)
 */
router.get('/circuit-breakers', requireAuth, (req: Request, res: Response) => {
  try {
    const status = getCircuitBreakerStatus();

    const formatted = Object.entries(status).map(([name, state]) => ({
      service: name,
      isOpen: state.isOpen,
      failures: state.failures,
      lastFailureTime: new Date(state.lastFailureTime).toISOString(),
      secondsSinceLastFailure: Math.floor((Date.now() - state.lastFailureTime) / 1000),
      willRetryIn: state.isOpen
        ? Math.max(0, 30 - Math.floor((Date.now() - state.lastFailureTime) / 1000))
        : 0
    }));

    return res.json({
      circuitBreakers: formatted,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to get circuit breaker status',
      message: error.message
    });
  }
});

/**
 * POST /api/debug/circuit-breakers/:serviceName/reset
 * Manually reset a circuit breaker (for emergencies)
 */
router.post('/circuit-breakers/:serviceName/reset', requireAuth, (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;

    // Import resetCircuitBreaker dynamically to avoid circular dependencies
    const { resetCircuitBreaker } = require('../services/safe-call');

    resetCircuitBreaker(serviceName);

    return res.json({
      success: true,
      message: `Circuit breaker for ${serviceName} has been manually reset`,
      service: serviceName
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error.message
    });
  }
});

/**
 * GET /api/debug/twilio-credentials
 * Verify Twilio credentials are configured (does NOT test sending)
 */
router.get('/twilio-credentials', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user?.orgId;
  if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { IntegrationDecryptor } = require('../services/integration-decryptor');
    const credentials = await IntegrationDecryptor.getTwilioCredentials(orgId);

    if (!credentials) {
      return res.json({
        configured: false,
        error: 'Twilio credentials not found for organization'
      });
    }

    // Verify credentials are present (don't log actual values)
    const checks = {
      hasAccountSid: !!credentials.accountSid && credentials.accountSid.length > 0,
      hasAuthToken: !!credentials.authToken && credentials.authToken.length > 0,
      hasPhoneNumber: !!credentials.phoneNumber && credentials.phoneNumber.length > 0,
      phoneNumberFormat: credentials.phoneNumber?.startsWith('+') ? 'valid (E.164)' : 'invalid (missing +)'
    };

    return res.json({
      configured: true,
      checks,
      allValid: Object.values(checks).every(v => v === true || v === 'valid (E.164)')
    });
  } catch (error: any) {
    return res.status(500).json({
      configured: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/health
 * Overall system health check
 */
router.get('/health', requireAuth, (req: Request, res: Response) => {
  try {
    const status = getCircuitBreakerStatus();

    // Count open circuit breakers
    const openCircuits = Object.values(status).filter(state => state.isOpen).length;
    const totalCircuits = Object.keys(status).length;

    return res.json({
      status: openCircuits === 0 ? 'healthy' : 'degraded',
      openCircuits,
      totalCircuits,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

export default router;
