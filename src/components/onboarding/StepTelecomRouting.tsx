'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneForwarded, ShieldCheck, Check, Loader2, ArrowRight } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import CarrierForwardingInstructions from '@/app/dashboard/phone-settings/components/CarrierForwardingInstructions';

/**
 * Step 2: Telecom Routing
 * - INBOUND → CarrierForwardingInstructions (GSM codes to forward calls to the managed number)
 * - OUTBOUND → Caller ID verification (enter personal number, verify with code)
 */
export default function StepTelecomRouting() {
  const { callDirection, phoneNumber, nextStep } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();

  useEffect(() => {
    track('telecom_routing_viewed', 2, { callDirection });
  }, [track, callDirection]);

  const handleSkip = () => {
    track('telecom_routing_skipped', 2);
    nextStep();
  };

  const handleContinue = () => {
    nextStep();
  };

  if (callDirection === 'outbound') {
    return <OutboundCallerIdSection onContinue={handleContinue} onSkip={handleSkip} />;
  }

  // Default: inbound forwarding instructions
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
          Route calls to your AI
        </h1>
        <p className="text-sm text-obsidian/60">
          Forward your office phone to your new AI number so it answers when you can&apos;t.
        </p>
      </div>

      {phoneNumber ? (
        <CarrierForwardingInstructions managedNumber={phoneNumber} />
      ) : (
        <p className="text-sm text-obsidian/50 text-center">
          No phone number available. Go back and complete payment.
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSkip}
          className="flex-1 px-4 py-3 rounded-xl border border-surgical-200 text-obsidian/70 font-medium text-sm hover:bg-surgical-50 transition-all duration-200"
        >
          Skip for now
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ---- Outbound Caller ID verification sub-component ----

function OutboundCallerIdSection({
  onContinue,
  onSkip,
}: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { track } = useOnboardingTelemetry();

  const [callerPhone, setCallerPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);

  const handleSendCode = async () => {
    if (!callerPhone || callerPhone.length < 10) {
      setError('Enter a valid phone number.');
      return;
    }
    setSendingCode(true);
    setError(null);

    try {
      const result = await authedBackendFetch<{
        success: boolean;
        validationCode?: string;
        error?: string;
      }>('/api/verified-caller-id/verify', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: callerPhone }),
      });

      if (result.success && result.validationCode) {
        setVerificationCode(result.validationCode);
      } else {
        setError(result.error || 'Failed to send verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start verification.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmCode = async () => {
    setVerifying(true);
    setError(null);

    try {
      const result = await authedBackendFetch<{
        success: boolean;
        error?: string;
      }>('/api/verified-caller-id/confirm', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: callerPhone, code: userCode }),
      });

      if (result.success) {
        setVerified(true);
        track('caller_id_verified', 2);
      } else {
        setError(result.error || 'Verification failed. Check the code and try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
          Verify your Caller ID
        </h1>
        <p className="text-sm text-obsidian/60">
          Verify the phone number that appears when your AI makes outbound calls.
        </p>
      </div>

      {verified ? (
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-surgical-50 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-surgical-600" />
          </div>
          <p className="font-medium text-obsidian">
            Caller ID verified: <span className="font-mono">{callerPhone}</span>
          </p>
          <button
            onClick={onContinue}
            className="px-8 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          {/* Phone input */}
          <div>
            <label className="block text-sm font-medium text-obsidian/70 mb-1.5">
              Your outbound phone number
            </label>
            <input
              type="tel"
              value={callerPhone}
              onChange={(e) => setCallerPhone(e.target.value.replace(/[^\d+\-() ]/g, ''))}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-3 border border-surgical-200 rounded-xl text-obsidian placeholder:text-obsidian/30 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent"
            />
          </div>

          {!verificationCode ? (
            <button
              onClick={handleSendCode}
              disabled={sendingCode || callerPhone.length < 10}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingCode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PhoneForwarded className="w-4 h-4" />
              )}
              {sendingCode ? 'Calling...' : 'Call to verify'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-4 text-center">
                <p className="text-sm text-obsidian/60 mb-1">
                  Twilio is calling your phone. Enter this code when prompted:
                </p>
                <p className="text-3xl font-mono font-bold text-surgical-600 tracking-widest">
                  {verificationCode}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-obsidian/70 mb-1.5">
                  Or enter the code you heard
                </label>
                <input
                  type="text"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter code"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-surgical-200 rounded-xl text-obsidian text-center font-mono text-lg tracking-widest placeholder:text-obsidian/30 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleConfirmCode}
                disabled={verifying || userCode.length < 4}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {verifying ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-obsidian/70 bg-surgical-50 border border-surgical-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            onClick={onSkip}
            className="w-full px-4 py-2 text-sm text-obsidian/50 hover:text-obsidian/70 transition-colors"
          >
            Skip for now — you can verify later from Phone Settings
          </button>
        </>
      )}
    </motion.div>
  );
}
