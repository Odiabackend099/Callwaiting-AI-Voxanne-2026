/**
 * Call Recording Dashboard Routes
 * Handles call list, details, filtering, and export functionality
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';

const callsRouter = Router();

callsRouter.use(requireAuthOrDev);

/**
 * GET /api/calls-dashboard
 * Get paginated list of calls with filtering and sorting
 * Inbound calls from call_logs, outbound calls from calls table
 */
callsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(['completed', 'missed', 'transferred', 'failed']).optional(),
      search: z.string().optional(),
      sortBy: z.enum(['date', 'duration', 'name']).default('date'),
      call_type: z.enum(['inbound', 'outbound']).optional()
    });

    const parsed = schema.parse(req.query);
    const offset = (parsed.page - 1) * parsed.limit;
    const limit = parsed.limit;

    let allCalls: any[] = [];
    let totalCount = 0;

    // Fetch inbound calls from call_logs
    if (!parsed.call_type || parsed.call_type === 'inbound') {
      let inboundQuery = supabase
        .from('call_logs')
        .select('*', { count: 'exact' })
        .eq('call_type', 'inbound')
        .not('null', 'recording_storage_path');

      if (parsed.startDate) {
        inboundQuery = inboundQuery.gte('created_at', new Date(parsed.startDate).toISOString());
      }
      if (parsed.endDate) {
        inboundQuery = inboundQuery.lte('created_at', new Date(parsed.endDate).toISOString());
      }
      if (parsed.search) {
        inboundQuery = inboundQuery.or(`caller_name.ilike.%${parsed.search}%,phone_number.ilike.%${parsed.search}%`);
      }

      inboundQuery = inboundQuery.order('created_at', { ascending: false });

      const { data: inboundCalls, error: inboundError, count: inboundCount } = await inboundQuery;

      if (inboundError) {
        log.warn('Calls', 'Failed to fetch inbound calls', { error: inboundError.message });
      } else {
        allCalls = allCalls.concat((inboundCalls || []).map((call: any) => ({
          id: call.id,
          phone_number: call.phone_number || 'Unknown',
          caller_name: call.caller_name || 'Unknown',
          call_date: call.created_at,
          duration_seconds: call.duration_seconds || 0,
          status: call.status || 'completed',
          has_recording: !!call.recording_storage_path,
          has_transcript: !!call.transcript,
          sentiment_score: call.sentiment_score,
          sentiment_label: call.sentiment_label,
          call_type: 'inbound'
        })));
        totalCount += (inboundCount || 0);
      }
    }

    // Fetch outbound calls from calls table
    if (!parsed.call_type || parsed.call_type === 'outbound') {
      let outboundQuery = supabase
        .from('calls')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .eq('call_type', 'outbound')
        .not('caller_name', 'ilike', '%demo%')
        .not('caller_name', 'ilike', '%test%')
        .not('phone_number', 'ilike', '%test%');

      if (parsed.startDate) {
        outboundQuery = outboundQuery.gte('call_date', new Date(parsed.startDate).toISOString());
      }
      if (parsed.endDate) {
        outboundQuery = outboundQuery.lte('call_date', new Date(parsed.endDate).toISOString());
      }
      if (parsed.status) {
        outboundQuery = outboundQuery.eq('status', parsed.status);
      }
      if (parsed.search) {
        outboundQuery = outboundQuery.or(`caller_name.ilike.%${parsed.search}%,phone_number.ilike.%${parsed.search}%`);
      }

      outboundQuery = outboundQuery.order('call_date', { ascending: false });

      const { data: outboundCalls, error: outboundError, count: outboundCount } = await outboundQuery;

      if (outboundError) {
        log.warn('Calls', 'Failed to fetch outbound calls', { error: outboundError.message });
      } else {
        allCalls = allCalls.concat((outboundCalls || []).map((call: any) => ({
          id: call.id,
          phone_number: call.phone_number,
          caller_name: call.caller_name || 'Unknown',
          call_date: call.call_date,
          duration_seconds: call.duration_seconds,
          status: call.status,
          has_recording: !!call.recording_url,
          has_transcript: !!call.transcript,
          sentiment_score: call.sentiment_score,
          sentiment_label: call.sentiment_label,
          call_type: 'outbound'
        })));
        totalCount += (outboundCount || 0);
      }
    }

    // Sort all calls by date
    allCalls.sort((a, b) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime());

    // Apply pagination
    const paginatedCalls = allCalls.slice(offset, offset + limit);

    return res.json({
      calls: paginatedCalls,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: totalCount,
        pages: Math.ceil(totalCount / parsed.limit)
      }
    });
  } catch (e: any) {
    log.error('Calls', 'GET / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch calls' });
  }
});

/**
 * GET /api/calls/:callId
 * Get full call details including transcript and recording
 */
