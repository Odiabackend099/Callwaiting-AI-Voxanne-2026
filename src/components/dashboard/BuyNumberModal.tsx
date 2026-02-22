'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Loader2, AlertCircle, Check, Search } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface BuyNumberModalProps {
  onClose: () => void;
  onSuccess?: (phoneNumber: string) => void;
  currentMode?: string;
  defaultDirection?: 'inbound' | 'outbound';
}

type Step = 'search' | 'confirm' | 'success';

interface AvailableNumber {
  phoneNumber: string;
  locality?: string;
  region?: string;
}

// Country configuration with area code formats and regulatory readiness
// ONLY 3 COUNTRIES SUPPORTED - Backend validates these in managed-telephony.ts line 65
// Regulatory Bundle required for GB/CA (Phase 3 - not yet implemented)
const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    areaCodeFormat: '3 digits (e.g., 415, 212)',
    areaCodeLength: 3,
    regulatoryReady: true, // Can purchase immediately
    approvalDays: null,
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    areaCodeFormat: '3-5 digits (e.g., 020, 0161)',
    areaCodeLength: 5,
    regulatoryReady: true, // Twilio handles Ofcom compliance
    approvalDays: null,
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    areaCodeFormat: '3 digits (e.g., 416, 514)',
    areaCodeLength: 3,
    regulatoryReady: false, // Requires CRTC approval
    approvalDays: '7-14 days',
    complianceInfo: 'Requires Canadian Business Registry number and CRTC approval',
  },
  // Removed AU (Australia) - not in backend carrier_forwarding_rules table
] as const;

