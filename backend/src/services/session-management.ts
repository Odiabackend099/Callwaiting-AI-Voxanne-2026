import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class SessionManagementService {
  /**
   * Get active sessions for user
   */
  static async getActiveSessions(userId: string) {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('last_activity_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    return data;
  }

  /**
   * Create new session record
   */
  static async createSession(
    userId: string,
    orgId: string,
    sessionToken: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const { data, error } = await supabase
      .from('auth_sessions')
      .insert({
        user_id: userId,
        org_id: orgId,
        session_token: sessionToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return data;
  }

  /**
   * Update session activity timestamp
   */
  static async updateSessionActivity(sessionToken: string) {
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        last_activity_at: new Date().toISOString(),
      })
      .eq('session_token', sessionToken)
      .is('revoked_at', null);

    if (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  /**
   * Revoke session (force logout)
   */
  static async revokeSession(sessionId: string, reason: string) {
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to revoke session: ${error.message}`);
    }

    // Log the event
    const session = await supabase
      .from('auth_sessions')
      .select('user_id, org_id')
      .eq('id', sessionId)
      .single();

    if (session.data) {
      await this.logAuthEvent(
        session.data.user_id,
        session.data.org_id,
        'session_revoked',
        { reason, session_id: sessionId }
      );
    }
  }

  /**
   * Revoke all sessions for user (except current)
   */
  static async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'User logged out from all devices',
      })
      .eq('user_id', userId)
      .neq('id', currentSessionId)
      .is('revoked_at', null);

    if (error) {
      throw new Error(`Failed to revoke sessions: ${error.message}`);
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions() {
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'Session expired',
      })
      .lt('expires_at', new Date().toISOString())
      .is('revoked_at', null);

    if (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Log authentication event
   */
  static async logAuthEvent(
    userId: string,
    orgId: string,
    eventType: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { error } = await supabase.rpc('log_auth_event', {
      p_user_id: userId,
      p_org_id: orgId,
      p_event_type: eventType,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_metadata: metadata,
    });

    if (error) {
      console.error('Failed to log auth event:', error);
    }
  }

  /**
   * Get authentication audit log for user
   */
  static async getAuditLog(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('auth_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return data;
  }

  /**
   * Get failed login attempts for user (security monitoring)
   */
  static async getFailedLoginAttempts(userId: string, hours: number = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data, error } = await supabase
      .from('auth_audit_log')
      .select('*')
      .eq('user_id', userId)
      .eq('event_type', 'login_failed')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch failed login attempts: ${error.message}`);
    }

    return data;
  }
}
