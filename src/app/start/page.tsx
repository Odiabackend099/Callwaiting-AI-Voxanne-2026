'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, AlertCircle, FileText, X, Users, Send } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import Logo from '@/components/Logo';
import FooterRedesigned from '@/components/FooterRedesigned';
import { haptics } from '@/lib/haptics';
import { NetworkStatus, useNetworkStatus } from '@/components/pwa/NetworkStatus';
import { queueSubmission, processQueue, getQueuedCount } from '@/lib/offline-queue';
import { trackEvent } from '@/lib/analytics';

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingForm />
    </Suspense>
  );
}

// Field validation rules: which fields are required
const REQUIRED_FIELDS = new Set(['company', 'email', 'phone', 'greeting_script']);
const OPTIONAL_FIELDS = new Set(['website', 'pricing_pdf']);

function OnboardingForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [queuedCount, setQueuedCount] = useState(0);

  const { error: showError, warning, success: showSuccess } = useToast();
  const isOnline = useNetworkStatus();
  const searchParams = useSearchParams();
  const [startTime] = useState(() => Date.now());

  // Auto-process offline queue when coming back online
  useEffect(() => {
    async function checkQueue() {
      const count = await getQueuedCount();
      setQueuedCount(count);
    }
    checkQueue();
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && queuedCount > 0) {
      processOfflineQueue();
    }
  }, [isOnline, queuedCount]);

  // Track form view for analytics
  useEffect(() => {
    trackEvent('form_view', { page: 'start' });
    const source = searchParams.get('utm_source');
    if (source) {
      trackEvent('utm_landing', {
        utm_source: source,
        utm_medium: searchParams.get('utm_medium') || '',
        utm_campaign: searchParams.get('utm_campaign') || '',
      });
    }
  }, [searchParams]);

  // Track abandon if user leaves without submitting
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (status !== 'success') {
        trackEvent('form_abandon', {
          page: 'start',
          time_on_page: Math.round((Date.now() - startTime) / 1000),
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status, startTime]);

  const processOfflineQueue = async () => {
    try {
      const result = await processQueue(async (formData) => {
        const response = await fetch('/api/onboarding-intake', {
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

      const count = await getQueuedCount();
      setQueuedCount(count);
    } catch (error) {
      console.error('Queue processing error:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptics.light();
    const file = e.target.files?.[0];

    if (file) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        haptics.error();
        setFileError('PDF file must be under 10MB');
        warning('File is too large. Maximum size is 10MB.', 4000);
        e.target.value = '';
        setSelectedFile(null);
      } else {
        haptics.success();
        setFileError('');
        setSelectedFile(file);

        if (!isOnline) {
          warning('File selected. Will upload when connection is restored.', 3000);
        }
      }
    }
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return false; // Required field
    // E.164 format: + followed by 1-15 digits (spaces, dashes, parentheses allowed)
    const e164Regex = /^\+[\d\s\-\(\)]{7,19}$/;
    return e164Regex.test(phone);
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return false; // Required field
    // Simple but effective email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateWebsite = (website: string): boolean => {
    if (!website) return true; // Optional field - empty is valid
    // Basic website validation
    const websiteRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return websiteRegex.test(website);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();

    // Clear previous errors
    setFieldErrors({});

    const formElement = e.target as HTMLFormElement;
    const formData = new FormData(formElement);

    // Client-side validation before submitting
    const companyName = (formElement.elements.namedItem('company') as HTMLInputElement)?.value || '';
    const email = (formElement.elements.namedItem('email') as HTMLInputElement)?.value || '';
    const phone = (formElement.elements.namedItem('phone') as HTMLInputElement)?.value || '';
    const greetingScript = (formElement.elements.namedItem('greeting_script') as HTMLTextAreaElement)?.value || '';
    const website = (formElement.elements.namedItem('website') as HTMLInputElement)?.value || '';

    const errors: Record<string, string> = {};

    // Validate required fields
    if (!companyName.trim()) {
      errors.company = 'Company name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!validatePhoneNumber(phone)) {
      errors.phone = 'Please enter a valid phone number in E.164 format (e.g., +1 555 123 4567)';
    }

    if (!greetingScript.trim()) {
      errors.greeting_script = 'Reception greeting script is required';
    }

    // Validate optional fields only if provided
    if (website && !validateWebsite(website)) {
      errors.website = 'Please enter a valid website (e.g., yourcompany.com or https://yourcompany.com)';
    }

    // Show client-side validation errors
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      haptics.error();
      const firstError = Object.entries(errors)[0];
      showError(`${firstError[0]}: ${firstError[1]}`, 5000);
      return;
    }

    setStatus('loading');

    // Append UTM and metadata
    const utmSource = searchParams.get('utm_source');
    if (utmSource) formData.set('utm_source', utmSource);
    const utmMedium = searchParams.get('utm_medium');
    if (utmMedium) formData.set('utm_medium', utmMedium);
    const utmCampaign = searchParams.get('utm_campaign');
    if (utmCampaign) formData.set('utm_campaign', utmCampaign);
    const planParam = searchParams.get('plan');
    if (planParam) formData.set('plan', planParam);
    formData.set('time_to_complete_seconds', String(Math.round((Date.now() - startTime) / 1000)));

    // Handle offline submission
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

    // Handle online submission
    try {
      const response = await fetch('/api/onboarding-intake', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();

        try {
          const errorData = JSON.parse(errorText);

          // Handle field-specific errors from API
          if (errorData.details && Array.isArray(errorData.details)) {
            const apiErrors: Record<string, string> = {};
            errorData.details.forEach((detail: { field: string; message: string }) => {
              apiErrors[detail.field] = detail.message;
            });
            setFieldErrors(apiErrors);

            const firstError = errorData.details[0];
            if (firstError) {
              haptics.error();
              showError(`${firstError.field}: ${firstError.message}`, 5000);
            }
          } else if (errorData.error) {
            // Handle general API error
            haptics.error();
            showError(errorData.error, 5000);
          } else {
            throw new Error(`API error: ${response.status}`);
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          haptics.error();
          showError('An error occurred. Please try again or contact support.', 5000);
        }

        setStatus('idle');
        return;
      }

      const result = await response.json();

      haptics.success();
      trackEvent('form_submit_success', {
        page: 'start',
        time_to_complete: Math.round((Date.now() - startTime) / 1000),
        utm_source: searchParams.get('utm_source') || 'direct',
        plan: searchParams.get('plan') || 'payg',
      });
      setStatus('success');
    } catch (error) {
      console.error('Submission error:', error);
      haptics.error();
      setStatus('idle');
      showError('Failed to submit form. Please try again or contact support@voxanne.ai', 5000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <NetworkStatus />

      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full bg-white">
        <Logo variant="icon-blue" size="lg" href="/" priority />
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium min-h-[48px] flex items-center active:scale-95 transition-transform"
          onClick={() => haptics.light()}
        >
          Back to Home Page
        </Link>
      </nav>

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

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 space-y-6">
            {/* Company Name - REQUIRED */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-600">*</span>
              </label>
              <Input
                autoFocus
                name="company"
                required
                placeholder="e.g., Your Clinic Name"
                disabled={status === 'loading'}
                className={`min-h-[48px] text-base placeholder:text-gray-400 ${
                  fieldErrors.company ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                onFocus={() => haptics.light()}
                onChange={() => {
                  if (fieldErrors.company) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.company;
                    setFieldErrors(newErrors);
                  }
                }}
              />
              {fieldErrors.company && (
                <div className="flex items-start gap-2 mt-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{fieldErrors.company}</span>
                </div>
              )}
            </div>

            {/* Company Website - OPTIONAL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Website <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <Input
                name="website"
                type="text"
                placeholder="yourcompany.com or https://yourcompany.com"
                disabled={status === 'loading'}
                className={`min-h-[48px] text-base placeholder:text-gray-400 ${
                  fieldErrors.website ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                onFocus={() => haptics.light()}
                onChange={() => {
                  if (fieldErrors.website) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.website;
                    setFieldErrors(newErrors);
                  }
                }}
              />
              {fieldErrors.website ? (
                <div className="flex items-start gap-2 mt-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{fieldErrors.website}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  We&apos;ll use this to personalize your AI agent&apos;s knowledge
                </p>
              )}
            </div>

            {/* Email - REQUIRED */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Email <span className="text-red-600">*</span>
              </label>
              <Input
                name="email"
                type="email"
                required
                placeholder="your.email@company.com"
                disabled={status === 'loading'}
                className={`min-h-[48px] text-base placeholder:text-gray-400 ${
                  fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                onFocus={() => haptics.light()}
                onChange={() => {
                  if (fieldErrors.email) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.email;
                    setFieldErrors(newErrors);
                  }
                }}
              />
              {fieldErrors.email && (
                <div className="flex items-start gap-2 mt-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{fieldErrors.email}</span>
                </div>
              )}
            </div>

            {/* Phone - REQUIRED */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-red-600">*</span>
              </label>
              <Input
                name="phone"
                type="tel"
                required
                placeholder="+1 555 123 4567 or +44 7700 900000"
                disabled={status === 'loading'}
                className={`min-h-[48px] text-base placeholder:text-gray-400 ${
                  fieldErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                onFocus={() => haptics.light()}
                onChange={() => {
                  if (fieldErrors.phone) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.phone;
                    setFieldErrors(newErrors);
                  }
                }}
              />
              {fieldErrors.phone && (
                <div className="flex items-start gap-2 mt-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{fieldErrors.phone}</span>
                </div>
              )}
              {!fieldErrors.phone && (
                <p className="text-xs text-gray-500 mt-1">
                  Include country code: +1 for US/Canada, +44 for UK, +61 for Australia. Spaces and dashes are optional.
                </p>
              )}
            </div>

            {/* Greeting Script - REQUIRED */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reception Greeting Script <span className="text-red-600">*</span>
              </label>
              <Textarea
                name="greeting_script"
                required
                rows={4}
                placeholder="e.g., Thank you for calling [Your Company]. How may I help you today?"
                disabled={status === 'loading'}
                className={`resize-none text-base placeholder:text-gray-400 min-h-[96px] ${
                  fieldErrors.greeting_script ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                onFocus={() => haptics.light()}
                onChange={() => {
                  if (fieldErrors.greeting_script) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.greeting_script;
                    setFieldErrors(newErrors);
                  }
                }}
              />
              {fieldErrors.greeting_script && (
                <div className="flex items-start gap-2 mt-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{fieldErrors.greeting_script}</span>
                </div>
              )}
              {/* Hidden field required by backend validation */}
              <input type="hidden" name="additionalDetails" value="" />
            </div>

            {/* Voice Preference - OPTIONAL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Voice Type <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <select
                name="voice_preference"
                disabled={status === 'loading'}
                className="flex min-h-[48px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onFocus={() => haptics.light()}
                onChange={() => haptics.light()}
              >
                <option value="">Select a voice type</option>
                <option value="AI (Neutral)">AI (Neutral) - Natural, balanced tone</option>
                <option value="Male Voice">Male Voice - Professional male voice</option>
                <option value="Female Voice">Female Voice - Professional female voice</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the voice type for your AI agent
              </p>
            </div>

            {/* File Upload - OPTIONAL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pricing/Menu PDF <span className="text-gray-500 text-xs font-normal">(Optional)</span>
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
                <div className="flex items-start gap-2 mt-1 text-sm text-red-600">
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
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  PDF only, max 10MB
                </p>
              )}

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

            {/* Submit Button or Success */}
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
                  <Button variant="outline" className="w-full sm:w-auto min-h-[48px]" asChild>
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
                  disabled={status === 'loading' || !!fileError}
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

      <FooterRedesigned disableAnimations={true} />
    </div>
  );
}