export function BuyNumberModal({ onClose, onSuccess, currentMode, defaultDirection = 'inbound' }: BuyNumberModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [country, setCountry] = useState('US');
  const [numberType, setNumberType] = useState<'local' | 'toll_free'>('local');
  const [areaCode, setAreaCode] = useState('');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>(defaultDirection);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    canRetry?: boolean;
    failedStep?: string;
  } | null>(null);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // One-number-per-org enforcement
  const [hasExistingNumber, setHasExistingNumber] = useState(false);
  const [existingNumberInfo, setExistingNumberInfo] = useState<{
    type: 'managed' | 'byoc';
    phoneNumber: string;
    details: string;
  } | null>(null);

  const searchNumbers = async () => {
    // Enforce one-number-per-org: Block search if existing number detected
    if (hasExistingNumber) {
      const errorMsg = 'Cannot search - you already have an active phone number. Delete it first.';
      setError(errorMsg);
      setErrorDetails({
        message: errorMsg,
        canRetry: false,
        failedStep: 'validation'
      });
      return;
    }

    setLoading(true);
    setError(null);
    setErrorDetails(null);
    try {
      const params = new URLSearchParams({ country, numberType });
      if (areaCode) params.set('areaCode', areaCode);

      const data = await authedBackendFetch<{ numbers: AvailableNumber[] }>(
        `/api/managed-telephony/available-numbers?${params.toString()}`
      );
      setAvailableNumbers(data.numbers || []);
      if (!data.numbers?.length) {
        const errorMsg = 'No numbers found. Try a different area code or number type.';
        setError(errorMsg);
        setErrorDetails({
          message: errorMsg,
          canRetry: true,
          failedStep: 'search'
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to search numbers';
      setError(errorMsg);
      setErrorDetails({
        message: errorMsg,
        canRetry: true,
        failedStep: 'search'
      });
    } finally {
      setLoading(false);
    }
  };

  const provisionNumber = async () => {
    if (!selectedNumber) return;
    setProvisioning(true);
    setError(null);
    setErrorDetails(null);
    try {
      const data = await authedBackendFetch<{
        success: boolean;
        phoneNumber: string;
        warning?: string;
        error?: string;
        userMessage?: string;
        canRetry?: boolean;
        failedStep?: string;
        existingNumber?: {
          type: 'managed' | 'byoc';
          phoneNumber: string;
          details: string;
        };
      }>('/api/managed-telephony/provision', {
        method: 'POST',
        body: JSON.stringify({ country, numberType, areaCode, direction }),
      });

      if (!data.success) {
        // Handle existing number conflict (409 status)
        if (data.existingNumber) {
          const errorMsg = `Cannot provision: You already have a ${data.existingNumber.type} phone number (${data.existingNumber.phoneNumber}). Delete it first.`;
          setError(errorMsg);
          setErrorDetails({
            message: errorMsg,
            canRetry: false,
            failedStep: 'validation'
          });
          setHasExistingNumber(true);
          setExistingNumberInfo(data.existingNumber);
        } else {
          const errorMsg = data.userMessage || data.error || 'Provisioning failed';
          setError(errorMsg);
          setErrorDetails({
            message: errorMsg,
            canRetry: data.canRetry ?? true,
            failedStep: data.failedStep
          });
        }
        return;
      }

      setProvisionedNumber(data.phoneNumber);
      if (data.warning) setWarning(data.warning);
      setStep('success');
      onSuccess?.(data.phoneNumber);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to provision number';
      setError(errorMsg);
      setErrorDetails({
        message: errorMsg,
        canRetry: true,
        failedStep: 'unknown'
      });
    } finally {
      setProvisioning(false);
    }
  };

  // Pre-flight check: Check per-direction limits AND sufficient balance
  const checkExistingNumber = async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorDetails(null);

      // Use phone-settings status which returns direction-grouped data
      const statusData = await authedBackendFetch<any>('/api/phone-settings/status');

      // Check per-direction: inbound checks inbound lane, outbound checks outbound lane
      let blocked = false;
      if (direction === 'inbound' && statusData?.inbound?.hasManagedNumber) {
        blocked = true;
        setHasExistingNumber(true);
        setExistingNumberInfo({
          type: 'managed',
          phoneNumber: statusData.inbound.managedNumber,
          details: 'Active managed inbound number',
        });
        const errorMsg = `You already have an inbound number (${statusData.inbound.managedNumber}). Please release it before provisioning a new one.`;
        setError(errorMsg);
        setErrorDetails({ message: errorMsg, canRetry: false, failedStep: 'validation' });
      } else if (direction === 'outbound' && statusData?.outbound?.hasManagedOutboundNumber) {
        blocked = true;
        setHasExistingNumber(true);
        setExistingNumberInfo({
          type: 'managed',
          phoneNumber: statusData.outbound.managedOutboundNumber,
          details: 'Active managed outbound number',
        });
        const errorMsg = `You already have an outbound number (${statusData.outbound.managedOutboundNumber}). Please release it before provisioning a new one.`;
        setError(errorMsg);
        setErrorDetails({ message: errorMsg, canRetry: false, failedStep: 'validation' });
      }

      if (!blocked) {
        // Also check BYOC for inbound direction
        if (direction === 'inbound') {
          const phoneData = await authedBackendFetch<any>('/api/managed-telephony/phone-status');
          if (phoneData?.hasPhoneNumber && phoneData?.phoneNumberType === 'byoc') {
            setHasExistingNumber(true);
            setExistingNumberInfo({
              type: 'byoc',
              phoneNumber: phoneData.phoneNumber!,
              details: phoneData.details!,
            });
            const errorMsg = `You already have a BYOC phone number (${phoneData.phoneNumber}). Please disconnect it first.`;
            setError(errorMsg);
            setErrorDetails({ message: errorMsg, canRetry: false, failedStep: 'validation' });
            blocked = true;
          }
        }
      }

      if (!blocked) {
        setHasExistingNumber(false);
        setExistingNumberInfo(null);
      }

      // Balance pre-check: £10.00 (1000 pence) required for phone number
      try {
        const wallet = await authedBackendFetch<any>('/api/billing/wallet');
        const balancePence = wallet?.balance_pence || 0;
        if (balancePence < 1000) {
          const balanceGBP = (balancePence / 100).toFixed(2);
          const shortfall = ((1000 - balancePence) / 100).toFixed(2);
          const balanceMsg = `Insufficient balance (£${balanceGBP}). £10.00 required to buy a number (£${shortfall} more needed). Please top up your wallet first.`;
          setError(balanceMsg);
          setErrorDetails({
            message: balanceMsg,
            canRetry: false,
            failedStep: 'validation'
          });
          setHasExistingNumber(true); // Reuse flag to block search button
        }
      } catch {
        // Non-blocking: if wallet check fails, backend will catch at purchase time
      }
    } catch (err: any) {
      console.error('Failed to check existing number:', err);
      // Non-blocking error - allow user to proceed
    } finally {
      setLoading(false);
    }
  };

  // Check for existing number on modal open and when direction changes
  useEffect(() => {
    checkExistingNumber();
  }, [direction]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-surgical-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surgical-50 flex items-center justify-center">
                <Phone className="w-5 h-5 text-surgical-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-obsidian">Buy a Phone Number</h2>
                <p className="text-sm text-obsidian/60">Get a managed number for your AI agent</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surgical-50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-obsidian/40" />
            </button>
          </div>

          {/* Mode conflict warning */}
          {currentMode === 'byoc' && step !== 'success' && (
            <div className="mx-6 mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                You have existing BYOC Twilio credentials. Buying a managed number will replace them.
              </p>
            </div>
          )}

          {/* Body */}
          <div className="p-6 space-y-4">
            {step === 'search' && (
              <>
                {/* Existing number warning banner - BLOCKING */}
                {hasExistingNumber && existingNumberInfo && (
                  <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-900 mb-1">
                          One Number Limit
                        </p>
                        <p className="text-sm text-yellow-800 mb-2">
                          You already have a {existingNumberInfo.type === 'managed' ? 'managed' : 'BYOC'} phone number:{' '}
                          <span className="font-mono font-medium">{existingNumberInfo.phoneNumber}</span>
                        </p>
                        <p className="text-sm text-yellow-700 mb-3">
                          {existingNumberInfo.type === 'managed'
                            ? 'Delete your existing managed number to purchase a new one.'
                            : 'Disconnect your BYOC credentials in Integrations to purchase a managed number.'}
                        </p>
                        <button
                          onClick={() => {
                            onClose();
                            window.location.href = existingNumberInfo.type === 'managed'
                              ? '/dashboard/phone-settings'
                              : '/dashboard/inbound-config#integrations';
                          }}
                          className="text-sm font-medium text-yellow-700 hover:text-yellow-800 underline"
                        >
                          {existingNumberInfo.type === 'managed'
                            ? 'View & Manage Your Number →'
                            : 'Manage Integrations →'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Direction selector */}
                <div>
                  <label className="block text-sm font-medium text-obsidian/70 mb-2">Number Purpose</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'inbound' as const, label: 'Inbound', desc: 'Receive Calls (AI Receptionist)' },
                      { value: 'outbound' as const, label: 'Outbound', desc: 'Caller ID (Sales / Callbacks)' },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setDirection(opt.value);
                          setError(null);
                          setErrorDetails(null);
                          setHasExistingNumber(false);
                          setExistingNumberInfo(null);
                          // Re-check with new direction
                          setTimeout(() => checkExistingNumber(), 0);
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors text-left ${
                          direction === opt.value
                            ? opt.value === 'inbound'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-white text-obsidian/60 border-surgical-200 hover:border-surgical-300'
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-xs opacity-75">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Country selector */}
                <div>
                  <label className="block text-sm font-medium text-obsidian/70 mb-2">Country</label>
                  <select
                    value={country}
                    onChange={e => {
                      setCountry(e.target.value);
                      setAreaCode(''); // Reset area code when country changes
                    }}
                    className="w-full px-4 py-2.5 border border-surgical-200 rounded-lg text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent bg-white"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-obsidian/50 mt-2">
                    More countries coming soon. Need a different region?{' '}
                    <a href="mailto:support@voxanne.ai" className="text-surgical-600 hover:underline">
                      Contact us
                    </a>
                  </p>
                </div>

                {/* Compliance warning for non-US countries */}
                {(() => {
                  const selectedCountry = COUNTRIES.find(c => c.code === country);
                  return selectedCountry && !selectedCountry.regulatoryReady ? (
                    <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-yellow-900 mb-1">
                            ⚠️ Regulatory Approval Required
                          </p>
                          <p className="text-sm text-yellow-800 mb-2">
                            Managed numbers for {selectedCountry.name} require regulatory approval ({selectedCountry.approvalDays}).
                          </p>
                          <p className="text-xs text-yellow-700 mb-3">
                            {selectedCountry.complianceInfo}
                          </p>
                          <a
                            href="/dashboard/inbound-config"
                            className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 hover:text-yellow-800 underline"
                          >
                            Use BYOC for immediate setup →
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Number type selector */}
                <div>
                  <label className="block text-sm font-medium text-obsidian/70 mb-2">Number Type</label>
                  <div className="flex gap-2">
                    {(['local', 'toll_free'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setNumberType(type)}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          numberType === type
                            ? 'bg-surgical-600 text-white border-surgical-600'
                            : 'bg-white text-obsidian/70 border-surgical-200 hover:border-surgical-400'
                        }`}
                      >
                        {type === 'local' ? 'Local' : 'Toll-Free'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Area code input - country-aware */}
                {numberType === 'local' && (() => {
                  const selectedCountry = COUNTRIES.find(c => c.code === country);
                  const areaCodeRequired = selectedCountry && selectedCountry.areaCodeLength > 0;

                  return areaCodeRequired ? (
                    <div>
                      <label className="block text-sm font-medium text-obsidian/70 mb-2">
                        Area Code <span className="text-obsidian/40">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={areaCode}
                        onChange={e => setAreaCode(
                          e.target.value.replace(/\D/g, '').slice(0, selectedCountry.areaCodeLength)
                        )}
                        placeholder={selectedCountry.areaCodeFormat}
                        className="w-full px-4 py-2.5 border border-surgical-200 rounded-lg text-obsidian placeholder:text-obsidian/30 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent"
                      />
                      <p className="mt-1.5 text-xs text-obsidian/50">
                        Format: {selectedCountry.areaCodeFormat}
                      </p>
                    </div>
                  ) : null;
                })()}

                {/* Search button */}
                {(() => {
                  const selectedCountry = COUNTRIES.find(c => c.code === country);
                  const isRegulatoryReady = selectedCountry?.regulatoryReady ?? false;
                  const isDisabled = loading || hasExistingNumber || !isRegulatoryReady;

                  return (
                    <button
                      onClick={searchNumbers}
                      disabled={isDisabled}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                        isDisabled
                          ? 'bg-surgical-300 text-white opacity-50 cursor-not-allowed'
                          : 'bg-surgical-600 text-white hover:bg-surgical-700'
                      }`}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      {loading
                        ? 'Searching...'
                        : !isRegulatoryReady
                        ? 'Coming Soon (Requires Compliance)'
                        : 'Search Available Numbers'}
                    </button>
                  );
                })()}

                {/* Results */}
                {availableNumbers.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableNumbers.map(num => (
                      <button
                        key={num.phoneNumber}
                        onClick={() => {
                          setSelectedNumber(num.phoneNumber);
                          setStep('confirm');
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 border border-surgical-200 rounded-lg hover:border-surgical-400 hover:bg-surgical-50 transition-colors"
                      >
                        <span className="font-mono text-obsidian">{num.phoneNumber}</span>
                        {num.locality && (
                          <span className="text-sm text-obsidian/50">{num.locality}, {num.region}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 'confirm' && selectedNumber && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-sm text-obsidian/60 mb-2">You are about to purchase:</p>
                  <p className="text-2xl font-mono font-bold text-obsidian">{selectedNumber}</p>
                  <p className="text-sm text-obsidian/50 mt-2">£1.50/month + usage</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('search')}
                    className="flex-1 px-4 py-2.5 border border-surgical-200 text-obsidian/70 rounded-lg font-medium hover:bg-surgical-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={provisionNumber}
                    disabled={provisioning}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                      provisioning
                        ? 'bg-surgical-300 text-white opacity-50 cursor-not-allowed'
                        : 'bg-surgical-600 text-white hover:bg-surgical-700'
                    }`}
                  >
                    {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                    {provisioning ? 'Provisioning...' : 'Confirm Purchase'}
                  </button>
                </div>
              </div>
            )}

            {step === 'success' && provisionedNumber && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-obsidian">Number Provisioned</p>
                  <p className="text-2xl font-mono font-bold text-surgical-600 mt-2">{provisionedNumber}</p>
                </div>
                {warning && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                    {warning}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-surgical-600 text-white rounded-lg font-medium hover:bg-surgical-700 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 mb-1">Purchase Failed</p>
                    <p className="text-sm text-red-700">{error}</p>
                    {errorDetails?.canRetry && (
                      <button
                        onClick={() => {
                          setError(null);
                          setErrorDetails(null);
                        }}
                        className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
                      >
                        Try Again →
                      </button>
                    )}
                    {errorDetails?.canRetry === false && (
                      <p className="mt-2 text-sm text-red-600">
                        Please contact support if this issue persists.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
