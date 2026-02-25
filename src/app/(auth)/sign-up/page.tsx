'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FadeIn from '@/components/ui/FadeIn';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuthRateLimit } from '@/hooks/useAuthRateLimit';

function getPasswordStrength(p: string): { score: number; label: string; color: string } {
  if (p.length < 8) return { score: 0, label: 'Too short', color: 'bg-red-400' };
  let score = 1;
  if (p.length >= 12 || (/[A-Z]/.test(p) && /[a-z]/.test(p))) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  score = Math.min(score, 4);
  const levels = [
    { score: 1, label: 'Weak', color: 'bg-red-400' },
    { score: 2, label: 'Fair', color: 'bg-amber-400' },
    { score: 3, label: 'Strong', color: 'bg-blue-500' },
    { score: 4, label: 'Very strong', color: 'bg-green-500' },
  ];
  return levels[score - 1];
}

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<{ label: string; href: string } | null>(null);

  const strength = password.length > 0 ? getPasswordStrength(password) : null;
  const { lockedOut, timerLabel, recordFailure, reset } = useAuthRateLimit('signup');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorLink(null);

    if (!strength || strength.score < 2) {
      setError(strength?.score === 0
        ? 'Password must be at least 8 characters.'
        : 'Password is too weak — use 8+ characters with a mix of letters and numbers.');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create account via server-side API.
      // Uses admin.createUser() which bypasses the Supabase "Allow new users to sign up"
      // project-level restriction. The DB trigger creates org + profile + JWT metadata.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const result: { success?: boolean; error?: string; provider?: string[] } = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Tailor the message if the account was created via a social provider.
          const providers = result.provider ?? [];
          if (providers.includes('google')) {
            setError('This email is linked to a Google account.');
            setErrorLink({ label: 'Sign in with Google', href: '/login' });
          } else {
            setError('An account with this email already exists.');
            setErrorLink({ label: 'Sign in instead', href: '/login' });
          }
        } else {
          setError(result.error ?? 'Failed to create account. Please try again.');
          setErrorLink(null);
          recordFailure();
        }
        setLoading(false);
        return;
      }

      // Step 2: Sign in to obtain a session.
      // The account was created with email_confirm: true so sign-in is immediate.
      // The trigger has already set app_metadata.org_id, so the JWT is backend-ready.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !signInData.session) {
        // Account was created but auto sign-in failed — send user to login.
        setError('Account created! Please sign in to continue.');
        setErrorLink(null);
        setLoading(false);
        router.push('/login');
        return;
      }

      reset(); // Clear rate-limit counter on success
      router.push('/dashboard/onboarding');
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setErrorLink(null);
      recordFailure();
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    setErrorLink(null);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden grid lg:grid-cols-2">
      {/* Left Column: Form */}
      <div className="flex flex-col justify-center px-8 py-12 lg:px-20 xl:px-32 bg-white relative overflow-y-auto">
        <FadeIn>
          <div className="mb-8">
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
                Back to Home
              </Link>
            </div>
            <h1 className="text-4xl font-bold text-obsidian tracking-tighter mb-2">
              Create your account
            </h1>
            <p className="text-lg text-obsidian/70">
              Get your AI receptionist up and running in minutes
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
              {error}{' '}
              {errorLink && (
                <Link href={errorLink.href} className="font-semibold underline hover:no-underline">
                  {errorLink.label} →
                </Link>
              )}
            </div>
          )}

          {/* Google OAuth — HERO CTA (industry standard: above form) */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 gap-3 text-obsidian border-2 border-surgical-200 rounded-xl bg-white shadow-md hover:shadow-lg hover:bg-surgical-50 hover:scale-[1.02] active:scale-100 focus:outline-none focus:ring-2 focus:ring-surgical-600/30 focus:ring-offset-2 transition-all duration-200 mb-4"
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-obsidian/40" />
            ) : (
              <>
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="font-semibold">Continue with Google</span>
                <ArrowRight className="h-4 w-4 ml-auto text-obsidian/40" />
              </>
            )}
          </Button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surgical-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-obsidian/40 font-medium">or sign up with email</span>
            </div>
          </div>

          {/* Email / Password — secondary option, no confirm password field */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-sm font-medium text-obsidian">
                  First name
                </label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-sm font-medium text-obsidian">
                  Last name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-obsidian">
                Work email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-obsidian">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={password.length > 0 ? 'password-strength' : undefined}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian/40 hover:text-obsidian/60 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {strength && (
                <div
                  role="progressbar"
                  aria-valuenow={strength.score}
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-label="Password strength"
                  className="mt-1.5 space-y-1"
                >
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-colors duration-200 ${
                          strength.score >= i ? strength.color : 'bg-neutral-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p id="password-strength" className="text-xs text-obsidian/50">{strength.label}</p>
                </div>
              )}
            </div>

            {lockedOut && (
              <p className="text-sm text-center text-obsidian/60 mb-3">
                Too many attempts. Retry in {timerLabel}, or{' '}
                <a
                  href="mailto:support@voxanne.ai"
                  className="font-medium text-surgical-600 underline hover:no-underline"
                >
                  contact support
                </a>.
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-surgical-600 text-white rounded-xl shadow-lg shadow-surgical-600/25 hover:shadow-xl hover:shadow-surgical-600/35 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100 focus:outline-none focus:ring-2 focus:ring-surgical-600/50 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
              disabled={
                loading ||
                lockedOut ||
                !firstName.trim() ||
                !lastName.trim() ||
                !email.trim() ||
                (password.length > 0 && (!strength || strength.score < 2))
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : lockedOut ? (
                'Try again later'
              ) : (
                'Create Account →'
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-obsidian/40 leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-surgical-600 hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-surgical-600 hover:underline">Privacy Policy</Link>.
          </p>

          <p className="mt-4 text-center text-sm text-obsidian/60">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-surgical-600 hover:text-surgical-700">
              Sign In
            </Link>
          </p>
        </FadeIn>
      </div>

      {/* Right Column: Social Proof */}
      <div className="hidden lg:flex relative bg-obsidian items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-obsidian via-obsidian/95 to-surgical-700/40" />

        <div className="relative z-10 max-w-lg px-12 text-center">
          <FadeIn delay={0.2}>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white/70 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Setup takes under 5 minutes
              </div>
            </div>

            <blockquote className="text-3xl font-bold leading-relaxed mb-8 text-white">
              &quot;Never miss another patient call. Your AI receptionist starts in minutes.&quot;
            </blockquote>
            <div className="flex flex-col items-center gap-4">
              <div className="h-px w-12 bg-surgical-500" />
              <p className="text-surgical-100 font-medium tracking-wide uppercase text-sm">
                Trusted by Healthcare Professionals
              </p>
            </div>

            <div className="mt-12 flex items-center justify-center gap-6">
              <div className="flex -space-x-4">
                {[
                  { name: 'Twilio', logo: '/integrations/twilio.png' },
                  { name: 'Vapi', logo: '/integrations/vapi.png' },
                  { name: 'Google Calendar', logo: '/integrations/google-calendar.png' },
                ].map((integration, i) => (
                  <div
                    key={i}
                    className="h-12 w-12 rounded-full border-2 border-obsidian bg-white overflow-hidden relative flex items-center justify-center p-2"
                  >
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
