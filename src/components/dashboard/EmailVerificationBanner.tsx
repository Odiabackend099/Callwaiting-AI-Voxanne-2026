'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

export function EmailVerificationBanner() {
  const [user, setUser] = useState<{ email: string; created_at: string } | null>(null);
  const [daysLeft, setDaysLeft] = useState(7);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }: { data: { user: import('@supabase/supabase-js').User | null } }) => {
      if (!u) return;
      // Already confirmed — never show
      if ((u as any).email_confirmed_at) return;
      const created = new Date(u.created_at ?? Date.now());
      const days = 7 - Math.floor((Date.now() - created.getTime()) / 86_400_000);
      setDaysLeft(Math.max(days, 0));
      setUser({ email: u.email ?? '', created_at: u.created_at });
    });
  }, []);

  if (!user || verified || dismissed) return null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!user || otpCode.length !== 6) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: user.email,
      token: otpCode,
      type: 'signup',
    });
    if (verifyError) {
      setError('Invalid code — double-check the 6 digits from your email.');
    } else {
      setVerified(true);
    }
    setVerifying(false);
  }

  async function handleResend() {
    if (!user) return;
    await supabase.auth.resend({ type: 'signup', email: user.email });
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  }

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: message */}
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-amber-800 font-medium">
            Verify your email to secure your account
            {daysLeft > 0 ? (
              <span className="font-normal text-amber-600 ml-1">— {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
            ) : (
              <span className="font-normal text-amber-600 ml-1">— access expires soon</span>
            )}
          </span>
        </div>

        {/* Right: OTP form */}
        <form onSubmit={handleVerify} className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="6-digit code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-28 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-sm text-obsidian placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 tracking-widest text-center"
          />
          <button
            type="submit"
            disabled={verifying || otpCode.length !== 6}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Verify
          </button>
        </form>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <div className="mt-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={handleResend}
          className="text-xs text-amber-600 hover:text-amber-700 underline"
        >
          {resent ? '✓ Code sent!' : 'Resend code'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-amber-400 hover:text-amber-500 flex items-center gap-0.5"
          aria-label="Dismiss banner"
        >
          <X className="h-3 w-3" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
