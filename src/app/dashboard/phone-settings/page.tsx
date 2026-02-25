'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  User
} from 'lucide-react';
import { BuyNumberModal } from '@/components/dashboard/BuyNumberModal';
import CarrierForwardingInstructions from './components/CarrierForwardingInstructions';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { PHONE_NUMBER_PRICING } from '@/lib/constants';

interface ForwardingConfig {
  forwardingType: 'total_ai' | 'safety_net';
  carrier: string;
  status: string;
  ringTimeSeconds: number;
  activationCode: string;
  deactivationCode: string;
}

interface PhoneSettingsStatus {
  inbound: {
    hasManagedNumber: boolean;
    managedNumber: string | null;
    managedNumberStatus: string | null;
    vapiPhoneId: string | null;
    countryCode: string | null;
    forwardingConfig: ForwardingConfig | null;
  };
  outbound: {
    hasVerifiedNumber: boolean;
    verifiedNumber: string | null;
    verifiedAt: string | null;
    verifiedId: string | null;
    vapiLinked: boolean;
    pendingVerification?: {
      phoneNumber: string;
      createdAt: string;
      id: string;
    } | null;
    // New: outbound managed number support
    hasManagedOutboundNumber?: boolean;
    managedOutboundNumber?: string | null;
    managedOutboundVapiPhoneId?: string | null;
  };
  mode: 'managed' | 'byoc' | 'none';
  numbers?: {
    inbound: Array<{ phoneNumber: string; status: string; vapiPhoneId: string | null; countryCode: string; routingDirection: string }>;
    outbound: Array<{ phoneNumber: string; status: string; vapiPhoneId: string | null; countryCode: string; routingDirection: string }>;
    all: Array<{ phoneNumber: string; status: string; vapiPhoneId: string | null; countryCode: string; routingDirection: string }>;
  };
}

type VerificationStep = 'input' | 'verify' | 'success';

function detectCountryCode(phone: string): string {
  if (phone.startsWith('+234')) return 'NG';
  if (phone.startsWith('+44')) return 'GB';
  if (phone.startsWith('+1')) return 'US';
  if (phone.startsWith('+90')) return 'TR';
  if (phone.startsWith('+91')) return 'IN';
  if (phone.startsWith('+61')) return 'AU';
  if (phone.startsWith('+49')) return 'DE';
  if (phone.startsWith('+33')) return 'FR';
  if (phone.startsWith('+81')) return 'JP';
  if (phone.startsWith('+86')) return 'CN';
  if (phone.startsWith('+55')) return 'BR';
  if (phone.startsWith('+27')) return 'ZA';
  if (phone.startsWith('+254')) return 'KE';
  if (phone.startsWith('+971')) return 'AE';
  return 'US';
}

function getCountryName(code: string): string {
  const countryNames: Record<string, string> = {
    'NG': 'Nigeria',
    'GB': 'United Kingdom',
    'US': 'United States',
    'TR': 'Turkey',
    'IN': 'India',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'JP': 'Japan',
    'CN': 'China',
    'BR': 'Brazil',
    'ZA': 'South Africa',
    'KE': 'Kenya',
    'AE': 'UAE'
  };
  return countryNames[code] || code;
}

