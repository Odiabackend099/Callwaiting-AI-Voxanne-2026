import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';

const router = Router();

// Middleware to get org_id from user
const getOrgIdFromUser = async (req: Request, res: Response, next: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get org_id from the request (already set by requireAuthOrDev middleware)
    if (req.user?.orgId) {
      req.org_id = req.user.orgId;
    }

    next();
  } catch (error) {
    console.error('Error getting org_id:', error);
    next();
  }
};

router.use(requireAuthOrDev);
router.use(getOrgIdFromUser);

/**
 * POST /api/inbound/phone-mappings
 * Create or update a phone number mapping
 */
router.post('/phone-mappings', async (req: Request, res: Response) => {
  try {
    const { inbound_phone_number, clinic_name, vapi_phone_number_id } = req.body;
    const org_id = req.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    if (!inbound_phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Normalize phone number (basic validation)
    const normalizedPhone = inbound_phone_number.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if mapping already exists
    const { data: existing } = await supabase
      .from('phone_number_mapping')
      .select('id')
      .eq('org_id', org_id)
      .eq('inbound_phone_number', inbound_phone_number)
      .limit(1);

    let result;

    if (existing && existing.length > 0) {
      // Update existing
      const { data, error } = await supabase
        .from('phone_number_mapping')
        .update({
          clinic_name: clinic_name || existing[0].clinic_name,
          vapi_phone_number_id: vapi_phone_number_id || existing[0].vapi_phone_number_id,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id)
        .select();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('phone_number_mapping')
        .insert([
          {
            org_id,
            inbound_phone_number,
            clinic_name,
            vapi_phone_number_id,
            is_active: true,
            created_by: req.user?.id,
          },
        ])
        .select();

      if (error) throw error;
      result = data;
    }

    res.status(200).json({
      success: true,
      message: 'Phone mapping saved successfully',
      mapping: result?.[0],
    });
  } catch (error: any) {
    console.error('Error creating/updating phone mapping:', error);
    res.status(500).json({
      error: 'Failed to save phone mapping',
      details: error.message,
    });
  }
});

/**
 * GET /api/inbound/phone-mappings
 * Get all phone mappings for the user's organization
 */
router.get('/phone-mappings', async (req: Request, res: Response) => {
  try {
    const org_id = req.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const { data, error } = await supabase
      .from('phone_number_mapping')
      .select('*')
      .eq('org_id', org_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      mappings: data || [],
      count: (data || []).length,
    });
  } catch (error: any) {
    console.error('Error fetching phone mappings:', error);
    res.status(500).json({
      error: 'Failed to fetch phone mappings',
      details: error.message,
    });
  }
});

/**
 * GET /api/inbound/phone-mappings/:phoneNumber
 * Lookup a phone number to get the org_id
 * Used by webhook handlers to determine which org owns the inbound call
 */
router.get('/phone-lookup/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const { data, error } = await supabase
      .from('phone_number_mapping')
      .select('org_id, clinic_name')
      .eq('inbound_phone_number', phoneNumber)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: 'Phone number not mapped',
        details: 'This phone number is not configured for appointment booking',
      });
    }

    res.status(200).json({
      success: true,
      org_id: data.org_id,
      clinic_name: data.clinic_name,
      inbound_phone_number: phoneNumber,
    });
  } catch (error: any) {
    console.error('Error looking up phone number:', error);
    res.status(500).json({
      error: 'Failed to lookup phone number',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/inbound/phone-mappings/:id
 * Mark a phone mapping as inactive
 */
router.delete('/phone-mappings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const org_id = req.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    // Verify the mapping belongs to this org
    const { data: mapping, error: fetchError } = await supabase
      .from('phone_number_mapping')
      .select('org_id')
      .eq('id', id)
      .limit(1)
      .single();

    if (fetchError || !mapping || mapping.org_id !== org_id) {
      return res.status(403).json({ error: 'Not authorized to delete this mapping' });
    }

    // Soft delete (mark inactive)
    const { error } = await supabase
      .from('phone_number_mapping')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Phone mapping deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting phone mapping:', error);
    res.status(500).json({
      error: 'Failed to delete phone mapping',
      details: error.message,
    });
  }
});

export default router;
