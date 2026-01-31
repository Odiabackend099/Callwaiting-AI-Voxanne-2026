import { supabase } from './supabase';
import { authedBackendFetch } from './authed-backend-fetch';

// Helper to get current user
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
}

// Helper to get user settings
export async function getUserSettings(userId: string) {
    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

    if (error) {
        console.error('Supabase error:', JSON.stringify(error, null, 2));
        throw error;
    }

    return data?.[0] || null;
}

// Helper to save user settings
export async function saveUserSettings(userId: string, settings: {
    business_name?: string;
    system_prompt?: string;
    voice_personality?: 'professional' | 'friendly' | 'casual';
}) {
    const { data, error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: userId,
            ...settings,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Helper to get knowledge base documents
// Updated to use backend API instead of direct Supabase query
export async function getKnowledgeBase(userId: string) {
    try {
        const data = await authedBackendFetch<{ items: any[] }>('/api/knowledge-base');
        return data.items || [];
    } catch (error: any) {
        throw error;
    }
}

// Helper to save knowledge base document
// Updated to use backend API instead of direct Supabase query
export async function saveKnowledgeBase(userId: string, content: string, filename: string = 'knowledge.txt') {
    try {
        const data = await authedBackendFetch<any>('/api/knowledge-base', {
            method: 'POST',
            body: JSON.stringify({
                filename,
                content,
                category: 'general',
                active: true
            })
        });
        return data;
    } catch (error: any) {
        throw error;
    }
}

// Helper to delete knowledge base document
// Updated to use backend API instead of direct Supabase query
export async function deleteKnowledgeBase(id: string) {
    try {
        await authedBackendFetch(`/api/knowledge-base/${id}`, {
            method: 'DELETE'
        });
    } catch (error: any) {
        throw error;
    }
}

// Helper to get voice sessions
export async function getVoiceSessions(userId: string, limit: number = 10) {
    const { data, error } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

// Helper to get session transcripts
export async function getSessionTranscripts(sessionId: string) {
    const { data, error } = await supabase
        .from('voice_test_transcripts')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
}

// Helper to get dashboard stats
export async function getDashboardStats(userId: string) {
    // Get total voice sessions
    const { count: totalSessions, error: sessionsError } = await supabase
        .from('voice_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (sessionsError) throw sessionsError;

    // Get total transcripts
    const { count: totalTranscripts, error: transcriptsError } = await supabase
        .from('voice_test_transcripts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (transcriptsError) throw transcriptsError;

    return {
        totalSessions: totalSessions || 0,
        totalTranscripts: totalTranscripts || 0,
    };
}

// Helper to get inbound agent configuration via backend API
export async function getInboundAgentConfig() {
    try {
        const data = await authedBackendFetch<any>('/api/founder-console/agent/config');
        return data?.inbound || null;
    } catch (error: any) {
        console.error('Failed to fetch inbound agent config:', error);
        throw error;
    }
}