export default function PhoneSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [status, setStatus] = useState<PhoneSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buy number modal
  const [showBuyNumberModal, setShowBuyNumberModal] = useState(false);
  const [buyModalDirection, setBuyModalDirection] = useState<'inbound' | 'outbound'>('inbound');

  // Verification flow
  const [verificationStep, setVerificationStep] = useState<VerificationStep>('input');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [isValidPhoneFormat, setIsValidPhoneFormat] = useState(false);

  // Auto-recovery: prevent double-attempts on re-render
  const autoRecoveryAttempted = useRef(false);
  const [recovering, setRecovering] = useState(false);

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Delete confirmations
  const [confirmDeleteManaged, setConfirmDeleteManaged] = useState(false);
  const [confirmDeleteManagedOutbound, setConfirmDeleteManagedOutbound] = useState(false);
  const [confirmDeleteVerified, setConfirmDeleteVerified] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Agent linking
  const [agents, setAgents] = useState<{
    inbound: { id: string; name: string; vapiAssistantId: string | null } | null;
    outbound: { id: string; name: string; vapiAssistantId: string | null; vapiPhoneNumberId: string | null } | null;
  }>({ inbound: null, outbound: null });
  const [assigningAgent, setAssigningAgent] = useState<'inbound' | 'outbound' | null>(null);

  // Fetch phone settings status
  useEffect(() => {
    fetchPhoneSettings();
    fetchAgents();
  }, []);

  // Real-time country detection (Stripe pattern)
  useEffect(() => {
    if (phoneNumber.startsWith('+') && phoneNumber.length >= 4) {
      const countryCode = detectCountryCode(phoneNumber);
      setDetectedCountry(countryCode);
      // Basic validation: must start with + and have at least 10 digits
      const isValid = /^\+\d{10,15}$/.test(phoneNumber);
      setIsValidPhoneFormat(isValid);
    } else {
      setDetectedCountry(null);
      setIsValidPhoneFormat(false);
    }
  }, [phoneNumber]);

  const fetchPhoneSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authedBackendFetch<PhoneSettingsStatus>('/api/phone-settings/status');
      setStatus(data);

      // Auto-recovery: if there's a pending verification and no verified number,
      // restore the verify step so the user can complete setup.
      // This handles the "navigated away before clicking confirm" scenario.
      if (
        data.outbound.pendingVerification &&
        !data.outbound.hasVerifiedNumber &&
        !autoRecoveryAttempted.current
      ) {
        autoRecoveryAttempted.current = true;
        const pendingPhone = data.outbound.pendingVerification.phoneNumber;
        setPhoneNumber(pendingPhone);
        setRecovering(true);

        // Try auto-confirming (user may have already entered code on phone)
        try {
          await authedBackendFetch('/api/verified-caller-id/confirm', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber: pendingPhone })
          });
          // Auto-confirmed! Twilio had it verified.
          setVerificationStep('success');
          showSuccessToast('Your number was verified! Setup completed automatically.', 3000);
          // Re-fetch to get the verified state
          const refreshed = await authedBackendFetch<PhoneSettingsStatus>('/api/phone-settings/status');
          setStatus(refreshed);
        } catch {
          // Not yet verified in Twilio — show the verify step so user can complete
          setVerificationStep('verify');
        } finally {
          setRecovering(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch phone settings:', err);
      setError(err.message || 'Failed to load phone settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const data = await authedBackendFetch<{ agents: Array<{ id: string; name: string; role: string; vapiAssistantId: string | null; vapiPhoneNumberId?: string | null }> }>('/api/founder-console/agent/config');
      if (data?.agents) {
        const inbound = data.agents.find(a => a.role === 'inbound') || null;
        const outbound = data.agents.find(a => a.role === 'outbound') || null;
        setAgents({
          inbound: inbound ? { id: inbound.id, name: inbound.name, vapiAssistantId: inbound.vapiAssistantId } : null,
          outbound: outbound ? { id: outbound.id, name: outbound.name, vapiAssistantId: outbound.vapiAssistantId, vapiPhoneNumberId: outbound.vapiPhoneNumberId ?? null } : null,
        });
      }
    } catch {
      // Non-critical — agent info is best-effort
    }
  };

  const handleLinkAgent = async (direction: 'inbound' | 'outbound') => {
    const vapiPhoneId = direction === 'inbound'
      ? status?.inbound.vapiPhoneId
      : status?.outbound.managedOutboundVapiPhoneId;

    if (!vapiPhoneId) return;

    setAssigningAgent(direction);
    try {
      await authedBackendFetch('/api/integrations/vapi/assign-number', {
        method: 'POST',
        body: JSON.stringify({ phoneNumberId: vapiPhoneId, role: direction }),
      });
      showSuccessToast('Agent linked successfully');
      await Promise.all([fetchPhoneSettings(), fetchAgents()]);
    } catch {
      showErrorToast('Failed to link agent. Please try again.');
    } finally {
      setAssigningAgent(null);
    }
  };

  // Verification handlers (outbound lane)
  const handleSendVerification = async () => {
    setVerifying(true);
    setVerificationError(null);

    try {
      const response: any = await authedBackendFetch('/api/verified-caller-id/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          countryCode: detectCountryCode(phoneNumber)
        })
      });

      // Auto-verified path: number was already verified in Twilio
      if (response.verified) {
        showSuccessToast(`${phoneNumber} is already verified!`, 3000);
        setVerificationStep('success');
        await fetchPhoneSettings();
        return;
      }

      // CRITICAL: Capture the validation code from Twilio
      if (response.validationCode) {
        setVerificationCode(response.validationCode);
      }

      // Immediate success feedback (ChatGPT pattern)
      showSuccessToast(`Calling ${phoneNumber} now...`, 2000);
      setVerificationStep('verify');
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to send verification call. Check that your phone number is correct and try again.');
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
        body: JSON.stringify({ phoneNumber })
      });
      setVerificationStep('success');
      // Refresh status to show the new verified number
      await fetchPhoneSettings();
    } catch (err: any) {
      setVerificationError(err.message || 'Verification not yet complete. Wait 30 seconds after entering the code on your phone, then click "Verify & Complete Setup" again.');
    } finally {
      setVerifying(false);
    }
  };

  const resetVerification = async () => {
    // Clean up the pending DB record so it doesn't linger
    if (phoneNumber) {
      try {
        await authedBackendFetch('/api/verified-caller-id', {
          method: 'DELETE',
          body: JSON.stringify({ phoneNumber })
        });
      } catch {
        // Best-effort cleanup — don't block the UI reset
      }
    }
    setVerificationStep('input');
    setPhoneNumber('');
    setVerificationCode('');
    setVerificationError(null);
    autoRecoveryAttempted.current = false;
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

      // Success confirmation (Stripe pattern)
      showSuccessToast(`${status.inbound.managedNumber} successfully deleted`, 3000);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete number');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteManagedOutbound = async () => {
    if (!status?.outbound.managedOutboundNumber) return;

    try {
      setDeleting(true);
      await authedBackendFetch(
        `/api/managed-telephony/numbers/${encodeURIComponent(status.outbound.managedOutboundNumber)}`,
        { method: 'DELETE' }
      );
      setConfirmDeleteManagedOutbound(false);
      await fetchPhoneSettings();
      showSuccessToast(`${status.outbound.managedOutboundNumber} successfully deleted`, 3000);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete number');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteVerified = async () => {
    if (!status?.outbound.verifiedNumber) return;

    try {
      setDeleting(true);
      await authedBackendFetch('/api/verified-caller-id', {
        method: 'DELETE',
        body: JSON.stringify({ phoneNumber: status.outbound.verifiedNumber })
      });
      setConfirmDeleteVerified(false);
      await fetchPhoneSettings();

      // Success confirmation (Stripe pattern)
      showSuccessToast(`${status.outbound.verifiedNumber} successfully deleted`, 3000);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete verified number');
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || loading || recovering) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-surgical-600 mx-auto" />
          {recovering && (
            <p className="text-sm text-obsidian/60 mt-3">Checking pending verification...</p>
          )}
        </div>
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
            Configure how you <strong>receive</strong> calls (inbound) and how customers <strong>see</strong> your calls (outbound)
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
          {/* PROMINENT INBOUND HEADER */}
          <div className="mb-6 pb-4 border-b border-surgical-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-surgical-100 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-surgical-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-obsidian">
                  Inbound Calls
                </h2>
                <p className="text-sm text-obsidian/60 mt-1">
                  Forward calls TO your AI receptionist
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-semibold text-obsidian">
              Your AI Phone Number
            </h3>
          </div>

          {status?.inbound.hasManagedNumber ? (
            // Active managed number
            <div className="space-y-4">
              <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-2xl font-mono font-bold text-surgical-600">
                    {status.inbound.managedNumber}
                  </p>
                  <div className="flex items-center gap-2">
                    {status.inbound.forwardingConfig ? (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        status.inbound.forwardingConfig.forwardingType === 'total_ai'
                          ? 'bg-surgical-100 text-surgical-700 border border-surgical-200'
                          : 'bg-surgical-50 text-obsidian/70 border border-surgical-200'
                      }`}>
                        {status.inbound.forwardingConfig.forwardingType === 'total_ai' ? 'AI Handles All Calls' : 'AI + Human Backup'}
                      </span>
                    ) : null}
                    <span className="text-xs bg-surgical-100 text-surgical-600 px-2 py-1 rounded-full font-medium">
                      Active
                    </span>
                  </div>
                </div>
                <p className="text-xs text-obsidian/60">
                  {status.inbound.countryCode} • Hosted by CallWaiting AI
                </p>
              </div>

              {/* What happens next */}
              <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-3">
                <p className="text-xs font-medium text-obsidian mb-1">✓ Number active and ready</p>
                <p className="text-xs text-obsidian/60">Forward your office calls to this number using the carrier code below</p>
              </div>

              <CarrierForwardingInstructions
                managedNumber={status.inbound.managedNumber!}
                savedConfig={status.inbound.forwardingConfig}
              />

              {/* Agent Linking */}
              {agents.inbound && (
                <div className="bg-white border border-surgical-200 rounded-lg p-3">
                  <p className="text-xs text-obsidian/60 mb-2 font-medium">Linked Agent</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-surgical-600" />
                      <p className="text-sm font-medium text-obsidian">{agents.inbound.name}</p>
                    </div>
                    <button
                      onClick={() => handleLinkAgent('inbound')}
                      disabled={assigningAgent === 'inbound'}
                      className="text-xs px-3 py-1.5 border border-surgical-200 text-surgical-600 rounded-lg hover:bg-surgical-50 transition-colors font-medium disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {assigningAgent === 'inbound' ? (
                        <><Loader2 className="w-3 h-3 animate-spin" />Syncing...</>
                      ) : (
                        'Re-sync Agent'
                      )}
                    </button>
                  </div>
                </div>
              )}

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
                onClick={() => { setBuyModalDirection('inbound'); setShowBuyNumberModal(true); }}
                className="px-6 py-3 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium inline-flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Buy Inbound Number
              </button>
              <p className="text-xs text-obsidian/60 mt-3">
                {PHONE_NUMBER_PRICING.costDisplay} {PHONE_NUMBER_PRICING.costType} + usage-based pricing
              </p>
            </div>
          )}
        </div>

        {/* LANE 2: OUTBOUND - Verified Caller ID */}
        <div className="bg-white border border-surgical-200 rounded-xl p-6">
          {/* PROMINENT OUTBOUND HEADER */}
          <div className="mb-6 pb-4 border-b border-surgical-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-surgical-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-surgical-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-obsidian">
                  Outbound Calls
                </h2>
                <p className="text-sm text-obsidian/60 mt-1">
                  Set what customers see when AI calls them
                </p>
              </div>
            </div>
          </div>

          {/* Managed Outbound Number */}
          {status?.outbound.hasManagedOutboundNumber ? (
            <div className="mb-6 space-y-3">
              <h3 className="text-base font-semibold text-obsidian">Outbound Number</h3>
              <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-2xl font-mono font-bold text-surgical-600">
                    {status.outbound.managedOutboundNumber}
                  </p>
                  <span className="text-xs bg-surgical-100 text-surgical-600 px-2 py-1 rounded-full font-medium">
                    Active
                  </span>
                </div>
                <p className="text-xs text-obsidian/60">Hosted by CallWaiting AI</p>
              </div>

              {/* Agent Linking */}
              {agents.outbound && (
                <div className="bg-white border border-surgical-200 rounded-lg p-3">
                  <p className="text-xs text-obsidian/60 mb-2 font-medium">Linked Agent</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-surgical-600" />
                      <p className="text-sm font-medium text-obsidian">{agents.outbound.name}</p>
                      {agents.outbound.vapiPhoneNumberId === status.outbound.managedOutboundVapiPhoneId ? (
                        <span className="text-xs bg-surgical-100 text-surgical-600 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs bg-obsidian/10 text-obsidian/50 px-2 py-0.5 rounded-full">Not synced</span>
                      )}
                    </div>
                    {agents.outbound.vapiPhoneNumberId !== status.outbound.managedOutboundVapiPhoneId && (
                      <button
                        onClick={() => handleLinkAgent('outbound')}
                        disabled={assigningAgent === 'outbound'}
                        className="text-xs px-3 py-1.5 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {assigningAgent === 'outbound' ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Syncing...</>
                        ) : (
                          'Sync Agent'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setConfirmDeleteManagedOutbound(true)}
                className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Outbound Number
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <button
                onClick={() => { setBuyModalDirection('outbound'); setShowBuyNumberModal(true); }}
                className="w-full px-6 py-3 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Buy Outbound Number
              </button>
              <p className="text-xs text-obsidian/60 mt-2 text-center">
                Purchase a dedicated number for outbound AI calls
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-semibold text-obsidian">
              Verified Caller ID
            </h3>
          </div>

          {status?.outbound.hasVerifiedNumber && verificationStep !== 'success' ? (
            // Active verified number
            <div className="space-y-4">
              <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-surgical-600" />
                  <p className="text-2xl font-mono font-bold text-surgical-700">
                    {status.outbound.verifiedNumber}
                  </p>
                </div>
                <p className="text-xs text-obsidian/60">
                  Verified on {new Date(status.outbound.verifiedAt!).toLocaleDateString()}
                </p>
              </div>

              <div className={`border rounded-lg p-4 ${status.outbound.vapiLinked ? 'bg-surgical-50 border-surgical-200' : 'bg-surgical-50 border-surgical-200'}`}>
                {status.outbound.vapiLinked ? (
                  <p className="text-sm text-obsidian">
                    <strong>Ready for outbound calls.</strong> When your AI calls customers, they see <strong>{status.outbound.verifiedNumber}</strong>.
                  </p>
                ) : (
                  <p className="text-sm text-obsidian/70">
                    <strong>Linking to call system...</strong> This usually completes within a few seconds. Refresh the page if this persists.
                  </p>
                )}
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
                  {/* Value proposition */}
                  <div className="space-y-3">
                    <p className="text-sm text-obsidian">
                      When your AI calls customers, they'll see this number on their caller ID.
                    </p>

                    <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-obsidian">Why this matters:</p>
                      <ul className="text-xs text-obsidian/70 space-y-1">
                        <li>• Customers recognize YOUR number (not "Unknown")</li>
                        <li>• Higher answer rates (people trust known numbers)</li>
                        <li>• Professional appearance</li>
                      </ul>
                    </div>
                  </div>

                  {/* Input field - Progressive disclosure: show detailed steps only when needed (step 2) */}
                  <div className="border-t border-surgical-200 pt-4">
                    <label className="block text-sm font-medium text-obsidian mb-2">
                      Your Business Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1234567890"
                        className={`w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-surgical-500 outline-none font-mono transition-colors ${
                          isValidPhoneFormat
                            ? 'border-surgical-500 focus:border-surgical-500'
                            : 'border-surgical-200 focus:border-surgical-500'
                        }`}
                      />
                      {isValidPhoneFormat && detectedCountry && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <CheckCircle className="w-5 h-5 text-surgical-600" />
                        </div>
                      )}
                    </div>
                    {isValidPhoneFormat && detectedCountry ? (
                      <p className="text-xs text-surgical-600 mt-1 flex items-center gap-1">
                        ✓ Valid {getCountryName(detectedCountry)} number detected
                      </p>
                    ) : (
                      <p className="text-xs text-obsidian/60 mt-1">Must include country code: +1 (US), +234 (Nigeria), +44 (UK), +91 (India), etc.</p>
                    )}
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
                        Start Verification
                      </>
                    )}
                  </button>
                </>
              )}

              {verificationStep === 'verify' && (
                <>
                  {/* Status header — different message if recovered from navigation */}
                  <div className="border border-surgical-200 rounded-lg p-3 bg-surgical-50">
                    {verificationCode ? (
                      <>
                        <p className="text-sm font-medium text-obsidian mb-1">
                          Verification call sent!
                        </p>
                        <p className="text-xs text-obsidian/60">
                          Calling: {phoneNumber}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-obsidian mb-1">
                          Verification in progress for {phoneNumber}
                        </p>
                        <p className="text-xs text-obsidian/60">
                          If you already entered the code on your phone, click "Verify & Complete Setup" below.
                          Otherwise, click "Resend" to get a new verification call.
                        </p>
                      </>
                    )}
                  </div>

                  {/* VALIDATION CODE DISPLAY - CRITICAL */}
                  {verificationCode && (
                    <div className="bg-surgical-50 border-2 border-surgical-500 rounded-lg p-6 text-center">
                      <p className="text-sm font-medium text-obsidian mb-3">
                        🔑 Your Verification Code
                      </p>
                      <div className="bg-white border-2 border-surgical-400 rounded-lg p-4 mb-3">
                        <p className="text-4xl font-bold text-surgical-600 tracking-widest font-mono">
                          {verificationCode}
                        </p>
                      </div>
                      <p className="text-xs text-obsidian/60">
                        Enter this code on your phone keypad when Twilio calls
                      </p>
                    </div>
                  )}

                  {/* Phone will ring notice */}
                  <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                    <p className="text-sm text-obsidian font-medium mb-2">
                      📞 Your phone will ring in ~30 seconds
                    </p>

                    <div className="space-y-3 mt-3">
                      <p className="text-xs font-medium text-obsidian">What to do next:</p>

                      <div className="space-y-2 text-xs text-obsidian/70">
                        <div className="flex gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surgical-100 text-surgical-700 flex items-center justify-center text-xs font-bold">1</span>
                          <p className="pt-0.5">Answer the call from Twilio (+14157234000)</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surgical-100 text-surgical-700 flex items-center justify-center text-xs font-bold">2</span>
                          <p className="pt-0.5">Automated voice will ask: "Please enter your verification code"</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surgical-100 text-surgical-700 flex items-center justify-center text-xs font-bold">3</span>
                          <p className="pt-0.5">Enter the code shown above using your phone's keypad<br/><span className="text-obsidian/50">(Enter it on your PHONE, not on this screen)</span></p>
                        </div>
                        <div className="flex gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surgical-100 text-surgical-700 flex items-center justify-center text-xs font-bold">4</span>
                          <p className="pt-0.5">Once you've entered it, click "Verify & Complete Setup" below</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Troubleshooting */}
                  <div className="text-center">
                    <p className="text-xs text-obsidian/60">
                      ⏱️ Call not received after 2 minutes?
                    </p>
                    <button
                      onClick={handleSendVerification}
                      className="text-xs text-surgical-600 hover:text-surgical-700 font-medium mt-1"
                    >
                      Resend Verification Call
                    </button>
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
                      disabled={verifying}
                      className="flex-1 px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Verify & Complete Setup
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {verificationStep === 'success' && (
                <div className="space-y-4">
                  {/* Success header */}
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-surgical-50 mx-auto flex items-center justify-center mb-3 border border-surgical-200">
                      <CheckCircle className="w-8 h-8 text-surgical-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-obsidian mb-2">
                      🎉 Verification Complete!
                    </h3>
                    <p className="text-sm text-obsidian font-medium">
                      Your caller ID is now set to: {phoneNumber}
                    </p>
                  </div>

                  {/* What this means */}
                  <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-medium text-obsidian">What this means:</p>

                    <div className="space-y-2 text-xs text-obsidian/70">
                      <div className="flex gap-2">
                        <span className="text-surgical-600">✓</span>
                        <p>When your AI calls customers, they see YOUR business number</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-surgical-600">✓</span>
                        <p>No more "Unknown Number" or random phone numbers</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-surgical-600">✓</span>
                        <p>Higher answer rates = more conversations</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      resetVerification();
                      fetchPhoneSettings();
                    }}
                    className="w-full px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium"
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
              Advanced: Connect Your Own Phone Provider
            </h3>
            <p className="text-xs text-obsidian/60 mt-0.5">
              Already have a Twilio account? Connect it directly
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
              Configure Your Own Provider
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
          defaultDirection={buyModalDirection}
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

      {/* Delete Outbound Managed Number Confirmation */}
      {confirmDeleteManagedOutbound && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-obsidian mb-2">
              Delete Outbound Number?
            </h3>
            <p className="text-sm text-obsidian/60 mb-4">
              This will release {status?.outbound.managedOutboundNumber} and disconnect it from outbound calls. Your agent will need a new number configured before making calls.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteManagedOutbound(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteManagedOutbound}
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
              This will remove {status?.outbound.verifiedNumber} from Twilio, disconnect it from outbound calls, and allow you to verify a different number.
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
