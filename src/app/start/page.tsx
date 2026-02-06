'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function OnboardingPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const formElement = e.target as HTMLFormElement;
    const formData = new FormData(formElement);

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

      setStatus('success');
      formElement.reset();
      setTimeout(() => setStatus('idle'), 5000);

    } catch (error) {
      console.error('Submission error:', error);
      setStatus('idle');
      alert('Failed to submit. Please email support@voxanne.ai directly.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Simple Header - Logo Only */}
      <header className="w-full py-6 px-8 bg-white border-b flex justify-center">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          Voxanne.ai
        </Link>
      </header>

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
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <Input
                name="company"
                required
                placeholder="Smith Dermatology"
                disabled={status === 'loading'}
              />
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
                placeholder="you@example.com"
                disabled={status === 'loading'}
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
                placeholder="+1 (555) 123-4567"
                disabled={status === 'loading'}
              />
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
                placeholder="Thank you for calling Smith Dermatology. How may I help you today?"
                disabled={status === 'loading'}
                className="resize-none"
              />
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
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                PDF only, max 10MB
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={status === 'loading'}
              className="w-full"
            >
              {status === 'loading' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {status === 'idle' && 'Submit'}
              {status === 'loading' && 'Submitting...'}
              {status === 'success' && 'Submitted!'}
            </Button>

          </form>

          {/* Trust Badges */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            Secure • Human Verified • 24-Hour Setup
          </div>

        </div>
      </main>
    </div>
  );
}
