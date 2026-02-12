'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import {
  Phone,
  Smartphone,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { BuyNumberModal } from '@/components/dashboard/BuyNumberModal';
import CarrierForwardingInstructions from './components/CarrierForwardingInstructions';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface PhoneSettingsStatus {
  inbound: {
    hasManagedNumber: boolean;
    managedNumber: string | null;
    managedNumberStatus: string | null;
    vapiPhoneId: string | null;
    countryCode: string | null;
  };
  outbound: {
    hasVerifiedNumber: boolean;
    verifiedNumber: string | null;
    verifiedAt: string | null;
    verifiedId: string | null;
  };
  mode: 'managed' | 'byoc' | 'none';
}

type VerificationStep = 'input' | 'verify' | 'success';

export default function PhoneSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { error: showErrorToast } = useToast();
  const [status, setStatus] = useState<PhoneSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buy number modal
  const [showBuyNumberModal, setShowBuyNumberModal] = useState(false);

  // Verification flow
  const [verificationStep, setVerificationStep] = useState<VerificationStep>('input');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Delete confirmations
  const [confirmDeleteManaged, setConfirmDeleteManaged] = useState(false);
  const [confirmDeleteVerified, setConfirmDeleteVerified] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch phone settings status
  useEffect(() => {
    fetchPhoneSettings();
  }, []);

  const fetchPhoneSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authedBackendFetch<PhoneSettingsStatus>('/api/phone-settings/status');
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch phone settings:', err);
      setError(err.message || 'Failed to load phone settings');
    } finally {
      setLoading(false);
    }
  };

  // Verification handlers (outbound lane)
  const handleSendVerification = async () => {
    setVerifying(true);
    setVerificationError(null);

    try {
      await authedBackendFetch('/api/verified-caller-id/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          countryCode: 'US'
        })
      });
      setVerificationStep('verify');
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to send verification call');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmVerification = async () => {
    setVerifying(true);
    setVerificationError(null);

    try {
      await authedBackendFetch('/api/verified-caller-id/confirm', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          code: verificationCode
        })
      });
      setVerificationStep('success');
      // Refresh status to show the new verified number
      await fetchPhoneSettings();
    } catch (err: any) {
      setVerificationError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setVerifying(false);
    }
  };

  const resetVerification = () => {
    setVerificationStep('input');
    setPhoneNumber('');
    setVerificationCode('');
    setVerificationError(null);
  };

  // Delete handlers
  const handleDeleteManaged = async () => {
    if (!status?.inbound.managedNumber) return;

    try {
      setDeleting(true);
      await authedBackendFetch(
        `/api/managed-telephony/numbers/${encodeURIComponent(status.inbound.managedNumber)}`,
        { method: 'DELETE' }
      );
      setConfirmDeleteManaged(false);
      await fetchPhoneSettings();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete number');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteVerified = async () => {
    if (!status?.outbound.verifiedId) return;

    try {
      setDeleting(true);
      await authedBackendFetch(
        `/api/verified-caller-id/${status.outbound.verifiedId}`,
        { method: 'DELETE' }
      );
      setConfirmDeleteVerified(false);
      await fetchPhoneSettings();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete verified number');
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || loading) {
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
          <Phone className="w-6 h-6 text-surgical-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-obsidian">
            Phone Settings
          </h1>
          <p className="text-obsidian/60">
            Manage your inbound AI number and outbound caller ID
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Failed to load phone settings</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchPhoneSettings}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Two-Lane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LANE 1: INBOUND - AI Phone Number */}
        <div className="bg-white border border-surgical-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-surgical-600" />
            <h2 className="text-lg font-semibold text-obsidian">
              Your AI Phone Number
            </h2>
            <span className="text-xs bg-surgical-50 text-surgical-600 px-2 py-1 rounded-full font-medium">
              Inbound
            </span>
          </div>

          {status?.inbound.hasManagedNumber ? (
            // Active managed number
            <div className="space-y-4">
              <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-2xl font-mono font-bold text-surgical-600">
                    {status.inbound.managedNumber}
                  </p>
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
                    Active
                  </span>
                </div>
                <p className="text-xs text-obsidian/60">
                  {status.inbound.countryCode} • Managed by Voxanne
                </p>
              </div>

              <CarrierForwardingInstructions managedNumber={status.inbound.managedNumber!} />

              <button
                onClick={() => setConfirmDeleteManaged(true)}
                className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Number
              </button>
            </div>
          ) : (
            // Empty state - buy number
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-surgical-50 mx-auto flex items-center justify-center mb-4 border border-surgical-200">
                <Smartphone className="w-8 h-8 text-surgical-400" />
              </div>
              <h3 className="text-lg font-semibold text-obsidian mb-2">
                Get Your AI Phone Number
              </h3>
              <p className="text-sm text-obsidian/60 mb-6 max-w-sm mx-auto">
                Purchase a dedicated number for your AI receptionist. Forward your office calls using a simple carrier code.
              </p>
              <button
                onClick={() => setShowBuyNumberModal(true)}
                className="px-6 py-3 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium inline-flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Buy AI Number
              </button>
              <p className="text-xs text-obsidian/60 mt-3">
                $1.50/month + usage-based pricing
              </p>
            </div>
          )}
        </div>

        {/* LANE 2: OUTBOUND - Verified Caller ID */}
        <div className="bg-white border border-surgical-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-surgical-600" />
            <h2 className="text-lg font-semibold text-obsidian">
              Your Outbound Caller ID
            </h2>
            <span className="text-xs bg-surgical-50 text-surgical-600 px-2 py-1 rounded-full font-medium">
              Outbound
            </span>
          </div>

          {status?.outbound.hasVerifiedNumber && verificationStep !== 'success' ? (
            // Active verified number
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-2xl font-mono font-bold text-green-700">
                    {status.outbound.verifiedNumber}
                  </p>
                </div>
                <p className="text-xs text-green-700">
                  Verified on {new Date(status.outbound.verifiedAt!).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                <p className="text-sm text-obsidian">
                  When your AI makes outbound calls, customers see <strong>{status.outbound.verifiedNumber}</strong> on their caller ID.
                </p>
              </div>

              <button
                onClick={() => setConfirmDeleteVerified(true)}
                className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remove Verification
              </button>
            </div>
          ) : (
            // Verification wizard
            <div className="space-y-4">
              {verificationStep === 'input' && (
                <>
                  <div className="text-center py-4">
                    <p className="text-sm text-obsidian/60 mb-4">
                      Verify your business phone number to use it as caller ID for outbound AI calls.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-obsidian mb-2">
                      Business Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+15551234567"
                      className="w-full px-4 py-2 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none font-mono"
                    />
                    <p className="text-xs text-obsidian/60 mt-1">E.164 format (e.g., +15551234567)</p>
                  </div>
                  {verificationError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {verificationError}
                    </div>
                  )}
                  <button
                    onClick={handleSendVerification}
                    disabled={!phoneNumber || verifying}
                    className="w-full px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Calling...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        Send Verification Call
                      </>
                    )}
                  </button>
                </>
              )}

              {verificationStep === 'verify' && (
                <>
                  <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                    <p className="text-sm text-obsidian font-medium mb-1">
                      We're calling {phoneNumber}
                    </p>
                    <p className="text-xs text-obsidian/60">
                      Answer the call and enter the 6-digit code you hear below.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-obsidian mb-2">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-3 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none font-mono text-2xl text-center tracking-widest"
                      maxLength={6}
                    />
                  </div>
                  {verificationError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {verificationError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={resetVerification}
                      className="flex-1 px-4 py-2 border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmVerification}
                      disabled={verificationCode.length !== 6 || verifying}
                      className="flex-1 px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Confirm Code'
                      )}
                    </button>
                  </div>
                </>
              )}

              {verificationStep === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-50 mx-auto flex items-center justify-center mb-4 border border-green-200">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-obsidian mb-2">
                    Verification Successful!
                  </h3>
                  <p className="text-sm text-obsidian/60 mb-4">
                    Your business number is now verified for outbound calls.
                  </p>
                  <button
                    onClick={() => {
                      resetVerification();
                      fetchPhoneSettings();
                    }}
                    className="px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Section - BYOC */}
      <div className="border border-surgical-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 bg-white hover:bg-surgical-50 transition-colors flex items-center justify-between"
        >
          <div className="text-left">
            <h3 className="text-sm font-semibold text-obsidian">
              Advanced: Bring Your Own Twilio Account
            </h3>
            <p className="text-xs text-obsidian/60 mt-0.5">
              For power users who want to use their own Twilio credentials
            </p>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-5 h-5 text-obsidian/60" />
          ) : (
            <ChevronDown className="w-5 h-5 text-obsidian/60" />
          )}
        </button>

        {showAdvanced && (
          <div className="px-6 py-4 bg-surgical-50 border-t border-surgical-200">
            <p className="text-sm text-obsidian/60 mb-4">
              If you already have a Twilio account and phone number, you can configure it manually:
            </p>
            <a
              href="/dashboard/inbound-config"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-surgical-200 text-surgical-600 rounded-lg hover:bg-surgical-50 transition-colors font-medium"
            >
              Configure BYOC Telephony
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Buy Number Modal */}
      {showBuyNumberModal && (
        <BuyNumberModal
          onClose={() => {
            setShowBuyNumberModal(false);
            fetchPhoneSettings();
          }}
          currentMode={status?.mode || 'none'}
        />
      )}

      {/* Delete Managed Number Confirmation */}
      {confirmDeleteManaged && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-obsidian mb-2">
              Delete AI Phone Number?
            </h3>
            <p className="text-sm text-obsidian/60 mb-4">
              This will release {status?.inbound.managedNumber} and disconnect all forwarding.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteManaged(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteManaged}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Verified Number Confirmation */}
      {confirmDeleteVerified && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-obsidian mb-2">
              Remove Verified Number?
            </h3>
            <p className="text-sm text-obsidian/60 mb-4">
              This will remove {status?.outbound.verifiedNumber} from outbound calls.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteVerified(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVerified}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {deleting ? 'Removing...' : 'Remove Verification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
