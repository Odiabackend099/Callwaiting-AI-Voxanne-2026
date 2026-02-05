'use client';

import React, { useState, useEffect } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { StepIndicator } from './StepIndicator';
import { CountrySelectionStep } from './CountrySelectionStep';
import { PhoneNumberInputStep } from './PhoneNumberInputStep';
import { VerificationStep } from './VerificationStep';
import { CarrierSelectionStep } from './CarrierSelectionStep';
import { ForwardingCodeDisplayStep } from './ForwardingCodeDisplayStep';
import { ConfirmationStep } from './ConfirmationStep';
import type {
  GetVerifiedNumbersResponse,
  VerifyCallerIdInitiateResponse,
  VerifyCallerIdConfirmResponse,
  CreateForwardingConfigResponse,
  ConfirmSetupResponse,
  VerifiedNumber,
  ForwardingConfig
} from '../types';

type WizardStep = 'country_selection' | 'phone_input' | 'verification' | 'carrier_selection' | 'forwarding_code' | 'confirmation';

/**
 * Telephony Setup Wizard - Main Component
 *
 * Multi-step wizard for setting up hybrid telephony with BYOC.
 * Guides users through:
 * 1. Country selection (required first - affects phone format and carriers)
 * 2. Phone number entry and verification
 * 3. Verification via Twilio validation call
 * 4. Carrier and forwarding type selection
 * 5. GSM code generation and activation
 * 6. Confirmation
 */
export default function TelephonySetupWizard() {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const [step, setStep] = useState<WizardStep>('country_selection');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Country Selection
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLoadingCountry, setIsLoadingCountry] = useState(false);

  // Step 2: Phone Input
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [verifiedNumbers, setVerifiedNumbers] = useState<VerifiedNumber[]>([]);

  // Step 2: Verification
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>();

  // Step 3: Carrier Selection
  const [carrier, setCarrier] = useState('tmobile');
  const [forwardingType, setForwardingType] = useState('safety_net');
  const [ringTimeSeconds, setRingTimeSeconds] = useState(25);
  const [selectedVerifiedId, setSelectedVerifiedId] = useState<string | null>(null);

  // Step 4: Forwarding Code
  const [forwardingConfig, setForwardingConfig] = useState<ForwardingConfig | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

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
  // STEP HANDLERS
  // ============================================

  const handleInitiateVerification = async () => {
    setError(null);

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
      const data = await authedBackendFetch<VerifyCallerIdInitiateResponse>(
        '/api/telephony/verify-caller-id/initiate',
        {
          method: 'POST',
          body: JSON.stringify({
            phoneNumber: cleanPhone,
            friendlyName: friendlyName || undefined
          }),
          timeoutMs: 30000,
        }
      );

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

  const handleConfirmVerification = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await authedBackendFetch<VerifyCallerIdConfirmResponse>(
        '/api/telephony/verify-caller-id/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            verificationId,
            phoneNumber: phoneNumber.trim()
          }),
          timeoutMs: 30000,
        }
      );

      if (data?.success) {
        setSelectedVerifiedId(data.verifiedNumber.id);
        await loadVerifiedNumbers();
        setStep('carrier_selection');
      } else {
        setError('Verification not yet complete');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification not yet complete. Make sure you entered the code on the phone call.';

      // Extract attemptsRemaining if available
      if (err && typeof err === 'object' && 'attemptsRemaining' in err) {
        setAttemptsRemaining((err as { attemptsRemaining: number }).attemptsRemaining);
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryVerification = async () => {
    setError(null);
    setAttemptsRemaining(undefined);
    // Re-initiate verification call
    await handleInitiateVerification();
  };

  const handleUseExistingNumber = (numberId: string) => {
    setSelectedVerifiedId(numberId);
    setStep('carrier_selection');
  };

  const handleCreateForwardingConfig = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await authedBackendFetch<CreateForwardingConfigResponse>(
        '/api/telephony/forwarding-config',
        {
          method: 'POST',
          body: JSON.stringify({
            verifiedCallerId: selectedVerifiedId,
            forwardingType,
            carrier,
            ringTimeSeconds: forwardingType === 'safety_net' ? ringTimeSeconds : undefined
          }),
          timeoutMs: 30000,
        }
      );

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

  const handleConfirmSetup = async () => {
    if (!forwardingConfig?.id) return;

    setError(null);
    setIsLoading(true);

    try {
      const data = await authedBackendFetch<ConfirmSetupResponse>(
        '/api/telephony/forwarding-config/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            configId: forwardingConfig.id
          }),
          timeoutMs: 30000,
        }
      );

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
  // RENDER
  // ============================================

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <div className="bg-white rounded-xl border border-surgical-200 p-8">
        {step === 'country_selection' && (
          <CountrySelectionStep
            selectedCountry={selectedCountry}
            onCountrySelect={async (code) => {
              setSelectedCountry(code);
              setError(null);
              setIsLoadingCountry(true);

              try {
                // Persist country selection to backend
                await authedBackendFetch('/api/telephony/select-country', {
                  method: 'POST',
                  body: JSON.stringify({ countryCode: code }),
                });
              } catch (err: any) {
                setError(err.message || 'Failed to save country selection');
                setSelectedCountry(null);
              } finally {
                setIsLoadingCountry(false);
              }
            }}
            onNext={() => {
              // onNext will be called after country is confirmed
              setStep('phone_input');
            }}
            isLoading={isLoading}
            isLoadingCountry={isLoadingCountry}
            error={error}
          />
        )}

        {step === 'phone_input' && (
          <PhoneNumberInputStep
            phoneNumber={phoneNumber}
            friendlyName={friendlyName}
            verifiedNumbers={verifiedNumbers}
            isLoading={isLoading}
            error={error}
            onPhoneChange={setPhoneNumber}
            onNameChange={setFriendlyName}
            onSubmit={handleInitiateVerification}
            onUseExisting={handleUseExistingNumber}
          />
        )}

        {step === 'verification' && (
          <VerificationStep
            isLoading={isLoading}
            error={error}
            attemptsRemaining={attemptsRemaining}
            onConfirm={handleConfirmVerification}
            onRetry={handleRetryVerification}
          />
        )}

        {step === 'carrier_selection' && (
          <CarrierSelectionStep
            carrier={carrier}
            forwardingType={forwardingType}
            ringTimeSeconds={ringTimeSeconds}
            isLoading={isLoading}
            error={error}
            onCarrierChange={setCarrier}
            onForwardingTypeChange={setForwardingType}
            onRingTimeChange={setRingTimeSeconds}
            onSubmit={handleCreateForwardingConfig}
          />
        )}

        {step === 'forwarding_code' && (
          <ForwardingCodeDisplayStep
            config={forwardingConfig}
            isLoading={isLoading}
            error={error}
            onConfirm={handleConfirmSetup}
          />
        )}

        {step === 'confirmation' && (
          <ConfirmationStep />
        )}
      </div>
    </div>
  );
}
