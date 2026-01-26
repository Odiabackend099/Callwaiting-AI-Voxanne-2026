'use client';

import React, { useState, useEffect } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import {
  Phone,
  CheckCircle,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  AlertCircle,
  Check,
  RefreshCw
} from 'lucide-react';
import type {
  GetVerifiedNumbersResponse,
  VerifyCallerIdInitiateResponse,
  VerifyCallerIdConfirmResponse,
  CreateForwardingConfigResponse,
  ConfirmSetupResponse,
  ErrorResponse
} from '../types';

type WizardStep = 'phone_input' | 'verification' | 'carrier_selection' | 'forwarding_code' | 'confirmation';

interface VerifiedNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  status: string;
  verified_at: string;
  hasForwardingConfig: boolean;
  forwardingStatus: string | null;
}

interface ForwardingConfig {
  id: string;
  forwardingType: string;
  carrier: string;
  twilioForwardingNumber: string;
  ringTimeSeconds: number;
  activationCode: string;
  deactivationCode: string;
  status: string;
}

const CARRIERS = [
  { value: 'att', label: 'AT&T', type: 'GSM' },
  { value: 'tmobile', label: 'T-Mobile', type: 'GSM' },
  { value: 'verizon', label: 'Verizon', type: 'CDMA' },
  { value: 'other_gsm', label: 'Other (GSM)', type: 'GSM' },
];

const FORWARDING_TYPES = [
  {
    value: 'total_ai',
    label: 'Total AI Control',
    description: 'AI answers ALL calls immediately. Your phone won\'t ring.',
    icon: '🤖'
  },
  {
    value: 'safety_net',
    label: 'Safety Net (Recommended)',
    description: 'Your phone rings first. AI answers only if you don\'t pick up.',
    icon: '🛡️'
  },
];

