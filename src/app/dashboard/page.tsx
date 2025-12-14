"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Settings, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardHome() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
                    <p className="text-slate-400">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                                <Phone className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Voxanne</h1>
                                <p className="text-sm text-slate-400">AI Voice Agent</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-16">
                {/* Welcome Section */}
                <div className="mb-16">
                    <h2 className="text-4xl font-bold mb-4">Welcome to Voxanne</h2>
                    <p className="text-xl text-slate-400">Manage your AI voice agent and test conversations</p>
                </div>

                {/* Main Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {/* Voice Test Card */}
                    <div
                        onClick={() => router.push('/dashboard/voice-test')}
                        className="group cursor-pointer bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700/50 backdrop-blur-sm hover:border-cyan-500/50 transition-all hover:scale-105"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Phone className="w-7 h-7 text-cyan-400" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Test Voice Agent</h3>
                        <p className="text-slate-400 mb-4">
                            Have a live conversation with Voxanne. Test responses, voice quality, and agent behavior.
                        </p>
                        <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                            Start Conversation
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Settings Card */}
                    <div
                        onClick={() => router.push('/dashboard/settings')}
                        className="group cursor-pointer bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700/50 backdrop-blur-sm hover:border-emerald-500/50 transition-all hover:scale-105"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Settings className="w-7 h-7 text-emerald-400" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Agent Settings</h3>
                        <p className="text-slate-400 mb-4">
                            Configure your voice agent: business name, personality, system prompt, and knowledge base.
                        </p>
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                            Configure Agent
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* Quick Info */}
                <div className="bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 rounded-2xl p-8 border border-cyan-500/20">
                    <h3 className="text-lg font-bold mb-3">Quick Start</h3>
                    <ul className="space-y-2 text-slate-300">
                        <li className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                            Click "Test Voice Agent" to have a live conversation
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                            Use "Agent Settings" to customize behavior and knowledge base
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                            Test different scenarios and voice personalities
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
