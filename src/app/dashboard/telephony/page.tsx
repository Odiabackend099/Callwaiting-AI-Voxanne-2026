'use client';
export const dynamic = "force-dynamic";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Smartphone, Loader2, Phone, CheckCircle, AlertCircle } from 'lucide-react';
import TelephonySetupWizard from './components/TelephonySetupWizard';

export default function TelephonyPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20">
          <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hybrid Telephony Setup
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Connect your personal phone number to AI without porting
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Wizard */}
        <div className="lg:col-span-2">
          <TelephonySetupWizard />
        </div>

        {/* How It Works Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              How It Works
            </h3>
            <div className="space-y-4">
              <Step
                number={1}
                title="Verify Identity"
                description="We call your phone to prove ownership. This lets AI use your Caller ID for outbound calls."
              />
              <Step
                number={2}
                title="Choose Mode"
                description="Type A: AI answers all calls. Type B: AI answers only missed calls."
              />
              <Step
                number={3}
                title="Activate Forwarding"
                description="Dial the generated code on your phone to route calls to AI."
              />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">
                  No Porting Required
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Your phone number stays with your current carrier. We use call forwarding to route calls to AI.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-900 dark:text-emerald-300 mb-1">
                  Your Caller ID
                </h4>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  When AI makes outbound calls, recipients see your personal number, not a random Twilio number.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400 flex-shrink-0">
        {number}
      </div>
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{title}</h4>
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
