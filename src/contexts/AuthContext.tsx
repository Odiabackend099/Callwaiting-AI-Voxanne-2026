'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

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
        const initializeAuth = async () => {
            try {
                // Get current session
                const { data } = await supabase.auth.getSession();
                setSession(data.session);
                setUser(data.session?.user ?? null);

                if (data.session?.user) {
                    await fetchUserSettings(data.session.user.id);
                }
            } catch (err) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('Auth init error:', err);
                }
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await fetchUserSettings(session.user.id);
                } else {
                    setUserSettings(null);
                }

                if (event === 'SIGNED_OUT') {
                    router.push('/login');
                }
            }
        );

        return () => {
            data?.subscription.unsubscribe();
        };
    }, [supabase, router]);

    const fetchUserSettings = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select()
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
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
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
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
                    redirectTo: `${window.location.origin}/auth/callback`,
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
                redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
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
