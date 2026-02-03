import { authedBackendFetch } from '@/lib/authed-backend-fetch';

/**
 * Dashboard-specific API client
 * Uses the existing authedBackendFetch for authentication
 */
export const dashboardAPI = {
  async getStats(timeWindow = '7d') {
    return authedBackendFetch<any>(`/api/analytics/dashboard-stats?timeWindow=${timeWindow}`);
  },

  async getDashboardPulse() {
    return authedBackendFetch<any>('/api/analytics/dashboard-pulse');
  },

  async getLeads() {
    return authedBackendFetch<any>('/api/analytics/leads');
  },

  async getRecentActivity() {
    return authedBackendFetch<any>('/api/analytics/recent-activity');
  }
};
