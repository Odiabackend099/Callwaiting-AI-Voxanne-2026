import { Router } from 'express';
import { VapiClient } from '../services/vapi-client';
import { log } from '../services/logger';
import { supabase } from '../services/supabase-client';

const router = Router();

/**
 * Sync tools to a Vapi assistant
 * This endpoint is called to register the booking and other tools with an assistant
 */
router.post('/sync-tools', async (req, res) => {
    try {
        const { assistantId, vapiApiKey, baseUrl } = req.body;

        if (!assistantId || !vapiApiKey) {
            return res.status(400).json({
                error: 'Missing required fields: assistantId, vapiApiKey'
            });
        }

        log.info('ToolSync', 'Syncing tools to assistant', {
            assistantId,
            baseUrl
        });

        const vapi = new VapiClient(vapiApiKey);
        const result = await vapi.syncAgentTools(assistantId, 'default-org', baseUrl);

        log.info('ToolSync', 'Tools synced successfully', {
            assistantId,
            result
        });

        return res.status(200).json({
            success: true,
            assistantId,
            message: 'Tools synced successfully'
        });
    } catch (error: any) {
        log.error('ToolSync', 'Failed to sync tools', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Failed to sync tools: ' + error.message
        });
    }
});

export default router;
