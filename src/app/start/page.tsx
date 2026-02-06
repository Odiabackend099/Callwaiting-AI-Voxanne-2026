'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, AlertCircle, FileText, X, Users, Send } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import Logo from '@/components/Logo';
import FooterRedesigned from '@/components/FooterRedesigned';
import { haptics } from '@/lib/haptics';
import { NetworkStatus, useNetworkStatus } from '@/components/pwa/NetworkStatus';
import { queueSubmission, processQueue, getQueuedCount } from '@/lib/offline-queue';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function OnboardingPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [phoneError, setPhoneError] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const { error: showError, warning, success: showSuccess } = useToast();
  const isOnline = useNetworkStatus();

  // Check offline queue on mount and when coming back online
  useEffect(() => {
    async function checkQueue() {
      const count = await getQueuedCount();
      setQueuedCount(count);
    }
    checkQueue();
  }, [isOnline]);

  const processOfflineQueue = async () => {
    try {
      const result = await processQueue(async (formData) => {
        const response = await fetch(`${BACKEND_URL}/api/onboarding-intake`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
      });

      if (result.success > 0) {
        haptics.success();
        showSuccess(`✅ Processed ${result.success} queued submission(s)`, 4000);
      }
      if (result.failed > 0) {
        haptics.error();
        showError(`⚠️ ${result.failed} submission(s) failed. Please contact support.`, 5000);
      }

      // Update queue count
      const count = await getQueuedCount();
      setQueuedCount(count);
    } catch (error) {
      console.error('Queue processing error:', error);
    }
  };

  // Auto-process queue when coming back online
  useEffect(() => {
    if (isOnline && queuedCount > 0) {
      processOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queuedCount]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptics.light(); // Haptic feedback on file selection
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        haptics.error(); // Error haptic
        setFileError('File must be under 10MB');
        warning('PDF file is too large. Please select a file under 10MB.', 4000);
        e.target.value = '';
        setSelectedFile(null);
      } else {
        haptics.success(); // Success haptic
        setFileError('');
        setSelectedFile(file);

        // Network-aware upload message
        if (!isOnline) {
          warning('File selected. Will upload when connection is restored.', 3000);
        }
      }
    }
  };

  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const phoneValue = e.target.value;
    if (phoneValue && !isValidPhoneNumber(phoneValue, 'US')) {
      haptics.warning(); // Warning haptic for validation error
      setPhoneError('Please enter a valid phone number (e.g., +1 555-123-4567)');
    } else {
      setPhoneError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium(); // Haptic feedback on form submission

    // Validate phone before submitting
    const formElement = e.target as HTMLFormElement;
    const phoneInput = formElement.elements.namedItem('phone') as HTMLInputElement;
    if (phoneInput.value && !isValidPhoneNumber(phoneInput.value, 'US')) {
      haptics.error();
      setPhoneError('Please enter a valid phone number');
      showError('Please fix the phone number error before submitting');
      return;
    }

    setStatus('loading');

    const formData = new FormData(formElement);

    // Format phone to E.164 if possible
    try {
      const phoneValue = phoneInput.value;
      if (phoneValue && isValidPhoneNumber(phoneValue, 'US')) {
        const parsedPhone = parsePhoneNumber(phoneValue, 'US');
        formData.set('phone', parsedPhone.number); // E.164 format
      }
    } catch (error) {
      console.warn('Phone formatting failed, using original value:', error);
    }

    // If offline, queue submission for later
    if (!isOnline) {
      try {
        await queueSubmission(formData);
        haptics.success();
        setStatus('success');
        showSuccess('📦 Submission queued. Will send when connection is restored.', 5000);
        const count = await getQueuedCount();
        setQueuedCount(count);
        return;
      } catch (error) {
        console.error('Queue error:', error);
        haptics.error();
        setStatus('idle');
        showError('Failed to queue submission. Please try again.', 5000);
        return;
      }
    }

    // Online submission
    try {
      console.log('Submitting to:', `${BACKEND_URL}/api/onboarding-intake`);

      const response = await fetch(`${BACKEND_URL}/api/onboarding-intake`, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Success result:', result);

      haptics.success(); // Success haptic
      setStatus('success');
      // Don't reset form - keep success message visible
      // User can refresh page to submit again if needed

    } catch (error) {
      console.error('Submission error:', error);
      haptics.error(); // Error haptic
      setStatus('idle');
      showError('Failed to submit. Please email support@voxanne.ai directly.', 5000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Network Status Banner */}
      <NetworkStatus />

      {/* Navigation Bar */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full bg-white">
        <Logo
          variant="icon-blue"
          size="lg"
          href="/"
          priority
        />

        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium min-h-[48px] flex items-center active:scale-95 transition-transform"
          onClick={() => haptics.light()}
        >
          Back to Home Page
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Let&apos;s Build Your AI Agent
            </h1>
            <p className="text-lg text-gray-600">
              Provide your pricing sheet and greeting script below.
              Our team will configure your instance within 24 hours.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 space-y-6">

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <Input
                autoFocus
                name="company"
                required
                placeholder="e.g., Your Clinic Name"
                disabled={status === 'loading'}
                className="min-h-[48px] text-base placeholder:text-gray-400"
                onFocus={() => haptics.light()}
              />
            </div>

            {/* Company Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Website (Optional)
              </label>
              <Input
                name="website"
                type="url"
                placeholder="https://yourcompany.com"
                disabled={status === 'loading'}
                className="min-h-[48px] text-base placeholder:text-gray-400"
                onFocus={() => haptics.light()}
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll use this to personalize your AI agent's knowledge
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Email *
              </label>
              <Input
                name="email"
                type="email"
                required
                placeholder="your.email@company.com"
                disabled={status === 'loading'}
                className="min-h-[48px] text-base placeholder:text-gray-400"
                onFocus={() => haptics.light()}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <Input
                name="phone"
                type="tel"
                required
                placeholder="+44 7700 900000"
                disabled={status === 'loading'}
                onFocus={() => haptics.light()}
                onBlur={handlePhoneBlur}
                className={`min-h-[48px] text-base placeholder:text-gray-400 ${phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {phoneError && (
                <p className="text-sm text-red-600 flex items-start gap-2 mt-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {phoneError}
                    {!phoneError.includes('+1') && (
                      <button
                        type="button"
                        className="ml-2 underline text-blue-600 hover:text-blue-700 min-h-[48px] active:scale-95 transition-transform"
                        onClick={() => {
                          haptics.medium();
                          const phoneInputElem = document.querySelector('input[name="phone"]') as HTMLInputElement;
                          if (phoneInputElem) {
                            phoneInputElem.value = '+1 ' + phoneInputElem.value.replace(/^\+1\s*/, '');
                            phoneInputElem.focus();
                            setPhoneError('');
                          }
                        }}
                      >
                        Add +1 prefix
                      </button>
                    )}
                  </span>
                </p>
              )}
            </div>

            {/* Greeting Script */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reception Greeting Script *
              </label>
              <Textarea
                name="greeting_script"
                required
                rows={4}
                placeholder="e.g., Thank you for calling [Your Company]. How may I help you today?"
                disabled={status === 'loading'}
                className="resize-none text-base placeholder:text-gray-400 min-h-[96px]"
                onFocus={() => haptics.light()}
              />
            </div>

            {/* Voice Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Voice Type
              </label>
              <select
                name="voice_preference"
                disabled={status === 'loading'}
                className="flex min-h-[48px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onFocus={() => haptics.light()}
                onChange={() => haptics.light()}
              >
                <option value="AI (Neutral)">AI (Neutral) - Natural, balanced tone</option>
                <option value="Male Voice">Male Voice - Professional male voice</option>
                <option value="Female Voice">Female Voice - Professional female voice</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the voice type for your AI agent
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pricing/Menu PDF (Optional)
              </label>
              <input
                type="file"
                name="pricing_pdf"
                accept=".pdf"
                disabled={status === 'loading'}
                onChange={handleFileChange}
                className={`block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50
                  ${fileError ? 'border border-red-500 rounded-md' : ''}`}
              />
              {fileError ? (
                <p className="text-sm text-red-600 flex items-start gap-2 mt-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {fileError}
                    <button
                      type="button"
                      className="ml-2 underline text-blue-600 hover:text-blue-700 min-h-[48px] active:scale-95 transition-transform"
                      onClick={() => {
                        haptics.light();
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) {
                          fileInput.value = '';
                          setFileError('');
                          setSelectedFile(null);
                        }
                      }}
                    >
                      Choose another file
                    </button>
                  </span>
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  PDF only, max 10MB
                </p>
              )}

              {/* File Preview */}
              {selectedFile && !fileError && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg flex items-center gap-3 border border-blue-200">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = '';
                        setSelectedFile(null);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center active:scale-95 transition-transform"
                    aria-label="Remove file"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-600 border-t border-gray-100">
              <Users className="h-4 w-4 text-green-600" />
              <span>
                Join <strong className="text-gray-900">150+ healthcare practices</strong> using Voxanne AI
              </span>
            </div>

            {/* Submit Button or Success Message */}
            {status === 'success' ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Submitted Successfully! ✅
                </h3>
                <p className="text-gray-600">
                  Check your email for next steps. Our team will configure your AI agent within 24 hours.
                </p>
                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto min-h-[48px]"
                    asChild
                  >
                    <a
                      href="https://calendly.com/austyneguale/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => haptics.medium()}
                    >
                      📅 Book a 30-Min Demo
                    </a>
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Want to see the platform in action?
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Button
                  type="submit"
                  disabled={status === 'loading' || !!phoneError || !!fileError}
                  className="w-full relative min-h-[48px] active:scale-95 transition-transform"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isOnline ? 'Submitting...' : 'Queuing for later...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isOnline ? 'Submit Application' : '📦 Queue Submission (Offline)'}
                    </>
                  )}
                </Button>

                {/* Offline Queue Indicator */}
                {queuedCount > 0 && (
                  <div className="mt-2 text-center text-sm text-amber-600 flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      {queuedCount} submission{queuedCount > 1 ? 's' : ''} queued. Will send when online.
                    </span>
                  </div>
                )}
              </>
            )}

          </form>

          {/* Trust Badges */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            Secure • Human Verified • 24-Hour Setup
          </div>

        </div>
      </main>

      {/* Footer */}
      <FooterRedesigned disableAnimations={true} />
    </div>
  );
}
