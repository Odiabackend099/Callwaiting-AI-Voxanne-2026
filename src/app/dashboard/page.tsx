"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Phone, Settings, Activity, Clock, LogOut, User as UserIcon, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUser, getUserSettings, getDashboardStats } from '@/lib/supabaseHelpers';
import Link from 'next/link';
import Image from 'next/image';

export default function DashboardPage() {
    const router = useRouter();
    const { signOut, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSessions: 0,
        totalTranscripts: 0,
    });
    const [userSettings, setUserSettings] = useState<any>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const currentUser = await getCurrentUser();
            if (!currentUser) {
                // If auth context is slow, layout might handle redirect, but safe to check
                return;
            }

            try {
                const settings = await getUserSettings(currentUser.id);
                setUserSettings(settings);
            } catch (e) {
                console.error(e);
            }

            try {
                const dashboardStats = await getDashboardStats(currentUser.id);
                setStats(dashboardStats);
            } catch (e) {
                console.error(e);
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            // router.refresh handled in AuthContext
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-slate-200 font-sans selection:bg-cyan-500/30">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8">
                                <Image
                                    src="/callwaiting-ai-logo.png"
                                    alt="CallWaiting AI"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">CallWaiting AI</span>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                <UserIcon className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-300">{user?.email}</span>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                                title="Sign Out"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </nav>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2 text-slate-400 hover:text-white"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-white/10 bg-black">
                        <div className="px-4 py-4 space-y-4">
                            <div className="text-sm text-slate-400 px-2">{user?.email}</div>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 text-red-400 hover:text-red-300 w-full px-2 py-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section with Primary Action */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                        <p className="text-slate-400">Welcome back to your practice overview.</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/voice-test')}
                        className="flex items-center justify-center gap-2 bg-white text-black hover:bg-slate-200 px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all w-full md:w-auto"
                    >
                        <Phone className="w-5 h-5 fill-black" />
                        Test Voice Agent
                    </motion.button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <DashboardCard
                        Icon={Activity}
                        iconColor="text-cyan-400"
                        label="Total Sessions"
                        value={stats.totalSessions}
                    />
                    <DashboardCard
                        Icon={Clock}
                        iconColor="text-purple-400"
                        label="Total Messages"
                        value={stats.totalTranscripts}
                    />
                    <DashboardCard
                        Icon={Settings}
                        iconColor="text-emerald-400"
                        label="Configuration"
                        value={userSettings?.business_name || 'Not Configured'}
                        subValue={userSettings?.business_name ? 'Active' : 'Setup Required'}
                    />
                </div>

                {/* Quick Actions Grid */}
                <h2 className="text-xl font-bold text-white mb-6">Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ActionCard
                        title="Agent Settings"
                        description="Configure your business profile, operating hours, and voice personality."
                        icon={<Settings className="w-6 h-6 text-white" />}
                        onClick={() => router.push('/dashboard/settings')}
                    />
                    {/* Placeholder for future features */}
                    <ActionCard
                        title="Call Logs"
                        description="Review transcripts and audio recordings of past calls."
                        icon={<Activity className="w-6 h-6 text-slate-400" />}
                        disabled
                        badge="Coming Soon"
                    />
                </div>
            </main>
        </div>
    );
}

function DashboardCard({ Icon, iconColor, label, value, subValue }: { Icon: any, iconColor: string, label: string, value: string | number, subValue?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1 truncate">{value}</div>
            <div className="text-sm font-medium text-slate-400">{label}</div>
            {subValue && <div className="text-xs text-slate-500 mt-2">{subValue}</div>}
        </motion.div>
    );
}

function ActionCard({ title, description, icon, onClick, disabled, badge }: any) {
    return (
        <motion.button
            whileHover={!disabled ? { scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={onClick}
            disabled={disabled}
            className={`text-left w-full bg-white/5 border border-white/10 rounded-2xl p-6 transition-colors group relative overflow-hidden ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {badge && (
                <div className="absolute top-4 right-4 bg-white/10 text-xs px-2 py-1 rounded-full text-white/60 border border-white/5">
                    {badge}
                </div>
            )}
            <div className={`p-3 w-fit rounded-xl mb-4 ${disabled ? 'bg-slate-800' : 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30'}`}>
                {icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </motion.button>
    );
}
