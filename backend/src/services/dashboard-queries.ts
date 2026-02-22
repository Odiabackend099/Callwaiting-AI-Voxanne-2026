/**
 * Dashboard MVP Query Helpers
 * Simplified queries for the Control Center dashboard.
 * All queries are scoped by org_id for multi-tenant safety.
 */

import { supabase } from './supabase-client';
import { log } from './logger';

export async function getRecentCalls(orgId: string, limit = 20) {
  const { data, error } = await supabase
    .from('calls')
    .select(`
      id,
      vapi_call_id,
      phone_number,
      contact_id,
      call_direction,
      status,
      duration_seconds,
      cost_cents,
      recording_url,
      transcript,
      outcome,
      outcome_summary,
      sentiment_label,
      sentiment_score,
      is_test_call,
      created_at
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('DashboardQueries', 'getRecentCalls failed', { orgId, error: error.message });
    return [];
  }

  return data || [];
}

export async function getUpcomingAppointments(orgId: string, limit = 10) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      contact_id,
      scheduled_at,
      duration_minutes,
      status,
      notes,
      service_type,
      created_at
    `)
    .eq('org_id', orgId)
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    log.error('DashboardQueries', 'getUpcomingAppointments failed', { orgId, error: error.message });
    return [];
  }

  return data || [];
}

export async function getWeeklyStats(orgId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  // Fetch calls from last 7 days
  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select('id, status, cost_cents, is_test_call')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (callsError) {
    log.error('DashboardQueries', 'getWeeklyStats calls query failed', { orgId, error: callsError.message });
  }

  // Fetch appointments from last 7 days
  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select('id')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (apptError) {
    log.error('DashboardQueries', 'getWeeklyStats appointments query failed', { orgId, error: apptError.message });
  }

  // Filter out test calls for stats
  const realCalls = (calls || []).filter(c => !c.is_test_call);
  const totalCalls = realCalls.length;
  const answeredCalls = realCalls.filter(c =>
    c.status === 'completed' || c.status === 'answered'
  ).length;
  const totalCostCents = realCalls.reduce((sum, c) => sum + (c.cost_cents || 0), 0);
  const totalAppointments = (appointments || []).length;

  return {
    totalCalls,
    answeredCalls,
    answerRate: totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0,
    totalAppointments,
    totalCostCents,
    totalCost: (totalCostCents / 100).toFixed(2),
  };
}

/**
 * Enrich calls with contact names from the contacts table.
 * Returns a map of contact_id → name.
 */
export async function getContactNames(orgId: string, contactIds: string[]) {
  const uniqueIds = [...new Set(contactIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('org_id', orgId)
    .in('id', uniqueIds);

  if (error) {
    log.error('DashboardQueries', 'getContactNames failed', { orgId, error: error.message });
    return new Map<string, string>();
  }

  const map = new Map<string, string>();
  for (const c of data || []) {
    map.set(c.id, c.name || c.phone || 'Unknown');
  }
  return map;
}
