'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getRedirectUrl } from '@/lib/auth-redirect';
import { normalizeAuthError } from '@/lib/auth-errors';
import { Mail, CheckCircle, AlertCircle, Loader, Copy } from 'lucide-react';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
    const [message, setMessage] = useState('');
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const isExpired = searchParams.get('expired') === 'true';
    const [resendLoading, setResendLoading] = useState(false);
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const verifyEmailLink = async () => {
            try {
                const initialEmail = searchParams.get('email') || '';
                if (initialEmail) setEmail(initialEmail);

                // Supabase email confirmation links typically include token_hash + type
                const tokenHash = searchParams.get('token_hash');
                const type = (searchParams.get('type') || 'signup') as any;

                if (tokenHash) {
                    const { error } = await supabase.auth.verifyOtp({
                        type,
                        token_hash: tokenHash,
                    } as any);

                    if (error) {
                        setStatus('error');
                        setMessage('Verification link is invalid or expired. Please request a new verification email.');
                        setShowCodeInput(false);
                        return;
                    }

                    setStatus('success');
                    setMessage('Email verified successfully!');
                    await supabase.auth.getSession().catch(() => null);
                    setTimeout(() => router.push('/dashboard'), 1000);
                    return;
                }

                // No token_hash — user arrived directly (e.g., from dashboard banner or grace expiry).
                // Show the OTP code input so they can enter the 6-digit code from their email.
                setStatus('pending');
                setShowCodeInput(true);
            } catch (err) {
                console.error('Verification error:', err);
                setStatus('error');
                setMessage('An error occurred during verification. Please try again.');
                setShowCodeInput(false);
            }
        };

        verifyEmailLink();
    }, [searchParams, router]);

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code) return;

        try {
            setStatus('loading');
            const { error } = await supabase.auth.verifyOtp({
                type: 'signup',
                email: email.trim(),
                token: code,
            });

            if (error) {
                setStatus('error');
                setMessage('Invalid verification code. Please check and try again.');
                return;
            }

            setStatus('success');
            setMessage('Email verified successfully!');
            await supabase.auth.getSession().catch(() => null);
            setTimeout(() => router.push('/dashboard'), 1000);
        } catch (err) {
            setStatus('error');
            setMessage('Verification failed. Please try again.');
        }
    };

    const handleResend = async () => {
        if (!email.trim()) return;
        setResendLoading(true);
        setMessage('');
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email.trim(),
                options: {
                    emailRedirectTo: getRedirectUrl('/verify-email'),
                },
            } as any);

            if (error) {
                setStatus('error');
                // Always show the same message regardless of whether the email exists,
                // to prevent enumeration of registered email addresses.
                setMessage('If this email is registered and unverified, a new link has been sent. Please check your inbox.');
                return;
            }

            setStatus('pending');
            setMessage('Verification email sent. Please check your inbox.');
        } catch (err) {
            setStatus('error');
            setMessage('Failed to resend verification email.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center">
                    {status === 'loading' && (
                        <>
                            <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Verifying Email
                            </h1>
                            <p className="text-slate-400">
                                Please wait...
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Email Verified
                            </h1>
                            <p className="text-slate-400">
                                Your email has been verified successfully. Redirecting to dashboard...
                            </p>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-6 h-6 text-red-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Verification Failed
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {message}
                            </p>
                        </>
                    )}

                    {status === 'pending' && (
                        <>
                            <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                {isExpired ? 'Verification Required' : 'Verify Your Email'}
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {isExpired
                                    ? 'Your 7-day grace period has ended. Please verify your email to continue using the dashboard.'
                                    : 'Enter the 6-digit code from your verification email.'}
                            </p>
                        </>
                    )}
                </div>

                {showCodeInput && status !== 'success' && (
                    <form onSubmit={handleCodeSubmit} className="mt-8 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Verification Code
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="Enter 6-digit code"
                                    maxLength={6}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-center text-lg tracking-widest"
                                />
                                {code && (
                                    <button
                                        type="button"
                                        onClick={handleCopyCode}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {copied && (
                                <p className="text-xs text-green-400 mt-1">Copied to clipboard</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={code.length !== 6 || status === 'loading'}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                            Verify Email
                        </button>

                        <div className="text-center">
                            <p className="text-sm text-slate-400">
                                Didn&apos;t receive the code?{' '}
                                <button
                                    type="button"
                                    className="text-cyan-400 hover:text-cyan-300"
                                    onClick={() => {
                                        setCode('');
                                        setShowCodeInput(false);
                                        setStatus('pending');
                                    }}
                                >
                                    Try another method
                                </button>
                            </p>
                        </div>
                    </form>
                )}

                {status !== 'success' && (
                    <div className="mt-8 space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={!email.trim() || resendLoading}
                            className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-700 disabled:text-slate-400 font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                            {resendLoading ? 'Sending...' : 'Resend verification email'}
                        </button>
                    </div>
                )}

                {status !== 'success' && (
                    <div className="mt-6 text-center">
                        <Link
                            href="/login"
                            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                        >
                            Back to Login
                        </Link>
                        <div className="mt-3">
                            <a
                                href="https://calendly.com/austyneguale/30min"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white hover:text-cyan-200 text-sm font-semibold transition-colors"
                            >
                                Book a Demo
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                </div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
