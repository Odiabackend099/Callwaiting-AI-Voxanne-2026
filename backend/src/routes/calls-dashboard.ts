/**
 * Call Recording Dashboard Routes
 * Handles call list, details, filtering, and export functionality
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import { getSignedRecordingUrl } from '../services/call-recording-storage';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { Twilio } from 'twilio';
import { Resend } from 'resend';
import { rateLimitAction } from '../middleware/rate-limit-actions';
import { withTwilioRetry, withResendRetry } from '../services/retry-strategy';

const callsRouter = Router();

callsRouter.use(requireAuthOrDev);

/**
 * Validate phone number in E.164 format
 * @param phoneNumber The phone number to validate
 * @returns true if valid E.164 format, false otherwise
 */
function isValidE164PhoneNumber(phoneNumber: string): boolean {
  // E.164 format: +[country code][number]
  // Must start with + and contain only digits (10-15 digits total)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

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

    // Optimization: Use database-level pagination when querying single call type
    const isInboundOnly = parsed.call_type === 'inbound';
    const isOutboundOnly = parsed.call_type === 'outbound';
    const isMixedQuery = !parsed.call_type;

    // Fetch inbound calls from call_logs
    if (!parsed.call_type || parsed.call_type === 'inbound') {
      let inboundQuery = supabase
        .from('call_logs')
        .select('id, phone_number, caller_name, created_at, duration_seconds, status, recording_storage_path, transcript, sentiment_score, sentiment_label, sentiment_summary, sentiment_urgency', { count: 'exact' })
        .eq('org_id', orgId)  // CRITICAL FIX: Filter by org_id for tenant isolation
        .eq('call_type', 'inbound')
        .not('recording_storage_path', 'is', null);

      if (parsed.startDate) {
        inboundQuery = inboundQuery.gte('created_at', new Date(parsed.startDate).toISOString());
      }
      if (parsed.endDate) {
        inboundQuery = inboundQuery.lte('created_at', new Date(parsed.endDate).toISOString());
      }
      if (parsed.status) {
        inboundQuery = inboundQuery.eq('status', parsed.status);  // Also add status filter if provided
      }
      if (parsed.search) {
        inboundQuery = inboundQuery.or(`caller_name.ilike.%${parsed.search}%,phone_number.ilike.%${parsed.search}%`);
      }

      inboundQuery = inboundQuery.order('created_at', { ascending: false });

      // Apply database-level pagination for inbound-only queries
      if (isInboundOnly) {
        inboundQuery = inboundQuery.range(offset, offset + limit - 1);
      } else if (isMixedQuery) {
        // For mixed queries, limit each table to prevent over-fetching
        // Fetch 2x the requested limit to ensure we have enough for pagination
        inboundQuery = inboundQuery.limit(limit * 2);
      }

      const { data: inboundCalls, error: inboundError, count: inboundCount } = await inboundQuery;

      if (inboundError) {
        log.warn('Calls', 'Failed to fetch inbound calls', { error: inboundError.message });
      } else {
        // PERFORMANCE OPTIMIZATION: No longer generate signed URLs on list load
        // URLs generated on-demand when user clicks play (see /:callId/recording-url endpoint)
        const processedInboundCalls = (inboundCalls || []).map((call: any) => {
          return {
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
            sentiment_summary: call.sentiment_summary,
            sentiment_urgency: call.sentiment_urgency,
            call_type: 'inbound'
          };
        });

        allCalls = allCalls.concat(processedInboundCalls);
        totalCount += (inboundCount || 0);
      }
    }

    // Fetch outbound calls from calls table
    if (!parsed.call_type || parsed.call_type === 'outbound') {
      let outboundQuery = supabase
        .from('calls')
        .select('id, phone_number, caller_name, call_date, duration_seconds, status, recording_storage_path, recording_path, transcript, sentiment_score, sentiment_label, sentiment_summary, sentiment_urgency', { count: 'exact' })
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

      // Apply database-level pagination for outbound-only queries
      if (isOutboundOnly) {
        outboundQuery = outboundQuery.range(offset, offset + limit - 1);
      } else if (isMixedQuery) {
        // For mixed queries, limit each table to prevent over-fetching
        outboundQuery = outboundQuery.limit(limit * 2);
      }

      const { data: outboundCalls, error: outboundError, count: outboundCount } = await outboundQuery;

      if (outboundError) {
        log.warn('Calls', 'Failed to fetch outbound calls', { error: outboundError.message });
      } else {
        // PERFORMANCE OPTIMIZATION: No longer generate signed URLs on list load
        // URLs generated on-demand when user clicks play (see /:callId/recording-url endpoint)
        const processedCalls = (outboundCalls || []).map((call: any) => {
          return {
            id: call.id,
            phone_number: call.phone_number,
            caller_name: call.caller_name || 'Unknown',
            call_date: call.call_date,
            duration_seconds: call.duration_seconds,
            status: call.status,
            has_recording: !!(call.recording_storage_path || call.recording_path),
            has_transcript: !!call.transcript,
            sentiment_score: call.sentiment_score,
            sentiment_label: call.sentiment_label,
            sentiment_summary: call.sentiment_summary,
            sentiment_urgency: call.sentiment_urgency,
            call_type: 'outbound'
          };
        });

        allCalls = allCalls.concat(processedCalls);
        totalCount += (outboundCount || 0);
      }
    }

    // For mixed queries, sort and paginate in memory (already limited to 2x per table)
    // For single call type queries, database already handled pagination
    let finalCalls = allCalls;

    if (isMixedQuery) {
      // Sort all calls by date (mixed query only)
      allCalls.sort((a, b) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime());

      // Apply in-memory pagination (limited dataset)
      finalCalls = allCalls.slice(offset, offset + limit);
    }

    return res.json({
      calls: finalCalls,
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
 * GET /api/calls-dashboard/stats
 * Get dashboard statistics (totalCalls, inboundCalls, outboundCalls, completedCalls, callsToday, avgDuration, recentCalls)
 * This endpoint matches the frontend dashboard page requirements
 * IMPORTANT: Must be defined BEFORE /:callId route (Express route order matters)
 */
callsRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // PERFORMANCE OPTIMIZATION: Use database aggregation instead of fetching all records
    // This replaces full table scan + JavaScript filtering with efficient database queries

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Execute all aggregation queries in parallel for maximum performance
    const [
      totalCallsResult,
      completedCallsResult,
      callsTodayResult,
      inboundCallsResult,
      outboundCallsResult,
      avgDurationResult,
      recentCallsResult,
      leadsResult
    ] = await Promise.all([
      // Total calls count
      supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // Completed calls count
      supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'completed'),

      // Calls today count
      supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('started_at', `${today}T00:00:00.000Z`)
        .lte('started_at', `${today}T23:59:59.999Z`),

      // Inbound calls count (metadata.channel = 'inbound')
      supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .contains('metadata', { channel: 'inbound' }),

      // Outbound calls count (metadata.channel = 'outbound')
      supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .contains('metadata', { channel: 'outbound' }),

      // Average duration (fetch only completed calls with duration)
      supabase
        .from('call_logs')
        .select('duration_seconds')
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .not('duration_seconds', 'is', null),

      // Recent calls (last 5) - still need actual data for display
      supabase
        .from('call_logs')
        .select('id, phone_number, to_number, caller_name, started_at, created_at, duration_seconds, status, call_type, metadata')
        .eq('org_id', orgId)
        .order('started_at', { ascending: false })
        .limit(5),

      // Pipeline value from leads (last 30 days)
      supabase
        .from('leads')
        .select('metadata')
        .eq('org_id', orgId)
        .gte('created_at', thirtyDaysAgo.toISOString())
    ]);

    // Check for errors (using first query as representative)
    if (totalCallsResult.error) {
      log.error('Calls', 'GET /stats - Database error', { orgId, error: totalCallsResult.error.message });
      return res.status(500).json({ error: totalCallsResult.error.message });
    }

    // Calculate aggregate stats from database results
    const totalCalls = totalCallsResult.count || 0;
    const completedCalls = completedCallsResult.count || 0;
    const callsToday = callsTodayResult.count || 0;
    const inboundCalls = inboundCallsResult.count || 0;

    // Outbound calls = total - inbound (handles both explicit 'outbound' and missing channel)
    const outboundCalls = totalCalls - inboundCalls;

    // Calculate average duration from completed calls
    const durationRecords = avgDurationResult.data || [];
    const totalDuration = durationRecords.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0);
    const avgDuration = durationRecords.length > 0 ? Math.round(totalDuration / durationRecords.length) : 0;

    // Calculate pipeline value from leads
    let pipelineValue = 0;
    if (!leadsResult.error && leadsResult.data) {
      pipelineValue = leadsResult.data.reduce((sum, lead) => {
        const val = (lead.metadata as any)?.potential_value;
        return sum + (Number(val) || 0);
      }, 0);
    }

    // Format recent calls for frontend (include both old and new field names for compatibility)
    const recentCallsData = recentCallsResult.data || [];
    const recentCalls = recentCallsData.map((c: any) => ({
      id: c.id,
      // New field names
      phone_number: c.phone_number || c.to_number || 'Unknown',
      caller_name: c.caller_name || 'Unknown',
      call_date: c.started_at || c.created_at,
      call_type: c.call_type || (c.metadata?.channel === 'inbound' ? 'inbound' : 'outbound'),
      // Legacy field names (for backwards compatibility with frontend)
      to_number: c.to_number || c.phone_number || 'Unknown',
      started_at: c.started_at || c.created_at,
      duration_seconds: c.duration_seconds || 0,
      status: c.status || 'completed',
      metadata: {
        channel: c.metadata?.channel || (c.call_type === 'inbound' ? 'inbound' : 'outbound')
      }
    }));

    return res.json({
      totalCalls,
      inboundCalls,
      outboundCalls,
      completedCalls,
      callsToday,
      avgDuration,
      pipelineValue,
      recentCalls
    });
  } catch (e: any) {
    log.error('Calls', 'GET /stats - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/calls-dashboard/analytics/summary
 * Get call analytics summary
 * IMPORTANT: Must be defined BEFORE /:callId route (Express route order matters)
 */
callsRouter.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // PERFORMANCE OPTIMIZATION: Fetch only needed columns and use smart filtering
    // Instead of 4 separate queries (all, today, week, month), fetch once and filter in JavaScript
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel queries: Get ALL calls for aggregate stats + month's calls for time-based stats
    const [allCallsResult, monthCallsResult] = await Promise.all([
      // All calls - only fetch columns needed for aggregate stats (no large text fields)
      supabase
        .from('calls')
        .select('id, call_date, status, duration_seconds, sentiment_score')
        .eq('org_id', orgId),

      // Month's calls - includes today and week (smart fetch eliminates 2 redundant queries)
      supabase
        .from('calls')
        .select('id, call_date')
        .eq('org_id', orgId)
        .gte('call_date', monthAgo.toISOString())
    ]);

    const calls = allCallsResult.data || [];
    const monthCalls = monthCallsResult.data || [];

    // Filter month's calls in JavaScript (fast with small dataset ~1000 records max)
    const todayISO = today.toISOString().split('T')[0];
    const weekAgoISO = weekAgo.toISOString();

    const todayCalls = monthCalls.filter((c: any) => c.call_date >= todayISO);
    const weekCalls = monthCalls.filter((c: any) => c.call_date >= weekAgoISO);

    // Calculate aggregate stats from all calls
    const completedCalls = calls.filter((c: any) => c.status === 'completed');
    const missedCalls = calls.filter((c: any) => c.status === 'missed');

    const avgDuration = completedCalls.length > 0
      ? Math.round(completedCalls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / completedCalls.length)
      : 0;

    const callsWithSentiment = calls.filter((c: any) => c.sentiment_score != null);
    const avgSentiment = callsWithSentiment.length > 0
      ? callsWithSentiment.reduce((sum: number, c: any) => sum + c.sentiment_score, 0) / callsWithSentiment.length
      : 0;

    return res.json({
      total_calls: calls.length,
      completed_calls: completedCalls.length,
      missed_calls: missedCalls.length,
      average_duration: avgDuration,
      average_sentiment: Math.round(avgSentiment * 100) / 100,
      calls_today: todayCalls.length,
      calls_this_week: weekCalls.length,
      calls_this_month: monthCalls.length
    });
  } catch (e: any) {
    log.error('Calls', 'GET /analytics/summary - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/calls-dashboard/:callId/recording-url
 * Generate signed URL for call recording on-demand (performance optimization)
 * IMPORTANT: Must be defined BEFORE /:callId route (more specific path)
 */
callsRouter.get('/:callId/recording-url', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;

    // Try to fetch from call_logs first (inbound calls)
    const { data: inboundCall } = await supabase
      .from('call_logs')
      .select('id, recording_storage_path, recording_url')
      .eq('id', callId)
      .eq('org_id', orgId)
      .single();

    if (inboundCall?.recording_storage_path) {
      const signedUrl = await getSignedRecordingUrl(inboundCall.recording_storage_path);
      if (signedUrl) {
        return res.json({ recording_url: signedUrl });
      }
      // Fallback to legacy recording_url if signed URL generation fails
      if (inboundCall.recording_url) {
        return res.json({ recording_url: inboundCall.recording_url });
      }
    }

    // Fall back to calls table (outbound calls)
    const { data: outboundCall } = await supabase
      .from('calls')
      .select('id, recording_storage_path, recording_path, recording_url')
      .eq('id', callId)
      .eq('org_id', orgId)
      .single();

    if (outboundCall) {
      const path = outboundCall.recording_storage_path || outboundCall.recording_path;
      if (path) {
        const signedUrl = await getSignedRecordingUrl(path);
        if (signedUrl) {
          return res.json({ recording_url: signedUrl });
        }
      }
      // Fallback to legacy recording_url
      if (outboundCall.recording_url) {
        return res.json({ recording_url: outboundCall.recording_url });
      }
    }

    return res.status(404).json({ error: 'Recording not found' });
  } catch (e: any) {
    log.error('Calls', 'GET /:callId/recording-url - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to generate recording URL' });
  }
});

