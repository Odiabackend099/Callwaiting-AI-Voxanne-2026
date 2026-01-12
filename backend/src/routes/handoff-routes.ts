
import { Router } from 'express';
import { handoffService, HandoffContext } from '../services/handoff-service';
import { log } from '../services/logger';

const router = Router();

// Middleware to extract arguments regardless of Vapi payload format
const extractArgs = (req: any) => {
    return req.body.toolCall?.arguments || req.body;
};

// 1. Update Handoff State (Called by Sarah)
router.post('/update', async (req, res) => {
    try {
        const context = extractArgs(req) as HandoffContext;

        if (!context.sessionId || !context.tenantId || !context.patient?.phoneNumber) {
            return res.status(400).json({ error: 'Missing required context fields (sessionId, tenantId, patient.phoneNumber)' });
        }

        log.info('HandoffAPI', 'Updating handoff state', { sessionId: context.sessionId, status: context.status });

        await handoffService.updateHandoffState(context);

        res.json({ result: "Handoff state updated successfully." });

    } catch (error: any) {
        log.error('HandoffAPI', 'Error updating handoff', { error: error.message });
        res.status(500).json({ error: 'Failed to update handoff state.', details: error.message || error });
    }
});

// 2. Get Context (Called by Voxan / Backend Context Injection)
router.get('/context', async (req, res) => {
    try {
        const { tenantId, patientPhone } = req.query;

        if (!tenantId || !patientPhone) {
            return res.status(400).json({ error: 'Missing tenantId or patientPhone query params' });
        }

        log.info('HandoffAPI', 'Fetching context', { tenantId, patientPhone });

        const context = await handoffService.getHandoffContext(String(tenantId), String(patientPhone));

        if (!context) {
            return res.json({ found: false, message: "No active handoff context found." });
        }

        res.json({ found: true, context });

    } catch (error: any) {
        log.error('HandoffAPI', 'Error fetching context', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch handoff context.' });
    }
});

export default router;
