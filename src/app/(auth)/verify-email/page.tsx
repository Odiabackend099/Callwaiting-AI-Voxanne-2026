'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail, CheckCircle, AlertCircle, Loader, Copy } from 'lucide-react';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
    const [message, setMessage] = useState('');
    const [code, setCode] = useState('');
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const verifyEmailLink = async () => {
            try {
                // Check if there's a token in the URL
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const token = searchParams.get('token') || hashParams.get('access_token');
                const type = searchParams.get('type') || hashParams.get('type');

                if (token && type === 'email') {
                    // Verify the token
                    const { data, error } = await supabase.auth.verifyOtp({
                        type: 'email',
                        token: token,
                        email: ''
                    });

                    if (error) {
                        setStatus('error');
                        setMessage('Verification link is invalid or expired. Please check your email again or sign up.');
                        setShowCodeInput(true);
                        return;
                    }

                    setStatus('success');
                    setMessage('Email verified successfully!');
                    setTimeout(() => router.push('/auth/login'), 2000);
                } else {
                    setStatus('pending');
                    setShowCodeInput(true);
                }
            } catch (err) {
                console.error('Verification error:', err);
                setStatus('error');
                setMessage('An error occurred during verification. Please try again.');
                setShowCodeInput(true);
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
                type: 'email',
                token: code,
                email: ''
            });

            if (error) {
                setStatus('error');
                setMessage('Invalid verification code. Please check and try again.');
                return;
            }

            setStatus('success');
            setMessage('Email verified successfully!');
            setTimeout(() => router.push('/auth/login'), 2000);
        } catch (err) {
            setStatus('error');
            setMessage('Verification failed. Please try again.');
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
                                Your email has been verified successfully. Redirecting to login...
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
                                Verify Your Email
                            </h1>
                            <p className="text-slate-400 mb-6">
                                Enter the verification code from your email
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
                    <div className="mt-6 text-center">
                        <Link
                            href="/auth/login"
                            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                        >
                            Back to Login
                        </Link>
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
