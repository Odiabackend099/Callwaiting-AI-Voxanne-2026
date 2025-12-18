'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Activity, Phone, Bot, Zap, LogOut, PhoneIncoming, PhoneOutgoing, Key, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LeftSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: Activity },
        { label: 'Call Logs', href: '/dashboard/calls', icon: Phone },
        { label: 'Agent Configuration', href: '/dashboard/agent-config', icon: Bot },
        { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen },
        { label: 'API Keys', href: '/dashboard/api-keys', icon: Key },
        { label: 'Test Agents', href: '/dashboard/test', icon: Zap },
    ];

    return (
        <div className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-10">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                        <Phone className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900">Call Waiting AI</span>
                </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    // Check if the current path starts with the item href
                    // Special case for dashboard home to avoid matching everything
                    const isActive = item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname?.startsWith(item.href);

                    return (
                        <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-all font-medium text-left ${isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-gray-200 space-y-3">
                <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 truncate" title={user?.email || ''}>
                        {user?.email}
                    </p>
                    <p className="text-xs text-gray-600">Account</p>
                </div>
                <button
                    onClick={() => {
                        signOut();
                        router.push('/login');
                    }}
                    className="w-full px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 font-medium"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}
