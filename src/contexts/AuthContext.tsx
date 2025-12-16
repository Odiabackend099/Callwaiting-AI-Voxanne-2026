'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { getAuthCallbackUrl, getPasswordResetCallbackUrl } from '@/lib/auth-redirect';

interface UserSettings {
    business_name?: string;
    system_prompt?: string;
    voice_personality?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    userSettings: UserSettings | null;
    loading: boolean;
    error: string | null;
    signUp: (email: string, password: string, userData?: object) => Promise<{ user: User | null; error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ user: User | null; error: Error | null }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    updatePassword: (password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    updateUserSettings: (settings: UserSettings) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Supabase client for client-side components with cookie handling
    const [supabase] = useState(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ));

    const router = useRouter();

    // Initialize auth state
    useEffect(() => {
        let isMounted = true;

        // Dev-only E2E auth bypass for automated browser testing
        const isE2EBypass = process.env.NODE_ENV !== 'production' &&
            process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === 'true';

        if (isE2EBypass) {
            // Synthetic dev user for browser automation
            const syntheticUser = {
                id: 'dev-user',
                email: 'dev@local',
                aud: 'authenticated',
                role: 'authenticated',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                app_metadata: {},
                user_metadata: {}
            } as any;

            setUser(syntheticUser);
            setSession(null); // Session not needed for bypass
            setLoading(false);

            if (process.env.NODE_ENV !== 'production') {
                console.log('[E2E Auth Bypass] Synthetic dev user enabled');
            }
            return; // Skip normal auth flow
        }

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

                // Fetch settings in background (non-blocking)
                if (data.session?.user) {
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

        // Listen for auth changes (skip if E2E bypass enabled)
        if (isE2EBypass) {
            return () => { isMounted = false; };
        }

        const { data } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                // Only fetch settings on specific events to avoid N+1 queries
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session?.user) {
                        fetchUserSettings(session.user.id).catch(err => {
                            if (isMounted && process.env.NODE_ENV !== 'production') {
                                console.error('Settings fetch failed:', err);
                            }
                        });
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUserSettings(null);
                    setLoading(false);
                    // Don't redirect to login if E2E bypass is enabled
                    if (!isE2EBypass) {
                        router.push('/login');
                    }
                }
            }
        );

        return () => {
            isMounted = false;
            data?.subscription.unsubscribe();
        };
    }, [supabase, router]);

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

    const signUp = async (email: string, password: string, userData?: object) => {
        try {
            setError(null);
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: getAuthCallbackUrl(),
                    data: userData
                }
            });

            if (error) {
                setError(error.message);
                return { user: null, error };
            }

            return { user: data.user, error: null };
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Sign up failed');
            setError(error.message);
            return { user: null, error };
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
            userSettings,
            loading,
            error,
            signUp,
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
