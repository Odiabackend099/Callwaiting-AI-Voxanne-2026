/**
 * Dashboard MVP Route
 * Single endpoint returning everything the Control Center needs.
 * Designed for non-technical business owners — plain English labels.
 */

import { Router, Request, Response } from 'express';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import {
  getRecentCalls,
  getUpcomingAppointments,
  getWeeklyStats,
  getContactNames,
} from '../services/dashboard-queries';

const dashboardMvpRouter = Router();

dashboardMvpRouter.use(requireAuthOrDev);

/**
 * GET /api/dashboard-mvp
 * Returns weekly stats, recent calls (enriched with contact names),
 * and upcoming appointments — all in one request.
 */
dashboardMvpRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch all data in parallel
    const [stats, calls, appointments] = await Promise.all([
      getWeeklyStats(orgId),
      getRecentCalls(orgId, 20),
      getUpcomingAppointments(orgId, 10),
    ]);

    // Enrich calls with contact names
    const contactIds = calls.map((c: any) => c.contact_id).filter(Boolean);
    const contactNames = await getContactNames(orgId, contactIds);

    // Map calls to frontend-friendly format
    const enrichedCalls = calls.map((call: any) => ({
      id: call.id,
      vapiCallId: call.vapi_call_id,
      phone: call.phone_number || 'Unknown',
      callerName: call.contact_id ? (contactNames.get(call.contact_id) || 'Unknown') : null,
      direction: call.call_direction || 'inbound',
      status: mapStatusLabel(call.status),
      durationSeconds: call.duration_seconds || 0,
      costCents: call.cost_cents || 0,
      outcome: call.outcome || null,
      outcomeSummary: call.outcome_summary || null,
      sentiment: call.sentiment_label || 'neutral',
      transcript: call.transcript || null,
      recordingUrl: call.recording_url || null,
      isTestCall: call.is_test_call || false,
      createdAt: call.created_at,
    }));

    res.json({
      stats,
      calls: enrichedCalls,
      appointments,
    });
  } catch (error: any) {
    log.error('DashboardMVP', 'Failed to load dashboard data', {
      error: error.message,
      orgId: req.user?.orgId,
    });
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

/**
 * Map internal status codes to human-friendly labels.
 * Non-technical users see "Answered", not "completed".
 */
function mapStatusLabel(status: string | null): string {
  switch (status) {
    case 'completed':
    case 'answered':
      return 'Answered';
    case 'no-answer':
    case 'missed':
      return 'Missed';
    case 'voicemail':
      return 'Voicemail';
    case 'in-progress':
    case 'ringing':
      return 'In Progress';
    case 'queued':
      return 'Queued';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
}

export default dashboardMvpRouter;
