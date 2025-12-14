import { Router } from 'express';
import { supabase } from '../services/supabase-client';
import { VapiClient } from '../services/vapi-client';

const router = Router();

// GET /api/integrations/vapi - Get VAPI integration status
router.get('/vapi', async (req, res) => {
  // In a real app, we would get orgId from auth middleware
  // For now, we'll use a default or query param
  const orgId = req.query.orgId as string || 'default'; // Replace with actual auth logic

  // Since we don't have auth middleware yet, we'll just check for any vapi integration
  // or specific one if we had org_id context
  
  // NOTE: In this codebase, we seem to be using a single tenant or hardcoded org for now
  // Let's look for the integration record
  
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
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
  const orgId = req.query.orgId as string || 'default'; // Replace with actual auth

  // Validate API key format (basic check)
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'Invalid API key format' });
  }

  // Check if org exists, if not get the first one
  let targetOrgId = orgId;
  if (targetOrgId === 'default') {
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    if (orgs && orgs.length > 0) {
      targetOrgId = orgs[0].id;
    }
  }

  const { error } = await supabase
    .from('integrations')
    .upsert({
      org_id: targetOrgId,
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
