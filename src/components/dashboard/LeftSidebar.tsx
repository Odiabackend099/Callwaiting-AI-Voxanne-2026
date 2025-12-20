'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Activity, Phone, Bot, Zap, LogOut, Key, BookOpen, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';

export default function LeftSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = useMemo(() => ([
        { label: 'Dashboard', href: '/dashboard', icon: Activity },
        { label: 'Call Logs', href: '/dashboard/calls', icon: Phone },
        { label: 'Agent Configuration', href: '/dashboard/agent-config', icon: Bot },
        { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen },
        { label: 'API Keys', href: '/dashboard/api-keys', icon: Key },
        { label: 'Test Agents', href: '/dashboard/test', icon: Zap },
    ]), []);

    const handleNavigate = (href: string) => {
        try {
            const isVoiceActive = typeof window !== 'undefined' && window.sessionStorage.getItem('voice_session_active') === 'true';

            // Voice session is persisted across dashboard routes, so do not warn when navigating within /dashboard.
            const leavingDashboard = !href.startsWith('/dashboard');
            if (isVoiceActive && leavingDashboard) {
                const ok = window.confirm('A voice session is currently active. Leaving the dashboard may stop the call. Continue?');
                if (!ok) return;
            }
        } catch {
            // ignore
        }

        router.push(href);
        setMobileOpen(false);
    };

    const handleLogout = () => {
        try {
            const isVoiceActive = typeof window !== 'undefined' && window.sessionStorage.getItem('voice_session_active') === 'true';
            if (isVoiceActive) {
                const ok = window.confirm('A voice session is currently active. Logging out may stop the call. Continue?');
                if (!ok) return;
            }
        } catch {
            // ignore
        }

        signOut();
        router.push('/login');
        setMobileOpen(false);
    };

    const SidebarContents = (
        <>
            <div className="p-6 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <Image
                            src="/callwaiting-ai-logo.png"
                            alt="CallWaiting AI"
                            width={40}
                            height={40}
                            className="object-contain"
                            priority
                        />
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-slate-50">Call Waiting AI</span>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname?.startsWith(item.href);

                    return (
                        <button
                            key={item.href}
                            onClick={() => handleNavigate(item.href)}
                            className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-all font-medium text-left ${isActive
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
                <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-50 truncate" title={user?.email || ''}>
                        {user?.email}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400">Account</p>
                </div>
                <div className="flex gap-2">
                    <ThemeToggle />
                    <button
                        onClick={handleLogout}
                        className="flex-1 px-4 py-2 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium"
                    >
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <>
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 z-20 flex items-center justify-between px-4">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Open menu"
                >
                    <Menu className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-2">
                    <Image
                        src="/callwaiting-ai-logo.png"
                        alt="CallWaiting AI"
                        width={28}
                        height={28}
                        className="rounded object-contain"
                        priority
                    />
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-50">Call Waiting AI</span>
                </div>

                <div className="w-10" />
            </div>

            <div className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex-col z-10">
                {SidebarContents}
            </div>

            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-30">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Image
                                    src="/callwaiting-ai-logo.png"
                                    alt="CallWaiting AI"
                                    width={36}
                                    height={36}
                                    className="rounded object-contain"
                                    priority
                                />
                                <span className="text-lg font-bold text-gray-900 dark:text-slate-50">Call Waiting AI</span>
                            </div>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        {SidebarContents}
                    </div>
                </div>
            )}
        </>
    );
}
