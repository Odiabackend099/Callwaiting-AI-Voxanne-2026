import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { SessionManagementService } from '../services/session-management';
import { MFAService } from '../services/mfa-service';

const router = express.Router();

// Rate limiting for authentication endpoints to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Stricter rate limiting for MFA verification (6-digit codes can be brute forced)
const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 code attempts per window
  message: 'Too many MFA verification attempts. Please try again in 5 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Get active sessions for current user
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await SessionManagementService.getActiveSessions(userId);
    res.json({ sessions });
  } catch (error: any) {
    console.error('Failed to fetch sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Revoke specific session
 */
router.delete('/sessions/:sessionId', authLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    const { reason } = req.body;

    await SessionManagementService.revokeSession(
      sessionId,
      reason || 'User revoked session'
    );

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error: any) {
    console.error('Failed to revoke session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Logout from all devices (except current)
 */
router.post('/sessions/revoke-all', authLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentSessionId } = req.body;

    await SessionManagementService.revokeAllOtherSessions(userId, currentSessionId);

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (error: any) {
    console.error('Failed to revoke all sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get authentication audit log
 */
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const auditLog = await SessionManagementService.getAuditLog(userId, limit);

    res.json({ auditLog });
  } catch (error: any) {
    console.error('Failed to fetch audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get failed login attempts (security monitoring)
 */
router.get('/security/failed-logins', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hours = parseInt(req.query.hours as string) || 24;
    const attempts = await SessionManagementService.getFailedLoginAttempts(userId, hours);

    res.json({ failedAttempts: attempts });
  } catch (error: any) {
    console.error('Failed to fetch failed login attempts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate MFA secret for enrollment
 */
router.post('/mfa/enroll', authLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;

    if (!userId || !email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const mfaData = await MFAService.generateMFASecret(userId, email);

    res.json({
      secret: mfaData.secret,
      qrCode: mfaData.qrCode,
      otpauthUrl: mfaData.otpauthUrl,
    });
  } catch (error: any) {
    console.error('Failed to generate MFA secret:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify MFA code during enrollment
 */
router.post('/mfa/verify-enrollment', authLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { secret, code } = req.body;

    if (!secret || !code) {
      return res.status(400).json({ error: 'Secret and code are required' });
    }

    const isValid = MFAService.verifyTOTP(secret, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate recovery codes
    const recoveryCodes = MFAService.generateRecoveryCodes(10);

    // Log MFA enabled event
    await SessionManagementService.logAuthEvent(
      userId,
      orgId,
      'mfa_enabled',
      { method: 'totp' }
    );

    res.json({
      success: true,
      recoveryCodes,
      message: 'MFA enabled successfully',
    });
  } catch (error: any) {
    console.error('Failed to verify MFA enrollment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify MFA code during login
 */
router.post('/mfa/verify-login', mfaLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { secret, code } = req.body;

    if (!secret || !code) {
      return res.status(400).json({ error: 'Secret and code are required' });
    }

    const isValid = MFAService.verifyTOTP(secret, code);

    if (isValid) {
      // Log successful MFA challenge
      await SessionManagementService.logAuthEvent(
        userId,
        orgId,
        'mfa_challenge_success',
        { method: 'totp' }
      );

      res.json({ success: true, message: 'MFA verification successful' });
    } else {
      // Log failed MFA challenge
      await SessionManagementService.logAuthEvent(
        userId,
        orgId,
        'mfa_challenge_failed',
        { method: 'totp' }
      );

      res.status(400).json({ error: 'Invalid verification code' });
    }
  } catch (error: any) {
    console.error('Failed to verify MFA login:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check if user has MFA enabled
 */
router.get('/mfa/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isEnabled = await MFAService.isMFAEnabled(userId);
    const factors = await MFAService.getMFAFactors(userId);

    res.json({
      mfaEnabled: isEnabled,
      factors: factors.map((f: any) => ({
        id: f.id,
        type: f.factor_type,
        status: f.status,
        createdAt: f.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Failed to check MFA status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Disable MFA (admin only or with proper verification)
 */
router.delete('/mfa/:factorId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { factorId } = req.params;

    await MFAService.disableMFA(userId, factorId);

    // Log MFA disabled event
    await SessionManagementService.logAuthEvent(
      userId,
      orgId,
      'mfa_disabled',
      { factorId }
    );

    res.json({ success: true, message: 'MFA disabled successfully' });
  } catch (error: any) {
    console.error('Failed to disable MFA:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
