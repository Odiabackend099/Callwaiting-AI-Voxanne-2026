'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Phone, Bot, Zap, LogOut, Key, BookOpen, Menu, X, Users, Settings, Bell, Target, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LeftSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navSections = useMemo(() => ([
        {
            label: 'OPERATIONS',
            description: 'Review calls, manage leads, and monitor agent activity',
            items: [
                { label: 'Dashboard', href: '/dashboard', icon: Activity },
                { label: 'Call Logs', href: '/dashboard/calls', icon: Phone },
                { label: 'Leads', href: '/dashboard/leads', icon: Target },
            ],
        },
        {
            label: 'VOICE AGENT',
            description: 'Configure, train, and test your AI agents',
            items: [
                { label: 'Agent Configuration', href: '/dashboard/agent-config', icon: Bot },
                { label: 'Escalation Rules', href: '/dashboard/escalation-rules', icon: Zap },
                { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen },
                { label: 'Test Agents', href: '/dashboard/test', icon: Phone },
            ],
        },
        {
            label: 'INTEGRATIONS',
            description: 'Set up and manage API keys and phone numbers',
            items: [
                { label: 'API Keys', href: '/dashboard/api-keys', icon: Key },
                { label: 'Telephony', href: '/dashboard/inbound-config', icon: Phone },
                { label: 'Hybrid Telephony', href: '/dashboard/telephony', icon: Smartphone },
                { label: 'Settings', href: '/dashboard/settings', icon: Settings },
            ],
        },
    ]), []);

    const footerItems = useMemo(() => ([
        { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ]), []);

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        // Voice session check
        try {
            const isVoiceActive = typeof window !== 'undefined' && window.sessionStorage.getItem('voice_session_active') === 'true';
            const leavingDashboard = !href.startsWith('/dashboard');

            if (isVoiceActive && leavingDashboard) {
                const ok = window.confirm('A voice session is currently active. Leaving the dashboard may stop the call. Continue?');
                if (!ok) {
                    e.preventDefault();
                    return;
                }
            }
        } catch {
            // ignore
        }

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
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 shadow-inner overflow-hidden backdrop-blur-sm">
                        <Image
                            src="/callwaiting-ai-logo.png"
                            alt="CallWaiting AI"
                            width={32}
                            height={32}
                            className="object-contain w-full h-full"
                            priority
                        />
                    </div>
                    <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 tracking-tight">
                        Voxanne
                    </span>
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar">
                {navSections.map((section) => (
                    <div key={section.label}>
                        <h3 className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
                            {section.label}
                        </h3>
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.href === '/dashboard'
                                    ? pathname === '/dashboard'
                                    : pathname?.startsWith(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={(e) => handleLinkClick(e, item.href)}
                                        className={`group relative w-full px-3 py-2 rounded-lg flex items-center gap-3 transition-all duration-200 font-medium text-sm text-left ${isActive
                                            ? 'text-slate-900 bg-slate-100/80 shadow-sm backdrop-blur-sm'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-surgical-600 rounded-r-full" />
                                        )}
                                        <Icon className={`w-4 h-4 transition-colors ${isActive
                                            ? 'text-surgical-600'
                                            : 'text-slate-400 group-hover:text-slate-600'
                                            }`} />
                                        <span className="tracking-tight">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Divider before footer items */}
                <div className="pt-4 mt-2 border-t border-slate-100">
                    <h3 className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
                        QUICK ACCESS
                    </h3>
                    <div className="space-y-0.5">
                        {footerItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname?.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={(e) => handleLinkClick(e, item.href)}
                                    className={`group relative w-full px-3 py-2 rounded-lg flex items-center gap-3 transition-all duration-200 font-medium text-sm text-left ${isActive
                                        ? 'text-slate-900 bg-white/80 shadow-sm border border-slate-200/50 backdrop-blur-sm'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 transition-colors ${isActive
                                        ? 'text-surgical-600'
                                        : 'text-slate-400 group-hover:text-slate-600'
                                        }`} />
                                    <span className="tracking-tight">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <div className="p-4 space-y-1">
                <div className="px-3 py-2 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-sm mb-2">
                    <p className="text-xs font-semibold text-slate-900 truncate tracking-tight">
                        {user?.email}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Pro Plan</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 border-b border-slate-200 z-20 flex items-center justify-between px-4 backdrop-blur-md">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900">
                        Voxanne
                    </span>
                </div>

                <div className="w-9" />
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex fixed left-4 top-4 bottom-4 w-60 bg-white/80 border border-slate-200/60 rounded-2xl flex-col z-10 backdrop-blur-xl shadow-2xl shadow-slate-200/20">
                {SidebarContents}
            </div>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-30">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-72 bg-white border-r border-slate-200 flex flex-col shadow-2xl">
                        <div className="p-4 flex items-center justify-between border-b border-slate-100">
                            <span className="text-lg font-bold text-slate-900 tracking-tight">Voxanne</span>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {SidebarContents}
                    </div>
                </div>
            )}
        </>
    );
}
