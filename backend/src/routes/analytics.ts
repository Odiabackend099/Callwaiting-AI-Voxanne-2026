
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import { requireAuth } from '../middleware/auth';

const analyticsRouter = Router();

/**
 * GET /api/analytics/dashboard-pulse
 * Retrieves the high-level metrics for the dashboard cards
 * SECURITY FIX: Now requires JWT authentication
 */
analyticsRouter.get('/dashboard-pulse', requireAuth, async (req: Request, res: Response) => {
    try {
        // Extract org_id from JWT (attached by requireAuth middleware)
        const orgId = req.user?.orgId;

        if (!orgId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Query the view for both inbound and outbound calls
        const { data: pulseData, error: pulseError } = await supabase
            .from('view_clinical_dashboard_pulse')
            .select('*')
            .eq('org_id', orgId);

        if (pulseError) {
            log.error('AnalyticsAPI', 'Failed to fetch dashboard pulse', { error: pulseError.message });
            // Return zeros if no data found
            return res.json({
                total_calls: 0,
                inbound_calls: 0,
                outbound_calls: 0,
                avg_duration_seconds: 0,
                success_rate: 0,
                pipeline_value: 0,
                hot_leads_count: 0
            });
        }

        // Aggregate inbound and outbound data
        let totalCalls = 0;
        let inboundCalls = 0;
        let outboundCalls = 0;
        let totalDuration = 0;
        let callCountForAvg = 0;

        if (pulseData && Array.isArray(pulseData)) {
            for (const row of pulseData) {
                const rowTotal = row.total_calls || 0;
                totalCalls += rowTotal;
                callCountForAvg += rowTotal;
                totalDuration += (row.avg_duration_seconds || 0) * rowTotal;

                if (row.call_direction === 'inbound') {
                    inboundCalls = rowTotal;
                } else if (row.call_direction === 'outbound') {
                    outboundCalls = rowTotal;
                }
            }
        }

        const avgDuration = callCountForAvg > 0 ? Math.round(totalDuration / callCountForAvg) : 0;

        return res.json({
            total_calls: totalCalls,
            inbound_calls: inboundCalls,
            outbound_calls: outboundCalls,
            avg_duration_seconds: avgDuration,
            success_rate: 0, // TODO: Calculate from outcomes
            pipeline_value: 0, // TODO: Calculate from lead scores
            hot_leads_count: 0 // TODO: Count from contacts table
        });
    } catch (err: any) {
        log.error('AnalyticsAPI', 'Internal error', { error: err.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/leads
 * Retrieves the actionable leads list
 * SECURITY FIX: Now requires JWT authentication
 */
analyticsRouter.get('/leads', requireAuth, async (req: Request, res: Response) => {
    try {
        // Extract org_id from JWT (attached by requireAuth middleware)
        const orgId = req.user?.orgId;

        if (!orgId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { data, error } = await supabase
            .from('view_actionable_leads')
            .select('*')
            .eq('org_id', orgId);

        if (error) {
            log.error('AnalyticsAPI', 'Failed to fetch leads', { error: error.message });
            return res.status(500).json({ error: 'Database error' });
        }

        return res.json({ leads: data || [] });
    } catch (err: any) {
        log.error('AnalyticsAPI', 'Internal error', { error: err.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/recent-activity
 * Retrieves the last 10 activity events (calls, hot leads, bookings)
 * SECURITY FIX: Now requires JWT authentication
 */
analyticsRouter.get('/recent-activity', requireAuth, async (req: Request, res: Response) => {
    try {
        const orgId = req.user?.orgId;

        if (!orgId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Fetch recent calls from unified calls table
        const { data: calls, error: callsError } = await supabase
            .from('calls')
            .select('id, created_at, caller_name, duration_seconds, sentiment_label, sentiment_summary, sentiment_urgency')
            .eq('org_id', orgId)
            .eq('call_direction', 'inbound')
            .order('created_at', { ascending: false })
            .limit(10);

        // Fetch recent hot lead alerts
        const { data: hotLeads, error: hotLeadsError } = await supabase
            .from('hot_lead_alerts')
            .select('id, created_at, lead_name, lead_phone, service_interest, lead_score')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5);

        // Fetch recent appointments
        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, created_at, customer_name, scheduled_at, contact_phone')
            .eq('org_id', orgId)
            .eq('status', 'scheduled')
            .order('scheduled_at', { ascending: false })
            .limit(5);

        // Combine and sort by timestamp
        const events: any[] = [];

        // Add call events
        if (calls && !callsError) {
            calls.forEach((call: any) => {
                const durationMinutes = Math.floor((call.duration_seconds || 0) / 60);
                events.push({
                    id: `call_${call.id}`,
                    type: 'call_completed',
                    timestamp: call.created_at,
                    summary: `Call from ${call.caller_name || 'Unknown'} - ${durationMinutes}m`,
                    metadata: {
                        caller_name: call.caller_name || 'Unknown Caller',
                        sentiment_label: call.sentiment_label || 'neutral',
                        sentiment_summary: call.sentiment_summary || 'Call completed',
                        sentiment_urgency: call.sentiment_urgency || 'low',
                        duration_seconds: call.duration_seconds || 0
                    }
                });
            });
        }

        // Add hot lead events
        if (hotLeads && !hotLeadsError) {
            hotLeads.forEach((lead: any) => {
                events.push({
                    id: `hotlead_${lead.id}`,
                    type: 'hot_lead_detected',
                    timestamp: lead.created_at,
                    summary: `🔥 Hot lead: ${lead.lead_name}`,
                    metadata: {
                        lead_name: lead.lead_name,
                        lead_phone: lead.lead_phone,
                        service_interest: lead.service_interest,
                        lead_score: lead.lead_score
                    }
                });
            });
        }

        // Add appointment events
        if (appointments && !appointmentsError) {
            appointments.forEach((apt: any) => {
                events.push({
                    id: `appointment_${apt.id}`,
                    type: 'appointment_booked',
                    timestamp: apt.created_at,
                    summary: `📅 Appointment for ${apt.customer_name || 'Unknown'}`,
                    metadata: {
                        customer_name: apt.customer_name,
                        scheduled_at: apt.scheduled_at,
                        contact_phone: apt.contact_phone
                    }
                });
            });
        }

        // Sort by timestamp (newest first) and limit to 10
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const recentEvents = events.slice(0, 10);

        return res.json({ events: recentEvents });
    } catch (err: any) {
        log.error('AnalyticsAPI', 'Failed to fetch recent activity', { error: err.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default analyticsRouter;