export default function TelephonySetupWizard() {
  const [step, setStep] = useState<WizardStep>('phone_input');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Phone Input
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendlyName, setFriendlyName] = useState('');

  // Step 2: Verification
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verifiedNumbers, setVerifiedNumbers] = useState<VerifiedNumber[]>([]);
  const [selectedVerifiedId, setSelectedVerifiedId] = useState<string | null>(null);

  // Step 3: Carrier Selection
  const [carrier, setCarrier] = useState('tmobile');
  const [forwardingType, setForwardingType] = useState('safety_net');
  const [ringTimeSeconds, setRingTimeSeconds] = useState(25);

  // Step 4: Forwarding Code
  const [forwardingConfig, setForwardingConfig] = useState<ForwardingConfig | null>(null);
  const [copied, setCopied] = useState(false);

  // Load existing verified numbers on mount
  useEffect(() => {
    loadVerifiedNumbers();
  }, []);

  const loadVerifiedNumbers = async () => {
    try {
      const data = await authedBackendFetch<GetVerifiedNumbersResponse>('/api/telephony/verified-numbers');
      if (data?.numbers) {
        setVerifiedNumbers(data.numbers);
      }
    } catch (err) {
      // Silent fail - user can still initiate new verification
    }
  };

  // ============================================
  // STEP 1: PHONE INPUT
  // ============================================
  const handleInitiateVerification = async () => {
    setError(null);

    // Validation
    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone.startsWith('+')) {
      setError('Phone number must start with + (E.164 format)');
      return;
    }
    if (!/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
      setError('Invalid phone number format. Use E.164 format (e.g., +15551234567)');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authedBackendFetch<VerifyCallerIdInitiateResponse>('/api/telephony/verify-caller-id/initiate', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          friendlyName: friendlyName || undefined
        }),
        timeoutMs: 30000,
      });

      if (data?.success) {
        setVerificationId(data.verificationId);
        setStep('verification');
      } else {
        setError('Failed to initiate verification');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate verification';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // STEP 2: VERIFICATION
  // ============================================
  const handleConfirmVerification = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await authedBackendFetch<VerifyCallerIdConfirmResponse>('/api/telephony/verify-caller-id/confirm', {
        method: 'POST',
        body: JSON.stringify({
          verificationId,
          phoneNumber: phoneNumber.trim()
        }),
        timeoutMs: 30000,
      });

      if (data?.success) {
        setSelectedVerifiedId(data.verifiedNumber.id);
        await loadVerifiedNumbers();
        setStep('carrier_selection');
      } else {
        setError('Verification not yet complete');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification not yet complete. Make sure you entered the code on the phone call.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseExistingNumber = (numberId: string) => {
    setSelectedVerifiedId(numberId);
    setStep('carrier_selection');
  };

  // ============================================
  // STEP 3: CARRIER SELECTION
  // ============================================
  const handleCreateForwardingConfig = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await authedBackendFetch<CreateForwardingConfigResponse>('/api/telephony/forwarding-config', {
        method: 'POST',
        body: JSON.stringify({
          verifiedCallerId: selectedVerifiedId,
          forwardingType,
          carrier,
          ringTimeSeconds: forwardingType === 'safety_net' ? ringTimeSeconds : undefined
        }),
        timeoutMs: 30000,
      });

      if (data?.success && data?.config) {
        setForwardingConfig(data.config);
        setStep('forwarding_code');
      } else {
        setError('Failed to create forwarding configuration');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create forwarding configuration';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // STEP 4: FORWARDING CODE
  // ============================================
  const handleCopyCode = () => {
    if (forwardingConfig?.activationCode) {
      navigator.clipboard.writeText(forwardingConfig.activationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmSetup = async () => {
    if (!forwardingConfig?.id) return;

    setError(null);
    setIsLoading(true);

    try {
      const data = await authedBackendFetch<ConfirmSetupResponse>('/api/telephony/forwarding-config/confirm', {
        method: 'POST',
        body: JSON.stringify({
          configId: forwardingConfig.id
        }),
        timeoutMs: 30000,
      });

      if (data?.success) {
        setStep('confirmation');
      } else {
        setError('Failed to confirm setup');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm setup';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // STEP RENDERING
  // ============================================
  const renderStepIndicator = () => {
    const steps = [
      { id: 'phone_input', label: 'Phone' },
      { id: 'verification', label: 'Verify' },
      { id: 'carrier_selection', label: 'Configure' },
      { id: 'forwarding_code', label: 'Activate' },
      { id: 'confirmation', label: 'Done' },
    ];
    const currentIndex = steps.findIndex(s => s.id === step);

    return (
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, index) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  currentIndex > index
                    ? 'bg-emerald-600 text-white'
                    : currentIndex === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                }`}
              >
                {currentIndex > index ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className="text-xs mt-1 text-gray-600 dark:text-slate-400 hidden sm:block">
                {s.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  currentIndex > index
                    ? 'bg-emerald-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderPhoneInputStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Enter Your Phone Number
        </h2>
        <p className="text-gray-600 dark:text-slate-400 text-sm">
          We'll call this number to verify you own it.
        </p>
      </div>

      {/* Warning about existing call forwarding */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-1">
              Disable Existing Call Forwarding First
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              If you currently have call forwarding active on this number, please disable it before proceeding.
              Dial <span className="font-mono font-semibold">##21#</span> (all carriers) or <span className="font-mono font-semibold">*73</span> (Verizon)
              to deactivate any existing forwarding rules.
            </p>
          </div>
        </div>
      </div>

      {verifiedNumbers.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
            Or use a previously verified number:
          </p>
          <div className="space-y-2">
            {verifiedNumbers.filter(n => n.status === 'verified').map(number => (
              <button
                key={number.id}
                onClick={() => handleUseExistingNumber(number.id)}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {number.phone_number}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15551234567"
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
          />
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
            E.164 format with country code (e.g., +1 for US)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Label (Optional)
          </label>
          <input
            type="text"
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            placeholder="My Mobile"
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleInitiateVerification}
        disabled={isLoading || !phoneNumber.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Calling...</>
        ) : (
          <><Phone className="w-4 h-4" /> Verify This Number</>
        )}
      </button>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
        <Phone className="w-8 h-8 text-yellow-600 dark:text-yellow-400 animate-pulse" />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Verification Call in Progress
        </h2>
        <p className="text-gray-600 dark:text-slate-400 text-sm max-w-md mx-auto">
          You'll receive a call momentarily. Answer it and listen carefully for the 6-digit verification code.
          Enter that code when prompted by the automated voice.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">
          📞 Waiting for you to complete the phone verification
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Listen for the code on the call and enter it when prompted. Then click "I Entered the Code" below.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setStep('phone_input')}
          className="flex-1 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleConfirmVerification}
          disabled={isLoading}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> I Entered the Code</>
          )}
        </button>
      </div>
    </div>
  );

  const renderCarrierSelectionStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Configure Call Forwarding
        </h2>
        <p className="text-gray-600 dark:text-slate-400 text-sm">
          Choose your carrier and how you want AI to handle calls.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Mobile Carrier
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CARRIERS.map(c => (
              <button
                key={c.value}
                onClick={() => setCarrier(c.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  carrier === c.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-xs ml-2 opacity-60">({c.type})</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Forwarding Mode
          </label>
          <div className="space-y-2">
            {FORWARDING_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => setForwardingType(type.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  forwardingType === type.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{type.icon}</span>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                      {type.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {forwardingType === 'safety_net' && carrier !== 'verizon' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Ring Time: {ringTimeSeconds} seconds
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={ringTimeSeconds}
              onChange={(e) => setRingTimeSeconds(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              How long your phone rings before forwarding to AI
            </p>
          </div>
        )}

        {forwardingType === 'safety_net' && carrier === 'verizon' && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
            <strong>Note:</strong> Verizon doesn't support custom ring times via dial codes. Default is ~30 seconds.
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setStep('phone_input')}
          className="flex-1 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" /> Back
        </button>
        <button
          onClick={handleCreateForwardingConfig}
          disabled={isLoading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <>Generate Code <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );

  const renderForwardingCodeStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
          <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Activate Call Forwarding
        </h2>
        <p className="text-gray-600 dark:text-slate-400 text-sm">
          Dial this code on your phone to start forwarding calls to AI
        </p>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6">
        <p className="text-xs text-gray-500 dark:text-slate-500 uppercase font-bold tracking-wider mb-2">
          Activation Code
        </p>
        <div className="flex items-center justify-between gap-4">
          <code className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 break-all">
            {forwardingConfig?.activationCode}
          </code>
          <button
            onClick={handleCopyCode}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <Copy className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-500 text-center mt-3 italic">
          Note: Must dial manually - tap-to-dial doesn't support GSM codes with * and # characters
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 text-sm text-gray-600 dark:text-slate-400">
        <p className="font-medium mb-2">Instructions:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open your phone's dialer app</li>
          <li>Enter the code exactly as shown above</li>
          <li>Press the call button</li>
          <li>Wait for confirmation tone/message</li>
        </ol>
      </div>

      {forwardingConfig?.deactivationCode && (
        <div className="text-center text-sm text-gray-500 dark:text-slate-500">
          To deactivate later, dial: <code className="font-mono">{forwardingConfig.deactivationCode}</code>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setStep('carrier_selection')}
          className="flex-1 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" /> Back
        </button>
        <button
          onClick={handleConfirmSetup}
          disabled={isLoading}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> I've Dialed the Code</>
          )}
        </button>
      </div>
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Setup Complete!
        </h2>
        <p className="text-gray-600 dark:text-slate-400">
          Your phone is now connected to AI.
          {forwardingType === 'safety_net'
            ? ' Missed calls will be handled by your AI assistant.'
            : ' All calls will be handled by your AI assistant.'}
        </p>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
        <p className="text-sm text-emerald-800 dark:text-emerald-300">
          <strong>Tip:</strong> Try calling your number from another phone to test the setup!
        </p>
      </div>

      <button
        onClick(() => {
          setStep('phone_input');
          setPhoneNumber('');
          setVerificationId(null);
          setForwardingConfig(null);
          setSelectedVerifiedId(null);
        }}
        className="px-6 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" /> Set Up Another Number
      </button>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      {renderStepIndicator()}

      {step === 'phone_input' && renderPhoneInputStep()}
      {step === 'verification' && renderVerificationStep()}
      {step === 'carrier_selection' && renderCarrierSelectionStep()}
      {step === 'forwarding_code' && renderForwardingCodeStep()}
      {step === 'confirmation' && renderConfirmationStep()}
    </div>
  );
}
