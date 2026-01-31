'use client';

import { WifiOff, RefreshCw, Home, Phone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-surgical-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-surgical-200 p-8 text-center">
        {/* Offline Icon */}
        <div className="w-20 h-20 bg-surgical-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-surgical-600" strokeWidth={2} />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-obsidian mb-3">
          You&apos;re Offline
        </h1>

        {/* Description */}
        <p className="text-obsidian/60 mb-8 leading-relaxed">
          No internet connection detected. Some features may be limited until you&apos;re back online.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="w-full bg-surgical-600 hover:bg-surgical-700 text-white font-medium shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <Link href="/dashboard">
            <Button
              variant="outline"
              className="w-full border-surgical-200 text-obsidian/60 hover:bg-surgical-50 hover:text-obsidian transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        {/* Emergency Contact Section */}
        <div className="mt-8 pt-6 border-t border-surgical-200">
          <p className="text-sm text-obsidian/40 mb-3 font-medium uppercase tracking-wide">
            Emergency Contact
          </p>
          <a
            href="tel:+1234567890"
            className="inline-flex items-center text-surgical-600 hover:text-surgical-700 font-medium transition-colors"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call Support
          </a>
        </div>

        {/* Additional Info */}
        <div className="mt-6 px-4 py-3 bg-surgical-50 rounded-lg border border-surgical-200">
          <p className="text-xs text-obsidian/50 leading-relaxed">
            Your data is cached and will sync automatically when you&apos;re back online.
          </p>
        </div>
      </div>
    </div>
  );
}
