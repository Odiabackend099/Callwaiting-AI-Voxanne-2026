'use client';

import { useState, useEffect } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type VerificationStep = 'input' | 'verify' | 'success';

interface VerifiedNumber {
  id: string;
  phone_number: string;
  country_code: string;
  verified_at: string;
  status: string;
}

export default function VerifiedCallerIDPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState<VerificationStep>('input');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedNumbers, setVerifiedNumbers] = useState<VerifiedNumber[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [numberToDelete, setNumberToDelete] = useState<string | null>(null);

  // Load existing verified numbers on mount
  useEffect(() => {
    fetchVerifiedNumbers();
  }, []);

  const fetchVerifiedNumbers = async () => {
    try {
      const res = await authedBackendFetch('/api/verified-caller-id/list') as Response;
      if (res.ok) {
        const data = await res.json();
        setVerifiedNumbers(data.numbers || []);
      }
    } catch (err) {
      console.error('Error fetching verified numbers:', err);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authedBackendFetch('/api/verified-caller-id/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          countryCode: 'US'
        })
      }) as Response;

      const data = await res.json();

      if (res.ok) {
        setStep('verify');
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification call');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authedBackendFetch('/api/verified-caller-id/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          code
        })
      }) as Response;

      const data = await res.json();

      if (res.ok) {
        setStep('success');
        fetchVerifiedNumbers(); // Refresh the list
      } else {
        setError(data.error || 'Confirmation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm verification');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setNumberToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!numberToDelete) return;

    setShowDeleteConfirm(false);

    try {
      const res = await authedBackendFetch(`/api/verified-caller-id/${numberToDelete}`, {
        method: 'DELETE'
      }) as Response;

      if (res.ok) {
        fetchVerifiedNumbers(); // Refresh the list
      }
    } catch (err) {
      console.error('Error deleting verified number:', err);
    } finally {
      setNumberToDelete(null);
    }
  };

  const resetForm = () => {
    setStep('input');
    setPhoneNumber('');
    setCode('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verified Caller ID
          </h1>
          <p className="text-gray-600">
            Verify your business phone number to use it as Caller ID for outbound AI calls.
            This ensures your customers see your familiar business number, not an unknown number.
          </p>
        </div>

        {/* Existing Verified Numbers */}
        {verifiedNumbers.length > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Your Verified Numbers</h2>
            <div className="space-y-3">
              {verifiedNumbers.map((number) => (
                <div
                  key={number.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-mono font-bold text-lg">
                      {number.phone_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      Verified {new Date(number.verified_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      ✓ Active
                    </span>
                    <button
                      onClick={() => handleDeleteClick(number.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Form */}
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold mb-6">
            {step === 'input' && 'Add New Number'}
            {step === 'verify' && 'Enter Verification Code'}
            {step === 'success' && 'Verification Complete!'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Step 1: Phone Number Input */}
          {step === 'input' && (
            <div>
              <p className="mb-6 text-gray-600">
                You'll receive a phone call with a 6-digit verification code.
                Answer the call and enter the code to verify ownership.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Format: +1 for US numbers (e.g., +15551234567)
                </p>
              </div>

              <button
                onClick={handleVerify}
                disabled={!phoneNumber || loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Verification Call'}
              </button>
            </div>
          )}

          {/* Step 2: Code Entry */}
          {step === 'verify' && (
            <div>
              <p className="mb-6 text-gray-600">
                You should receive a call at <strong className="font-mono">{phoneNumber}</strong> with your verification code.
                The call may take up to 30 seconds to arrive.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={code.length !== 6 || loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Confirm Code'}
                </button>
              </div>

              <button
                onClick={handleVerify}
                className="w-full mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                disabled={loading}
              >
                Didn't receive the call? Send again
              </button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  ✅ Verified Successfully!
                </h3>
                <p className="text-gray-600">
                  Outbound calls from your AI assistant will now show{' '}
                  <strong className="font-mono">{phoneNumber}</strong> as the Caller ID.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={resetForm}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Verify Another Number
                </button>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">
            💡 What is Verified Caller ID?
          </h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>• Your AI assistant can make outbound calls using your verified business number</li>
            <li>• Customers see your familiar number, not an unknown number</li>
            <li>• Increases answer rates and builds trust</li>
            <li>• No monthly fees – this is a free feature powered by Twilio</li>
          </ul>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Remove Verified Number"
        message="Are you sure you want to remove this verified number? You will need to verify it again if you want to use it in the future."
        confirmText="Remove"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setNumberToDelete(null);
        }}
      />
    </div>
  );
}