callsRouter.get('/:callId', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .eq('org_id', orgId)
      .not('caller_name', 'ilike', '%demo%')
      .not('caller_name', 'ilike', '%test%')
      .not('phone_number', 'ilike', '%test%')
      .single();

    if (error || !call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Format transcript with sentiment
    const transcript = (call.transcript || []).map((segment: any) => ({
      speaker: segment.speaker,
      text: segment.text,
      timestamp: segment.timestamp || 0,
      sentiment: segment.sentiment || 'neutral'
    }));

    return res.json({
      id: call.id,
      phone_number: call.phone_number,
      caller_name: call.caller_name || 'Unknown',
      call_date: call.call_date,
      duration_seconds: call.duration_seconds,
      status: call.status,
      recording_url: call.recording_url,
      transcript,
      sentiment_score: call.sentiment_score,
      sentiment_label: call.sentiment_label,
      action_items: call.action_items || [],
      vapi_call_id: call.vapi_call_id,
      created_at: call.created_at
    });
  } catch (e: any) {
    log.error('Calls', 'GET /:callId - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch call' });
  }
});

/**
 * POST /api/calls
 * Create a new call record (called by Vapi webhook)
 */
callsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      phone_number: z.string(),
      caller_name: z.string().optional(),
      call_date: z.string(),
      duration_seconds: z.number().int().nonnegative(),
      status: z.enum(['completed', 'missed', 'transferred', 'failed']),
      recording_url: z.string().optional(),
      transcript: z.array(z.object({
        speaker: z.enum(['caller', 'voxanne']),
        text: z.string(),
        timestamp: z.number().optional(),
        sentiment: z.string().optional()
      })).optional(),
      sentiment_score: z.number().min(0).max(1).optional(),
      vapi_call_id: z.string().optional(),
      action_items: z.array(z.string()).optional()
    });

    const parsed = schema.parse(req.body);

    // Determine sentiment label
    let sentiment_label = 'neutral';
    if (parsed.sentiment_score !== undefined) {
      if (parsed.sentiment_score < 0.4) sentiment_label = 'negative';
      else if (parsed.sentiment_score > 0.6) sentiment_label = 'positive';
    }

    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        org_id: orgId,
        phone_number: parsed.phone_number,
        caller_name: parsed.caller_name,
        call_date: parsed.call_date,
        duration_seconds: parsed.duration_seconds,
        status: parsed.status,
        recording_url: parsed.recording_url,
        transcript: parsed.transcript,
        sentiment_score: parsed.sentiment_score,
        sentiment_label,
        vapi_call_id: parsed.vapi_call_id,
        action_items: parsed.action_items
      })
      .select('*')
      .single();

    if (error) {
      log.error('Calls', 'Failed to create call', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Calls', 'Call created', { orgId, callId: call.id, phone: parsed.phone_number });
    return res.status(201).json({ id: call.id, call });
  } catch (e: any) {
    log.error('Calls', 'POST / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to create call' });
  }
});

/**
 * DELETE /api/calls/:callId
 * Delete a call record
 */
callsRouter.delete('/:callId', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;

    const { error } = await supabase
      .from('calls')
      .delete()
      .eq('id', callId)
      .eq('org_id', orgId);

    if (error) {
      log.error('Calls', 'Failed to delete call', { orgId, callId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Calls', 'Call deleted', { orgId, callId });
    return res.json({ success: true });
  } catch (e: any) {
    log.error('Calls', 'DELETE /:callId - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to delete call' });
  }
});

/**
 * GET /api/calls/analytics/summary
 * Get call analytics summary
 */
callsRouter.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all calls
    const { data: allCalls } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', orgId);

    const calls = allCalls || [];

    // Get today's calls
    const { data: todayCalls } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', orgId)
      .gte('call_date', today.toISOString());

    // Get week's calls
    const { data: weekCalls } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', orgId)
      .gte('call_date', weekAgo.toISOString());

    // Get month's calls
    const { data: monthCalls } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', orgId)
      .gte('call_date', monthAgo.toISOString());

    const completedCalls = calls.filter((c: any) => c.status === 'completed');
    const missedCalls = calls.filter((c: any) => c.status === 'missed');
    const avgDuration = completedCalls.length > 0
      ? Math.round(completedCalls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / completedCalls.length)
      : 0;
    const avgSentiment = calls.filter((c: any) => c.sentiment_score).length > 0
      ? calls.filter((c: any) => c.sentiment_score).reduce((sum: number, c: any) => sum + c.sentiment_score, 0) / calls.filter((c: any) => c.sentiment_score).length
      : 0;

    return res.json({
      total_calls: calls.length,
      completed_calls: completedCalls.length,
      missed_calls: missedCalls.length,
      average_duration: avgDuration,
      average_sentiment: Math.round(avgSentiment * 100) / 100,
      calls_today: todayCalls?.length || 0,
      calls_this_week: weekCalls?.length || 0,
      calls_this_month: monthCalls?.length || 0
    });
  } catch (e: any) {
    log.error('Calls', 'GET /analytics/summary - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch analytics' });
  }
});

export { callsRouter };
