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
        <Loader2 className="w-8 h-8 animate-spin text-surgical-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-surgical-50 flex items-center justify-center border border-surgical-200">
          <Smartphone className="w-6 h-6 text-surgical-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-obsidian">
            AI Forwarding Setup
          </h1>
          <p className="text-obsidian/60">
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
          <div className="bg-white border border-surgical-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-obsidian mb-4">
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

          <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-surgical-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-obsidian mb-1">
                  No Porting Required
                </h4>
                <p className="text-sm text-obsidian/60">
                  Your phone number stays with your current carrier. We use call forwarding to route calls to AI.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-surgical-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-700 mt-0.5" />
              <div>
                <h4 className="font-medium text-obsidian mb-1">
                  Your Caller ID
                </h4>
                <p className="text-sm text-obsidian/60">
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
      <div className="w-6 h-6 rounded-full bg-surgical-50 flex items-center justify-center text-xs font-bold text-obsidian/60 flex-shrink-0">
        {number}
      </div>
      <div>
        <h4 className="font-medium text-obsidian text-sm">{title}</h4>
        <p className="text-xs text-obsidian/60 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
