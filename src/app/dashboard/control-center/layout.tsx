'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Overview', href: '/dashboard/control-center', icon: '📊' },
  { label: 'Calls', href: '/dashboard/control-center/calls', icon: '📞' },
  { label: 'Appointments', href: '/dashboard/control-center/appointments', icon: '📅' },
];

export default function ControlCenterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            VoxAn Control Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">See how your AI agent is performing</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => {
          const isActive = tab.href === '/dashboard/control-center'
            ? pathname === '/dashboard/control-center'
            : pathname?.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      {children}
    </div>
  );
}
