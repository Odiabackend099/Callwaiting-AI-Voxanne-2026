import { Router } from 'express';
import { VerificationService } from '../services/verification';
import { authenticateRequest } from '../middleware/auth';
import { createLogger } from '../services/logger';

const router = Router();
const logger = createLogger('VerificationRoutes');

/**
 * TRIGGER Pre-Flight Check
 * POST /api/verification/pre-flight
 */
router.post('/pre-flight', authenticateRequest, async (req, res) => {
    try {
        const { orgId } = req.user!;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        logger.info('Starting Pre-Flight check', { orgId });

        const result = await VerificationService.runPreFlightCheck(orgId);

        return res.json(result);

    } catch (error: any) {
        logger.error('Pre-Flight check failed to run', { error: error.message });
        return res.status(500).json({ error: 'Internal server error during verification' });
    }
});

export default router;
