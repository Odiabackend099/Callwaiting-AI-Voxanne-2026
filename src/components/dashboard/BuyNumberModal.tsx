'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Loader2, AlertCircle, Check, Search } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface BuyNumberModalProps {
  onClose: () => void;
  onSuccess?: (phoneNumber: string) => void;
  currentMode?: string;
}

type Step = 'search' | 'confirm' | 'success';

interface AvailableNumber {
  phoneNumber: string;
  locality?: string;
  region?: string;
}

export function BuyNumberModal({ onClose, onSuccess, currentMode }: BuyNumberModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [country] = useState('US');
  const [numberType, setNumberType] = useState<'local' | 'toll_free'>('local');
  const [areaCode, setAreaCode] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const searchNumbers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ country, numberType });
      if (areaCode) params.set('areaCode', areaCode);

      const data = await authedBackendFetch<{ numbers: AvailableNumber[] }>(
        `/api/managed-telephony/available-numbers?${params.toString()}`
      );
      setAvailableNumbers(data.numbers || []);
      if (!data.numbers?.length) {
        setError('No numbers found. Try a different area code or number type.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search numbers');
    } finally {
      setLoading(false);
    }
  };

  const provisionNumber = async () => {
    if (!selectedNumber) return;
    setProvisioning(true);
    setError(null);
    try {
      const data = await authedBackendFetch<{
        success: boolean;
        phoneNumber: string;
        warning?: string;
        error?: string;
      }>('/api/managed-telephony/provision', {
        method: 'POST',
        body: JSON.stringify({ country, numberType, areaCode }),
      });

      if (!data.success) {
        setError(data.error || 'Provisioning failed');
        return;
      }

      setProvisionedNumber(data.phoneNumber);
      if (data.warning) setWarning(data.warning);
      setStep('success');
      onSuccess?.(data.phoneNumber);
    } catch (err: any) {
      setError(err.message || 'Failed to provision number');
    } finally {
      setProvisioning(false);
    }
  };

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

                {/* Area code input */}
                {numberType === 'local' && (
                  <div>
                    <label className="block text-sm font-medium text-obsidian/70 mb-2">
                      Area Code <span className="text-obsidian/40">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={areaCode}
                      onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="e.g. 212"
                      className="w-full px-4 py-2.5 border border-surgical-200 rounded-lg text-obsidian placeholder:text-obsidian/30 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Search button */}
                <button
                  onClick={searchNumbers}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surgical-600 text-white rounded-lg font-medium hover:bg-surgical-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loading ? 'Searching...' : 'Search Available Numbers'}
                </button>

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
                  <p className="text-sm text-obsidian/50 mt-2">$1.50/month + usage</p>
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
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surgical-600 text-white rounded-lg font-medium hover:bg-surgical-700 transition-colors disabled:opacity-50"
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
