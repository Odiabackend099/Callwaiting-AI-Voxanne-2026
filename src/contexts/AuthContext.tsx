'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getAuthCallbackUrl, getPasswordResetCallbackUrl } from '@/lib/auth-redirect';
import { supabase } from '@/lib/supabase';

interface UserSettings {
    business_name?: string;
    system_prompt?: string;
    voice_personality?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isVerified: boolean;
    userSettings: UserSettings | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<{ user: User | null; error: Error | null }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    updatePassword: (password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    updateUserSettings: (settings: UserSettings) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function isEmailVerified(user: User | null): boolean {
    if (!user) return false;
    const u: any = user as any;
    return Boolean(u.email_confirmed_at || u.confirmed_at);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    // Use ref to avoid re-subscriptions when router changes reference
    const routerRef = useRef(router);
    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    // Initialize auth state
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                // Get current session with timeout
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timeout')), 5000)
                );

                const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;

                if (!isMounted) return;

                setSession(data.session);
                setUser(data.session?.user ?? null);

                if (data.session?.user && !isEmailVerified(data.session.user)) {
                    const qs = data.session.user.email ? `?email=${encodeURIComponent(data.session.user.email)}` : '';
                    routerRef.current.push(`/verify-email${qs}`);
                }

                // NOTE: org_id is now obtained from JWT app_metadata (stamped by Phase 1 trigger)
                // AuthContext no longer fetches or manages org_id
                // Validation is handled by useOrgValidation hook
                if (data.session?.user) {
                    // Skip tenant_id fetch - useOrgValidation handles org validation
                    // This prevents overwriting JWT org_id with unvalidated data

                    // Fetch settings in background (non-blocking)
                    fetchUserSettings(data.session.user.id).catch(err => {
                        if (isMounted && process.env.NODE_ENV !== 'production') {
                            console.error('Settings fetch failed:', err);
                        }
                    });
                }
            } catch (err) {
                if (isMounted) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.error('Auth init error:', err);
                    }
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data } = supabase.auth.onAuthStateChange(
            async (event: string, session: any) => {
                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
                    if (!isEmailVerified(session.user)) {
                        const qs = session.user.email ? `?email=${encodeURIComponent(session.user.email)}` : '';
                        routerRef.current.push(`/verify-email${qs}`);
                        return;
                    }

                    // NOTE: org_id is now obtained from JWT app_metadata (stamped by database trigger)
                    // AuthContext no longer fetches or manages org_id
                    // Validation is handled by useOrgValidation hook in dashboard/layout.tsx
                    // org_id should already be in JWT from Phase 1 trigger

                    // Fetch user settings in background (non-blocking)
                    if (isMounted) {
                        fetchUserSettings(session.user.id).catch(err => {
                            if (process.env.NODE_ENV !== 'production') {
                                console.error('Settings fetch failed:', err);
                            }
                        });
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUserSettings(null);
                    localStorage.removeItem('org_id'); // Clean up legacy localStorage
                    setLoading(false);
                    routerRef.current.push('/login');
                }
            }
        );

        return () => {
            isMounted = false;
            data?.subscription.unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Subscribe once on mount - supabase is singleton, router uses ref

    const fetchUserSettings = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select()
                .eq('user_id', userId)
                .maybeSingle();

            // Silently ignore:
            // - PGRST116: No rows found (user has no settings yet)
            // - PGRST205: Table doesn't exist (user_settings not created yet)
            if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('Fetch settings error:', error);
                }
            }

            setUserSettings(data || null);
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Settings fetch error:', err);
            }
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            setError(null);
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                setError(error.message);
                return { user: null, error };
            }

            return { user: data.user, error: null };
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Sign in failed');
            setError(error.message);
            return { user: null, error };
        }
    };

    const signInWithGoogle = async () => {
        try {
            setError(null);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: getAuthCallbackUrl(),
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Google sign in failed');
            setError(error.message);
            return { error };
        }
    };

    const resetPassword = async (email: string) => {
        try {
            setError(null);
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: getPasswordResetCallbackUrl(),
            });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Reset password failed');
            setError(error.message);
            return { error };
        }
    };

    const updatePassword = async (password: string) => {
        try {
            setError(null);
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                setError(error.message);
                return { error };
            }

            return { error: null };
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Update password failed');
            setError(error.message);
            return { error };
        }
    };

    const signOut = async () => {
        try {
            setError(null);
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setUserSettings(null);
            // router.push('/login') is handled in onAuthStateChange
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Sign out failed');
            setError(error.message);
            throw error;
        }
    };

    const updateUserSettings = async (settings: UserSettings) => {
        try {
            if (!user) throw new Error('User not authenticated');

            setError(null);

            const { data, error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    ...settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' })
                .select()
                .single();

            if (error) throw error;

            setUserSettings(data);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Update failed');
            setError(error.message);
            throw error;
        }
    };

    const refreshUser = async () => {
        try {
            if (!user) return;
            await fetchUserSettings(user.id);
        } catch (err) {
            console.error('Refresh user error:', err);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            isVerified: isEmailVerified(user),
            userSettings,
            loading,
            error,
            signIn,
            signInWithGoogle,
            resetPassword,
            updatePassword,
            signOut,
            updateUserSettings,
            refreshUser
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
