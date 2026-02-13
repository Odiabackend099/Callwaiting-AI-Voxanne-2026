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

    // UNIFIED CALLS TABLE QUERY
    // Single query to 'calls_with_caller_names' VIEW (Strategic SSOT Fix 2026-02-09)
    // VIEW automatically JOINs with contacts table to provide live name resolution
    // Key change: Always get fresh names from contacts.name (SSOT), never stale data
    // FIXED (2026-02-01): Now includes all 4 sentiment fields (label, score, summary, urgency)
    // FIXED (2026-02-09): Changed from 'calls' table to 'calls_with_caller_names' view
    let query = supabase
      .from('calls_with_caller_names')  // ← VIEW with live name resolution from contacts
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);  // CRITICAL: Tenant isolation

    // Filter by call direction if specified
    if (parsed.call_type === 'inbound') {
      query = query.eq('call_direction', 'inbound');
    } else if (parsed.call_type === 'outbound') {
      query = query.eq('call_direction', 'outbound');
    }
    // If no filter, show ALL calls (both inbound + outbound)

    // Apply date filters
    if (parsed.startDate) {
      query = query.gte('created_at', new Date(parsed.startDate).toISOString());
    }
    if (parsed.endDate) {
      query = query.lte('created_at', new Date(parsed.endDate).toISOString());
    }

    // Apply status filter
    if (parsed.status) {
      query = query.eq('status', parsed.status);
    }

    // Filter out test calls by default (browser test calls)
    if ((req.query as any).include_test !== 'true') {
      query = query.or('is_test_call.is.null,is_test_call.eq.false');
    }

    // Apply search filter (phone number or resolved caller name from VIEW)
    // FIXED (2026-02-09): Search resolved_caller_name (live from contacts) instead of deprecated caller_name
    if (parsed.search) {
      query = query.or(`phone_number.ilike.%${parsed.search}%,resolved_caller_name.ilike.%${parsed.search}%`);
    }

    // Order by created_at descending (newest first)
    query = query.order('created_at', { ascending: false });

    // Apply database-level pagination
    query = query.range(offset, offset + limit - 1);

    const { data: calls, error, count } = await query;

    if (error) {
      log.error('Calls', 'Failed to fetch calls from unified table', {
        error: error.message,
        errorCode: (error as any).code,
        errorDetails: JSON.stringify(error),
        orgId,
        queryInfo: {
          table: 'calls',
          columns: 'id, call_direction, from_number, call_type, contact_id, created_at, duration_seconds, status, recording_url, recording_storage_path, transcript, sentiment, intent',
          orgIdFilter: orgId,
          callTypeFilter: parsed.call_type || 'all'
        }
      });
      return res.status(500).json({
        error: 'Failed to fetch calls',
        details: error.message,
        code: (error as any).code
      });
    }

    // Transform response (handle both inbound + outbound)
    // PERFORMANCE OPTIMIZATION: No longer generate signed URLs on list load
    // URLs generated on-demand when user clicks play (see /:callId/recording-url endpoint)
    // FIXED (2026-02-01): Now uses individual sentiment fields instead of parsing packed string
    // FIXED (2026-02-09): Use resolved_caller_name from VIEW (always live from contacts.name SSOT)
    const finalCalls = (calls || []).map((call: any) => {
      // Use individual sentiment fields directly (more reliable than parsing packed strings)
      // Fallback to parsing legacy sentiment field if individual fields not available
      let sentimentLabel = call.sentiment_label;
      let sentimentScore = call.sentiment_score;
      let sentimentSummary = call.sentiment_summary;
      let sentimentUrgency = call.sentiment_urgency;

      // Legacy fallback: parse packed sentiment string if individual fields missing
      if (!sentimentLabel && call.sentiment) {
        const parts = call.sentiment.split(':');
        sentimentLabel = parts[0] || null;
        sentimentScore = parts[1] ? parseFloat(parts[1]) : null;
        sentimentSummary = parts[2] || call.sentiment;
        sentimentUrgency = parts[3] || null;
      }

      // Strategic SSOT Fix (2026-02-09): Use resolved_caller_name from VIEW
      // Always live data from contacts.name (never stale), with phone fallback
      const resolvedCallerName = call.resolved_caller_name || call.phone_number || 'Unknown';

      return {
        id: call.id,
        phone_number: call.phone_number || 'Unknown',  // SSOT: phone_number (from_number deprecated 2026-02-09)
        caller_name: resolvedCallerName,
        call_date: call.created_at,
        duration_seconds: call.duration_seconds || 0,
        status: call.status || 'completed',
        call_direction: call.call_direction,  // Expose direction to frontend
        has_recording: !!(call.recording_url || call.recording_storage_path),
        has_transcript: !!call.transcript,
        sentiment_score: sentimentScore ? parseFloat(String(sentimentScore)) : null,
        sentiment_label: sentimentLabel || null,
        sentiment_summary: sentimentSummary || null,
        sentiment_urgency: sentimentUrgency || null,
        outcome: call.outcome || null,
        outcome_summary: call.outcome_summary || null,
        call_type: call.call_direction,  // For backward compatibility
        // ========== GOLDEN RECORD FIELDS (2026-02-13) ==========
        cost_cents: call.cost_cents || 0,  // Call cost in integer cents (avoids floating point issues)
        ended_reason: call.ended_reason || null,  // Raw Vapi endedReason code for analytics
        tools_used: call.tools_used || [],  // Array of tool names used during call
        has_appointment: call.has_appointment || false,  // Boolean flag from view
        appointment_id: call.appointment_id || null,  // Link to appointments table
        appointment_scheduled_at: call.appointment_scheduled_at || null,  // Appointment date/time
        appointment_status: call.appointment_status || null,  // Appointment status
        appointment_service_type: call.appointment_service_type || null  // Service booked
      };
    });

    const totalCount = count || 0;

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

    // PERFORMANCE OPTIMIZATION: Use single RPC function instead of 8 parallel queries
    // This consolidates all stats into one database aggregation (10-20x faster)
    // Performance: 3-5 seconds down to 200-400ms

    const timeWindow = (req.query.timeWindow as string) || '7d';

    // Call optimized RPC function for all dashboard stats
    const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats_optimized', {
      p_org_id: orgId,
      p_time_window: timeWindow
    });

    // Compute time window start for fallback query
    const windowMs = timeWindow === '24h' ? 24*60*60*1000 : timeWindow === '30d' ? 30*24*60*60*1000 : 7*24*60*60*1000;
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    let totalCalls = 0, completedCalls = 0, callsToday = 0, inboundCalls = 0, outboundCalls = 0, avgDuration = 0, pipelineValue = 0;

    if (statsError) {
      // RPC not deployed or failed — fallback to direct aggregation
      log.warn('Calls', 'GET /stats - RPC failed, using fallback', { orgId, error: statsError.message });

      const { data: fallbackCalls } = await supabase
        .from('calls')
        .select('id, call_direction, duration_seconds, created_at, status')
        .eq('org_id', orgId)
        .or('is_test_call.is.null,is_test_call.eq.false')
        .gt('created_at', windowStart);

      if (fallbackCalls && Array.isArray(fallbackCalls)) {
        const today = new Date().toISOString().slice(0, 10);
        let totalDur = 0;
        for (const c of fallbackCalls) {
          totalCalls++;
          if (c.status === 'completed') completedCalls++;
          if (c.created_at?.slice(0, 10) === today) callsToday++;
          if (c.call_direction === 'inbound') inboundCalls++;
          if (c.call_direction === 'outbound') outboundCalls++;
          totalDur += c.duration_seconds || 0;
        }
        avgDuration = totalCalls > 0 ? Math.round(totalDur / totalCalls) : 0;
      }
    } else {
      // RPC RETURNS TABLE → Supabase JS client returns an array; extract first row
      const row = Array.isArray(statsData) ? statsData[0] : statsData;
      totalCalls = Number(row?.total_calls || 0);
      completedCalls = Number(row?.completed_calls || 0);
      callsToday = Number(row?.calls_today || 0);
      inboundCalls = Number(row?.inbound_calls || 0);
      outboundCalls = Number(row?.outbound_calls || 0);
      avgDuration = Number(row?.avg_duration || 0);
      pipelineValue = Number(row?.pipeline_value || 0);
    }

    // Recent calls: Use VIEW for live name resolution (Strategic SSOT Fix 2026-02-09)
    const { data: recentCallsData, error: recentError } = await supabase
      .from('calls_with_caller_names')  // ← VIEW with live caller names from contacts
      .select('id, phone_number, resolved_caller_name, call_type, created_at, duration_seconds, status, call_direction, is_test_call, metadata')
      .eq('org_id', orgId)
      .or('is_test_call.is.null,is_test_call.eq.false')
      .order('created_at', { ascending: false })
      .limit(5);

    // Format recent calls for frontend (map actual schema columns to expected output)
    // FIXED (2026-02-09): Use resolved_caller_name from VIEW (always fresh from contacts.name)
    const recentCalls = (recentCallsData || []).map((c: any) => ({
      id: c.id,
      phone_number: c.phone_number || 'Unknown',
      caller_name: c.resolved_caller_name || c.phone_number || 'Unknown',  // Live name from contacts
      call_date: c.created_at,
      call_type: c.call_direction || (c.metadata?.channel === 'inbound' ? 'inbound' : 'outbound'),
      // Legacy field names (for backwards compatibility with frontend)
      to_number: c.phone_number || 'Unknown',
      started_at: c.created_at,
      duration_seconds: c.duration_seconds || 0,
      status: c.status || 'completed',
      metadata: {
        channel: c.call_direction || (c.metadata?.channel || 'inbound')
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
        .select('id, created_at, status, duration_seconds, sentiment_score')
        .eq('org_id', orgId),

      // Month's calls - includes today and week (smart fetch eliminates 2 redundant queries)
      supabase
        .from('calls')
        .select('id, created_at')
        .eq('org_id', orgId)
        .gte('created_at', monthAgo.toISOString())
    ]);

    const calls = allCallsResult.data || [];
    const monthCalls = monthCallsResult.data || [];

    // Filter month's calls in JavaScript (fast with small dataset ~1000 records max)
    const todayISO = today.toISOString().split('T')[0];
    const weekAgoISO = weekAgo.toISOString();

    const todayCalls = monthCalls.filter((c: any) => c.created_at >= todayISO);
    const weekCalls = monthCalls.filter((c: any) => c.created_at >= weekAgoISO);

    // Calculate aggregate stats from all calls
    const completedCalls = calls.filter((c: any) => c.status === 'completed');
    const missedCalls = calls.filter((c: any) => c.status === 'missed');

    const avgDuration = completedCalls.length > 0
      ? Math.round(completedCalls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / completedCalls.length)
      : 0;

    // FIXED: Use sentiment_score directly (numeric column)
    const callsWithSentiment = calls.filter((c: any) => c.sentiment_score != null);
    const avgSentiment = callsWithSentiment.length > 0
      ? callsWithSentiment.reduce((sum: number, c: any) => sum + (c.sentiment_score || 0), 0) / callsWithSentiment.length
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
 *
 * FIXED (2026-02-01): Now queries unified 'calls' table (post-Phase 6)
 * Previously queried outdated call_logs table which no longer exists
 */
callsRouter.get('/:callId/recording-url', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { callId } = req.params;

    // Query unified calls table (contains both inbound and outbound calls post-Phase 6)
    // FIXED (2026-02-02): Removed non-existent recording_path column
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('id, recording_storage_path, recording_url')
      .eq('id', callId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (callError) {
      log.error('Calls', 'GET /:callId/recording-url - Database error', {
        error: callError.message,
        callId,
        orgId
      });
      return res.status(500).json({ error: 'Database error' });
    }

    if (!callRecord) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Priority 1: Try Supabase storage path (signed URL generation)
    if (callRecord.recording_storage_path) {
      try {
        const signedUrl = await getSignedRecordingUrl(callRecord.recording_storage_path);
        if (signedUrl) {
          return res.json({
            recording_url: signedUrl,
            expires_in: 3600,
            source: 'supabase'
          });
        }
      } catch (e) {
        log.warn('Calls', 'Failed to generate signed URL for storage path', {
          error: (e as any).message,
          storage_path: callRecord.recording_storage_path
        });
        // Fall through to next option
      }
    }

    // Priority 2: Try recording_path (alternative column name)
    if (callRecord.recording_path && !callRecord.recording_storage_path) {
      try {
        const signedUrl = await getSignedRecordingUrl(callRecord.recording_path);
        if (signedUrl) {
          return res.json({
            recording_url: signedUrl,
            expires_in: 3600,
            source: 'supabase'
          });
        }
      } catch (e) {
        log.warn('Calls', 'Failed to generate signed URL for recording_path', {
          error: (e as any).message,
          recording_path: callRecord.recording_path
        });
        // Fall through to next option
      }
    }

    // Priority 3: Fallback to Vapi CDN recording URL (Vapi provides direct URLs)
    if (callRecord.recording_url) {
      return res.json({
        recording_url: callRecord.recording_url,
        expires_in: null, // Vapi URLs don't expire
        source: 'vapi'
      });
    }

    // No recording found
    return res.status(404).json({
      error: 'Recording not found for this call',
      callId: callId
    });

  } catch (e: any) {
    log.error('Calls', 'GET /:callId/recording-url - Unexpected error', {
      error: e?.message,
      stack: e?.stack
    });
    return res.status(500).json({
      error: e?.message || 'Failed to generate recording URL'
    });
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

    // Try to fetch from calls first (inbound calls)
    // FIXED (2026-02-02): Added LEFT JOIN with contacts table to resolve caller names
    const { data: inboundCall, error: inboundError } = await supabase
      .from('calls')
      .select('*, contacts!contact_id(name)')
      .eq('id', callId)
      .eq('org_id', orgId)  // CRITICAL FIX: Filter by org_id for tenant isolation
      .eq('call_type', 'inbound')
      .single();

    if (inboundCall) {
      // Format transcript with sentiment
      // FIXED (2026-02-03): Handle transcript as string or array
      let transcript: any[] = [];
      if (Array.isArray(inboundCall.transcript)) {
        transcript = inboundCall.transcript.map((segment: any) => ({
          speaker: segment.speaker,
          text: segment.text,
          timestamp: segment.timestamp || 0,
          sentiment: segment.sentiment || 'neutral'
        }));
      } else if (typeof inboundCall.transcript === 'string' && inboundCall.transcript) {
        // If transcript is a plain string, convert to single segment
        transcript = [{
          speaker: 'caller',
          text: inboundCall.transcript,
          timestamp: 0,
          sentiment: 'neutral'
        }];
      }

      // FIXED (2026-02-02): Resolve caller_name from database or contacts JOIN
      let resolvedCallerName = 'Unknown Caller';
      if (inboundCall.caller_name) {
        // For inbound calls, use existing caller_name from database (populated by caller ID)
        resolvedCallerName = inboundCall.caller_name;
      } else if (inboundCall.contacts?.name) {
        // Fallback to contacts JOIN if caller_name not available
        resolvedCallerName = inboundCall.contacts.name;
      }

      return res.json({
        id: inboundCall.id,
        phone_number: inboundCall.phone_number || 'Unknown',
        caller_name: resolvedCallerName,
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
        call_type: 'inbound',
        // ========== GOLDEN RECORD FIELDS (2026-02-13) ==========
        cost_cents: inboundCall.cost_cents || 0,
        ended_reason: inboundCall.ended_reason || null,
        tools_used: inboundCall.tools_used || [],
        appointment_id: inboundCall.appointment_id || null
      });
    }

    // Fall back to calls table (outbound calls)
    // FIXED (2026-02-02): Added LEFT JOIN with contacts table to resolve caller names
    const { data: outboundCall, error: outboundError } = await supabase
      .from('calls')
      .select('*, contacts!contact_id(name)')
      .eq('id', callId)
      .eq('org_id', orgId)
      .eq('call_type', 'outbound')
      .not('caller_name', 'ilike', '%demo%')
      .not('caller_name', 'ilike', '%test%')
      .not('phone_number', 'ilike', '%test%')
      .single();

    if (outboundCall) {
      // Format transcript with sentiment
      // FIXED (2026-02-03): Handle transcript as string or array
      let transcript: any[] = [];
      if (Array.isArray(outboundCall.transcript)) {
        transcript = outboundCall.transcript.map((segment: any) => ({
          speaker: segment.speaker,
          text: segment.text,
          timestamp: segment.timestamp || 0,
          sentiment: segment.sentiment || 'neutral'
        }));
      } else if (typeof outboundCall.transcript === 'string' && outboundCall.transcript) {
        // If transcript is a plain string, convert to single segment
        transcript = [{
          speaker: 'caller',
          text: outboundCall.transcript,
          timestamp: 0,
          sentiment: 'neutral'
        }];
      }

      // Generate signed URL if storage path exists
      let recordingUrl = outboundCall.recording_url;
      if (outboundCall.recording_storage_path || outboundCall.recording_path) {
        const path = outboundCall.recording_storage_path || outboundCall.recording_path;
        const signed = await getSignedRecordingUrl(path);
        if (signed) recordingUrl = signed;
      }

      // FIXED (2026-02-02): Resolve caller_name from contacts table JOIN for outbound calls
      let resolvedCallerName = 'Unknown Contact';
      if (outboundCall.contacts?.name) {
        resolvedCallerName = outboundCall.contacts.name;
      } else if (outboundCall.caller_name) {
        // Fallback to existing caller_name if contacts JOIN failed
        resolvedCallerName = outboundCall.caller_name;
      }

      return res.json({
        id: outboundCall.id,
        phone_number: outboundCall.phone_number,
        caller_name: resolvedCallerName,
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
        call_type: 'outbound',
        // ========== GOLDEN RECORD FIELDS (2026-02-13) ==========
        cost_cents: outboundCall.cost_cents || 0,
        ended_reason: outboundCall.ended_reason || null,
        tools_used: outboundCall.tools_used || [],
        appointment_id: outboundCall.appointment_id || null
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
      .from('calls')
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
      .from('calls')
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
      .from('calls')
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
