'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Smartphone, Loader2, Phone, CheckCircle, AlertCircle, ShoppingCart, Trash2 } from 'lucide-react';
import TelephonySetupWizard from './components/TelephonySetupWizard';
import { BuyNumberModal } from '@/components/dashboard/BuyNumberModal';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface ManagedNumber {
  phoneNumber: string;
  status: string;
  vapiPhoneId: string | null;
  countryCode: string;
}

export default function TelephonyPage() {
  const { user, loading } = useAuth();
  const [showBuyNumberModal, setShowBuyNumberModal] = useState(false);
  const [managedNumbers, setManagedNumbers] = useState<ManagedNumber[]>([]);
  const [fetchingNumbers, setFetchingNumbers] = useState(false);
  const [deletingNumber, setDeletingNumber] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [confirmDeleteNumber, setConfirmDeleteNumber] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch managed numbers on mount
  useEffect(() => {
    fetchManagedNumbers();
  }, []);

  const fetchManagedNumbers = async () => {
    try {
      setFetchingNumbers(true);
      setFetchError(null);
      const data = await authedBackendFetch<{
        mode: string;
        subaccount?: any;
        numbers: ManagedNumber[];
      }>('/api/managed-telephony/status');
      setManagedNumbers(data.numbers || []);
    } catch (err: any) {
      console.error('Failed to fetch managed numbers:', err);
      setFetchError(err.message || 'Failed to load managed numbers');
      setManagedNumbers([]);
    } finally {
      setFetchingNumbers(false);
    }
  };

  const handleDeleteNumber = async (phoneNumber: string) => {
    try {
      setDeletingNumber(phoneNumber);
      setDeleteError(null);

      await authedBackendFetch(`/api/managed-telephony/numbers/${encodeURIComponent(phoneNumber)}`, {
        method: 'DELETE',
      });

      // Refresh the list
      await fetchManagedNumbers();

      // Show success message
      setDeleteSuccess(`Successfully deleted ${phoneNumber}`);
      setTimeout(() => setDeleteSuccess(null), 5000);
      setConfirmDeleteNumber(null);
    } catch (err: any) {
      console.error('Failed to delete number:', err);
      setDeleteError(err.message || 'Failed to delete number');
    } finally {
      setDeletingNumber(null);
    }
  };

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

      {/* Active Managed Numbers - Always Show */}
      <div className="bg-white border border-surgical-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-surgical-600" />
            <h3 className="text-lg font-semibold text-obsidian">
              Active Managed Numbers
            </h3>
          </div>
          {!fetchingNumbers && managedNumbers.length > 0 && (
            <span className="text-sm text-obsidian/60">
              {managedNumbers.length} {managedNumbers.length === 1 ? 'number' : 'numbers'}
            </span>
          )}
        </div>

        {/* Error State */}
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-2">
                  Failed to Load Numbers
                </p>
                <p className="text-sm text-red-700 mb-3">{fetchError}</p>
              </div>
              <button
                onClick={fetchManagedNumbers}
                className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {fetchingNumbers && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-surgical-600 mr-2" />
            <span className="text-obsidian/60">Loading numbers...</span>
          </div>
        )}

        {/* Empty State */}
        {!fetchingNumbers && managedNumbers.length === 0 && !fetchError && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-surgical-50 mx-auto flex items-center justify-center mb-4 border border-surgical-200">
              <Phone className="w-8 h-8 text-surgical-400" />
            </div>
            <h4 className="text-lg font-semibold text-obsidian mb-2">
              No Managed Numbers Yet
            </h4>
            <p className="text-sm text-obsidian/60 mb-6 max-w-sm mx-auto">
              Buy a dedicated AI phone number to get started. We'll handle all the setup in minutes.
            </p>
            <button
              onClick={() => setShowBuyNumberModal(true)}
              className="px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium inline-flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Buy Your First Number
            </button>
          </div>
        )}

        {/* Numbers List */}
        {!fetchingNumbers && managedNumbers.length > 0 && (
          <div className="space-y-3">
            {managedNumbers.map((num) => (
              <div
                key={num.phoneNumber}
                className="flex items-center justify-between p-4 border border-surgical-200 rounded-lg hover:bg-surgical-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surgical-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-surgical-600" />
                  </div>
                  <div>
                    <div className="font-medium text-obsidian">{num.phoneNumber}</div>
                    <div className="text-xs text-obsidian/60">
                      {num.countryCode} • {num.status}
                      {num.vapiPhoneId && ` • Vapi ID: ${num.vapiPhoneId.slice(0, 8)}...`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDeleteNumber(num.phoneNumber)}
                  disabled={deletingNumber === num.phoneNumber}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingNumber === num.phoneNumber ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buy Managed Number Option */}
      <div className="bg-white border border-surgical-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-5 h-5 text-surgical-600" />
              <h3 className="text-lg font-semibold text-obsidian">
                {managedNumbers.length > 0 ? 'Buy Another Number' : 'Managed Phone Number'}
              </h3>
            </div>
            <p className="text-sm text-obsidian/60 mb-4">
              Get a dedicated AI phone number in minutes. No Twilio account needed—we handle everything.
            </p>
            <ul className="space-y-2 text-sm text-obsidian/60 ml-6 list-disc">
              <li>Instant provisioning (2-3 minutes)</li>
              <li>Local or toll-free numbers available</li>
              <li>$1.50/month + usage-based pricing</li>
              <li>Fully managed by Voxanne</li>
            </ul>
          </div>
          <button
            onClick={() => setShowBuyNumberModal(true)}
            className="px-6 py-3 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <ShoppingCart className="w-4 h-4" />
            {managedNumbers.length > 0 ? 'Buy Another' : 'Buy Number'}
          </button>
        </div>
      </div>

      {/* OR Separator */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-surgical-200"></div>
        <span className="text-sm font-medium text-obsidian/40">OR</span>
        <div className="flex-1 border-t border-surgical-200"></div>
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteNumber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-200">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-obsidian">
                  Delete Phone Number?
                </h3>
                <p className="text-sm text-obsidian/60 font-mono">
                  {confirmDeleteNumber}
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-red-900 mb-2">
                This action cannot be undone. This will:
              </p>
              <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
                <li>Release the number from Vapi</li>
                <li>Release the number from Twilio</li>
                <li>Remove all routing configurations</li>
                <li>Disconnect any active calls</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteNumber(null)}
                className="flex-1 px-4 py-2 border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteNumber(confirmDeleteNumber);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete Number
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {deleteSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm animate-pulse z-40">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium text-green-900">{deleteSuccess}</p>
            <button
              onClick={() => setDeleteSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-700 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {deleteError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm z-40">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-900">{deleteError}</p>
            <button
              onClick={() => setDeleteError(null)}
              className="ml-auto text-red-600 hover:text-red-700 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Buy Number Modal */}
      {showBuyNumberModal && (
        <BuyNumberModal
          onClose={() => {
            setShowBuyNumberModal(false);
            // Refresh numbers list after modal closes (in case new number was provisioned)
            fetchManagedNumbers();
          }}
          currentMode="none"
        />
      )}
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