/**
 * GET /api/calls-dashboard/:callId
 * Get full call details from either call_logs (inbound) or calls (outbound)
 * IMPORTANT: Must be defined AFTER all specific routes (/:callId is a catch-all)
 */
callsRouter.get('/:callId', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;

    // Try to fetch from call_logs first (inbound calls)
    const { data: inboundCall, error: inboundError } = await supabase
      .from('call_logs')
      .select('*')
      .eq('id', callId)
      .eq('org_id', orgId)  // CRITICAL FIX: Filter by org_id for tenant isolation
      .eq('call_type', 'inbound')
      .single();

    if (inboundCall) {
      // Format transcript with sentiment
      const transcript = (inboundCall.transcript || []).map((segment: any) => ({
        speaker: segment.speaker,
        text: segment.text,
        timestamp: segment.timestamp || 0,
        sentiment: segment.sentiment || 'neutral'
      }));

      return res.json({
        id: inboundCall.id,
        phone_number: inboundCall.phone_number || 'Unknown',
        caller_name: inboundCall.caller_name || 'Unknown',
        call_date: inboundCall.created_at,
        duration_seconds: inboundCall.duration_seconds || 0,
        status: inboundCall.status || 'completed',
        recording_url: inboundCall.recording_signed_url,
        recording_storage_path: inboundCall.recording_storage_path,
        transcript,
        sentiment_score: inboundCall.sentiment_score,
        sentiment_label: inboundCall.sentiment_label,
        action_items: inboundCall.action_items || [],
        vapi_call_id: inboundCall.vapi_call_id,
        created_at: inboundCall.created_at,
        call_type: 'inbound'
      });
    }

    // Fall back to calls table (outbound calls)
    const { data: outboundCall, error: outboundError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .eq('org_id', orgId)
      .eq('call_type', 'outbound')
      .not('caller_name', 'ilike', '%demo%')
      .not('caller_name', 'ilike', '%test%')
      .not('phone_number', 'ilike', '%test%')
      .single();

    if (outboundCall) {
      // Format transcript with sentiment
      const transcript = (outboundCall.transcript || []).map((segment: any) => ({
        speaker: segment.speaker,
        text: segment.text,
        timestamp: segment.timestamp || 0,
        sentiment: segment.sentiment || 'neutral'
      }));

      // Generate signed URL if storage path exists
      let recordingUrl = outboundCall.recording_url;
      if (outboundCall.recording_storage_path || outboundCall.recording_path) {
        const path = outboundCall.recording_storage_path || outboundCall.recording_path;
        const signed = await getSignedRecordingUrl(path);
        if (signed) recordingUrl = signed;
      }

      return res.json({
        id: outboundCall.id,
        phone_number: outboundCall.phone_number,
        caller_name: outboundCall.caller_name || 'Unknown',
        call_date: outboundCall.call_date,
        duration_seconds: outboundCall.duration_seconds,
        status: outboundCall.status,
        recording_url: recordingUrl,
        transcript,
        sentiment_score: outboundCall.sentiment_score,
        sentiment_label: outboundCall.sentiment_label,
        sentiment_summary: outboundCall.sentiment_summary,
        sentiment_urgency: outboundCall.sentiment_urgency,
        action_items: outboundCall.action_items || [],
        vapi_call_id: outboundCall.vapi_call_id,
        created_at: outboundCall.created_at,
        call_type: 'outbound'
      });
    }

    return res.status(404).json({ error: 'Call not found' });
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
 * POST /api/calls-dashboard/:callId/followup
 * Send a follow-up SMS message to the call participant
 * @param callId - Call ID
 * @body message - SMS message text (max 160 characters)
 * @returns Success/failure with message ID
 */
callsRouter.post('/:callId/followup', rateLimitAction('sms'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;
    const schema = z.object({
      message: z.string().min(1).max(160)
    });

    const parsed = schema.parse(req.body);

    // Fetch call details
    const { data: callData, error: callError } = await supabase
      .from('call_logs')
      .select('phone_number, caller_name, org_id')
      .eq('id', callId)
      .eq('org_id', orgId)
      .single();

    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Validate phone number format
    if (!isValidE164PhoneNumber(callData.phone_number)) {
      log.warn('Calls', 'Invalid phone number format', {
        orgId,
        callId,
        phone: callData.phone_number
      });
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Get Twilio credentials from org_credentials
    const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
    if (!twilioCredentials) {
      return res.status(400).json({ error: 'Twilio is not configured for your organization' });
    }

    // Send SMS via Twilio with retry logic
    const client = new Twilio(twilioCredentials.accountSid, twilioCredentials.authToken);
    const message = await withTwilioRetry(() =>
      client.messages.create({
        body: parsed.message,
        from: twilioCredentials.phoneNumber,
        to: callData.phone_number
      })
    );

    // Log the message in the messages table
    const { error: logError } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        call_id: callId,
        direction: 'outbound',
        method: 'sms',
        recipient: callData.phone_number,
        content: parsed.message,
        status: 'sent',
        service_provider: 'twilio',
        external_message_id: message.sid,
        sent_at: new Date().toISOString()
      });

    if (logError) {
      log.warn('Calls', 'Failed to log SMS message', { orgId, callId, error: logError.message });
    }

    log.info('Calls', 'Follow-up SMS sent', { orgId, callId, phone: callData.phone_number, messageId: message.sid });
    return res.json({
      success: true,
      messageId: message.sid,
      phone: callData.phone_number,
      message: '📱 Follow-up SMS sent successfully'
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    // Log detailed error for debugging, but return generic message to client
    log.error('Calls', 'POST /:callId/followup - Error', {
      error: e?.message,
      stack: e?.stack,
      orgId,
      callId
    });
    return res.status(500).json({ error: 'Failed to send follow-up SMS. Please try again later.' });
  }
});

/**
 * POST /api/calls-dashboard/:callId/share
 * Share a call recording via email
 * @param callId - Call ID
 * @body email - Email address to send recording to
 * @returns Success/failure with share confirmation
 */
callsRouter.post('/:callId/share', rateLimitAction('share'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;
    const schema = z.object({
      email: z.string().email()
    });

    const parsed = schema.parse(req.body);

    // Fetch call and recording
    const { data: callData, error: callError } = await supabase
      .from('call_logs')
      .select('id, recording_storage_path, recording_url, caller_name, phone_number, duration_seconds')
      .eq('id', callId)
      .eq('org_id', orgId)
      .single();

    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!callData.recording_url && !callData.recording_storage_path) {
      return res.status(400).json({ error: 'This call does not have a recording' });
    }

    // Generate signed URL for the recording (1-hour expiry for security)
    let recordingUrl = callData.recording_url;
    if (callData.recording_storage_path) {
      const signed = await getSignedRecordingUrl(callData.recording_storage_path);
      if (signed) recordingUrl = signed;
    }

    if (!recordingUrl) {
      return res.status(400).json({ error: 'Recording URL could not be generated' });
    }

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `Shared call recording - ${callData.caller_name || 'Call'} (${callData.duration_seconds}s)`;
    const emailContent = `
Call Recording Shared

A call recording has been shared with you.

Caller: ${callData.caller_name || 'Unknown'}
Duration: ${callData.duration_seconds} seconds

Click below to access the recording (expires in 1 hour):
${recordingUrl}

This is an automated message. Please do not reply to this email.
    `.trim();

    try {
      const emailResult = await withResendRetry(() =>
        resend.emails.send({
          from: 'noreply@voxanne.ai',
          to: parsed.email,
          subject: subject,
          text: emailContent
        })
      );

      // Log the share action (without the URL for security)
      const { error: logError } = await supabase
        .from('messages')
        .insert({
          org_id: orgId,
          call_id: callId,
          direction: 'outbound',
          method: 'email',
          recipient: parsed.email,
          subject: subject,
          content: 'Recording shared via email',
          status: 'sent',
          service_provider: 'resend',
          external_message_id: emailResult.id,
          sent_at: new Date().toISOString()
        });

      if (logError) {
        log.warn('Calls', 'Failed to log share action', { orgId, callId, error: logError.message });
      }

      log.info('Calls', 'Recording shared via email', { orgId, callId, email: parsed.email, emailId: emailResult.id });
      return res.json({
        success: true,
        email: parsed.email,
        message: '📧 Recording shared successfully'
      });
    } catch (emailError: any) {
      // Log email sending failure
      log.error('Calls', 'Failed to send share email', {
        orgId,
        callId,
        email: parsed.email,
        error: emailError?.message
      });

      // Still log the failed attempt for audit trail
      await supabase
        .from('messages')
        .insert({
          org_id: orgId,
          call_id: callId,
          direction: 'outbound',
          method: 'email',
          recipient: parsed.email,
          subject: subject,
          content: 'Recording share failed',
          status: 'failed',
          error_message: emailError?.message,
          service_provider: 'resend',
          sent_at: new Date().toISOString()
        });

      return res.status(500).json({ error: 'Failed to send email. Please try again later.' });
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    // Log detailed error for debugging, but return generic message to client
    log.error('Calls', 'POST /:callId/share - Error', {
      error: e?.message,
      stack: e?.stack,
      orgId,
      callId
    });
    return res.status(500).json({ error: 'Failed to share recording. Please try again later.' });
  }
});

/**
 * POST /api/calls-dashboard/:callId/transcript/export
 * Export call transcript as a text file
 * @param callId - Call ID
 * @body format - Export format ('txt' supported, 'pdf'/'docx' future)
 * @returns Transcript file or downloadable content
 */
callsRouter.post('/:callId/transcript/export', rateLimitAction('export'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;
    const schema = z.object({
      format: z.enum(['txt']).default('txt')
    });

    const parsed = schema.parse(req.body);

    // Fetch call and transcript
    const { data: callData, error: callError } = await supabase
      .from('call_logs')
      .select('id, transcript, caller_name, phone_number, created_at')
      .eq('id', callId)
      .eq('org_id', orgId)
      .single();

    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!callData.transcript) {
      return res.status(400).json({ error: 'This call does not have a transcript' });
    }

    // Log the export action
    const { error: logError } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        call_id: callId,
        direction: 'outbound',
        method: 'email',
        recipient: req.user?.email || 'unknown',
        subject: `Transcript export - ${callData.caller_name || 'Call'}`,
        content: `Transcript exported in ${parsed.format} format`,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (logError) {
      log.warn('Calls', 'Failed to log export action', { orgId, callId, error: logError.message });
    }

    // Format transcript as text with sanitization
    const transcriptText = Array.isArray(callData.transcript)
      ? callData.transcript
          .map((turn: any) => {
            // Sanitize speaker name - allow only alphanumeric and spaces
            const sanitizedSpeaker = (turn.speaker || 'UNKNOWN')
              .replace(/[^a-zA-Z0-9 ]/g, '')
              .toUpperCase()
              .slice(0, 50);
            return `${sanitizedSpeaker}: ${turn.text}`;
          })
          .join('\n')
      : String(callData.transcript);

    // Sanitize filename - allow only alphanumeric, underscores, and hyphens
    const sanitizedCallerName = (callData.caller_name || 'call')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const dateStr = callData.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
    const filename = `transcript_${sanitizedCallerName}_${dateStr}.txt`;

    log.info('Calls', 'Transcript exported', { orgId, callId, format: parsed.format });

    // Return transcript as downloadable file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(transcriptText);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    // Log detailed error for debugging, but return generic message to client
    log.error('Calls', 'POST /:callId/transcript/export - Error', {
      error: e?.message,
      stack: e?.stack,
      orgId,
      callId
    });
    return res.status(500).json({ error: 'Failed to export transcript. Please try again later.' });
  }
});

export { callsRouter };
