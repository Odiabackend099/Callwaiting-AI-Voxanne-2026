'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Phone, Bot, Zap, LogOut, Key, BookOpen, Menu, X, Users, Settings, Bell, Target, Smartphone, Wallet } from 'lucide-react';
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
                { label: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
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
                { label: 'AI Forwarding', href: '/dashboard/telephony', icon: Smartphone },
                { label: 'Settings', href: '/dashboard/settings', icon: Settings },
            ],
        },
    ]), []);

    const footerItems = useMemo(() => ([
        { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ]), []);

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
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
                    <div className="w-8 h-8 rounded-xl bg-[#0000FF]/10 flex items-center justify-center border border-[#AACCFF] shadow-sm overflow-hidden">
                        <Image
                            src="/Brand/3.png"
                            alt="Voxanne"
                            width={32}
                            height={32}
                            className="object-contain w-full h-full"
                            priority
                        />
                    </div>
                    <span className="text-lg font-bold text-[#0A0E27] tracking-tight">
                        Voxanne
                    </span>
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar">
                {navSections.map((section) => (
                    <div key={section.label}>
                        <h3 className="px-3 py-2 text-xs font-semibold text-[#0A0E27]/50 uppercase tracking-wider">
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
                                        className={`group relative w-full px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all duration-200 font-semibold text-sm text-left ${isActive
                                            ? 'text-[#0000FF] bg-gradient-to-r from-[#0000FF]/10 to-transparent border-l-4 border-[#0000FF] shadow-sm'
                                            : 'text-[#0A0E27]/60 hover:text-[#0A0E27] hover:bg-[#AACCFF]/10'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 transition-colors ${isActive
                                            ? 'text-[#0000FF]'
                                            : 'text-[#0A0E27]/40 group-hover:text-[#0A0E27]/70'
                                            }`} />
                                        <span className="tracking-tight">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Divider before footer items */}
                <div className="pt-4 mt-2 border-t border-[#AACCFF]/50">
                    <h3 className="px-3 py-2 text-xs font-semibold text-[#0A0E27]/50 uppercase tracking-wider">
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
                                    className={`group relative w-full px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all duration-200 font-semibold text-sm text-left ${isActive
                                        ? 'text-[#0000FF] bg-gradient-to-r from-[#0000FF]/10 to-transparent border-l-4 border-[#0000FF] shadow-sm'
                                        : 'text-[#0A0E27]/60 hover:text-[#0A0E27] hover:bg-[#AACCFF]/10'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 transition-colors ${isActive
                                        ? 'text-[#0000FF]'
                                        : 'text-[#0A0E27]/40 group-hover:text-[#0A0E27]/70'
                                        }`} />
                                    <span className="tracking-tight">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <div className="p-4 space-y-1">
                <div className="px-3 py-2.5 rounded-lg border border-[#AACCFF] bg-white mb-2 shadow-sm">
                    <p className="text-xs font-semibold text-[#0A0E27] truncate tracking-tight">
                        {user?.email}
                    </p>
                    <p className="text-[10px] text-[#0A0E27]/60 uppercase tracking-wider font-medium">Prepaid</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#0A0E27]/60 hover:text-[#0A0E27] hover:bg-[#0A0E27]/5 transition-all flex items-center justify-center gap-2"
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
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 border-b border-[#AACCFF]/50 z-20 flex items-center justify-between px-4 backdrop-blur-md shadow-sm">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 rounded-lg text-[#0A0E27]/60 hover:bg-[#AACCFF]/10 transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#0A0E27]">
                        Voxanne
                    </span>
                </div>

                <div className="w-9" />
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex fixed left-4 top-4 bottom-4 w-60 bg-white/80 border border-[#AACCFF] rounded-2xl flex-col z-10 backdrop-blur-xl shadow-2xl shadow-[#3366FF]/10">
                {SidebarContents}
            </div>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-30">
                    <div className="absolute inset-0 bg-[#0A0E27]/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-72 bg-white border-r border-[#AACCFF] flex flex-col shadow-2xl">
                        <div className="p-4 flex items-center justify-between border-b border-[#AACCFF]/50">
                            <span className="text-lg font-bold text-[#0A0E27] tracking-tight">Voxanne</span>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 rounded-lg text-[#0A0E27]/60 hover:bg-[#AACCFF]/10 transition-colors"
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
