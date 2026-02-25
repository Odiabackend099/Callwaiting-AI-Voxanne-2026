"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { useState, Suspense } from "react";
import FadeIn from "@/components/ui/FadeIn";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthRateLimit } from "@/hooks/useAuthRateLimit";

const ERROR_MESSAGES: Record<string, string> = {
    'no_org': 'Your account setup is incomplete — your workspace was not created correctly. Please sign out and sign up again, or contact support@voxanne.ai.',
    'no_org_id': 'Your account setup is incomplete. Please sign out and sign up again, or contact support@voxanne.ai.',
    'invalid_org_id': 'Your organization ID is invalid. Please sign out and sign up again, or contact support@voxanne.ai.',
    'validation_failed': 'Account validation failed. Please try signing in again.',
};

function LoginContent() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const errorCode = searchParams.get('error');
    const queryError = errorCode
        ? (ERROR_MESSAGES[errorCode] || `Authentication error: ${errorCode}`)
        : null;
    const { lockedOut, timerLabel, recordFailure, reset } = useAuthRateLimit('login');

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                recordFailure();
                setLoading(false);
                return;
            }

            reset();
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setError("An unexpected error occurred");
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
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
            if (error) throw error;
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="h-screen overflow-hidden grid lg:grid-cols-2">
            {/* Left Column: Form */}
            <div className="flex flex-col justify-center px-8 py-12 lg:px-20 xl:px-32 bg-white relative overflow-y-auto">
                <FadeIn>
                    <div className="mb-10">
                        <div className="mb-6 flex items-center justify-between">
                            <Logo
                                variant="icon-blue"
                                size="xl"
                                className="h-16 w-auto"
                            />
                            <Link
                                href="/"
                                className="text-sm font-medium text-surgical-600 hover:text-surgical-700 transition-colors"
                            >
                                Back to Home Page
                            </Link>
                        </div>
                        <h1 className="text-4xl font-bold text-obsidian tracking-tighter mb-2">
                            Welcome Back
                        </h1>
                        <p className="text-lg text-obsidian/70">
                            Secure access for clinical staff
                        </p>
                    </div>

                    <form onSubmit={handleSignIn} className="space-y-6">
                        {queryError && !error && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm space-y-2">
                                <p>{queryError}</p>
                                {errorCode === 'no_org' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await supabase.auth.signOut();
                                            window.location.href = '/sign-up';
                                        }}
                                        className="underline font-medium hover:text-amber-900 transition-colors"
                                    >
                                        Sign out and start over →
                                    </button>
                                )}
                            </div>
                        )}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-obsidian">Email address</label>
                            <Input
                                id="email"
                                type="email"
                                placeholder=""
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="text-sm font-medium text-obsidian">Password</label>
                                <Link href="/forgot-password" className="text-sm font-medium text-surgical-600 hover:text-surgical-700">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder=""
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian/40 hover:text-obsidian/60 transition-colors"
                                    disabled={loading}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-base font-semibold bg-surgical-600 text-white rounded-xl shadow-lg shadow-surgical-600/25 hover:shadow-xl hover:shadow-surgical-600/35 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100 focus:outline-none focus:ring-2 focus:ring-surgical-600/50 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
                            disabled={loading || lockedOut}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing In...
                                </>
                            ) : lockedOut ? (
                                `Too many attempts — retry in ${timerLabel}`
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-surgical-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-obsidian/60">OR</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 gap-3 text-obsidian border-2 border-surgical-200 rounded-xl bg-white shadow-md hover:shadow-lg hover:bg-surgical-50 hover:scale-[1.02] active:scale-100 focus:outline-none focus:ring-2 focus:ring-surgical-600/30 focus:ring-offset-2 transition-all duration-200"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-obsidian/40" />
                        ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                        )}
                        Continue with Google
                    </Button>

                    <p className="mt-8 text-center text-sm text-obsidian/60">
                        Don&apos;t have an account?{" "}
                        <Link href="/sign-up" className="font-medium text-surgical-600 hover:text-surgical-700">
                            Sign Up
                        </Link>
                    </p>
                </FadeIn>
            </div>


            {/* Right Column: Image/Testimonial */}
            <div className="hidden lg:flex relative bg-obsidian items-center justify-center overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }}
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-obsidian via-obsidian/95 to-surgical-700/40" />

                <div className="relative z-10 max-w-lg px-12 text-center">
                    <FadeIn delay={0.2}>
                        <blockquote className="text-3xl font-bold leading-relaxed mb-8 text-white">
                            &quot;The most trusted voice AI for medical professionals.&quot;
                        </blockquote>
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-px w-12 bg-surgical-500" />
                            <p className="text-surgical-100 font-medium tracking-wide uppercase text-sm">
                                Healthcare Leaders Survey 2025
                            </p>
                        </div>

                        <div className="mt-16 flex items-center justify-center gap-6">
                            <div className="flex -space-x-4">
                                {[
                                    { name: 'Twilio', logo: '/integrations/twilio.png' },
                                    { name: 'Vapi', logo: '/integrations/vapi.png' },
                                    { name: 'Google Calendar', logo: '/integrations/google-calendar.png' }
                                ].map((integration, i) => (
                                    <div key={i} className="h-12 w-12 rounded-full border-2 border-obsidian bg-white overflow-hidden relative flex items-center justify-center p-2">
                                        <Image
                                            src={integration.logo}
                                            alt={integration.name}
                                            width={40}
                                            height={40}
                                            className="object-contain"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="text-left">
                                <p className="text-white font-semibold text-base mb-1">
                                    Trusted Integrations
                                </p>
                                <p className="text-surgical-100 text-sm">
                                    to help you automate your front desk
                                </p>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
