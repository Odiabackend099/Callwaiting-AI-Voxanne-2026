import { Router } from 'express';
import { supabase } from '../services/supabase-client';
import { VapiClient } from '../services/vapi-client';
import { requireAuthOrDev } from '../middleware/auth';

const router = Router();

router.use(requireAuthOrDev);

// GET /api/integrations/vapi - Get VAPI integration status
router.get('/vapi', async (req, res) => {
  const orgId = req.user?.orgId;
  if (!orgId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'vapi')
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.json({ connected: false });
  }

  return res.json({
    connected: data.connected,
    lastChecked: data.last_checked_at,
    hasApiKey: !!data.config?.vapi_api_key
  });
});

// POST /api/integrations/vapi/test - Test VAPI connection
router.post('/vapi/test', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    const vapi = new VapiClient(apiKey);
    const isValid = await vapi.validateConnection();

    if (isValid) {
      return res.json({ success: true, message: 'Connection successful' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid API key' });
    }
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Connection failed'
    });
  }
});

// PUT /api/integrations/vapi - Update VAPI API key
router.put('/vapi', async (req, res) => {
  const { apiKey } = req.body;
  const orgId = req.user?.orgId;

  if (!orgId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate API key format (basic check)
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'Invalid API key format' });
  }

  const { error } = await supabase
    .from('integrations')
    .upsert({
      org_id: orgId,
      provider: 'vapi',
      connected: true,
      last_checked_at: new Date().toISOString(),
      config: { vapi_api_key: apiKey } // TODO: Encrypt this in production
    }, { onConflict: 'org_id,provider' });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ success: true });
});

export default router;
