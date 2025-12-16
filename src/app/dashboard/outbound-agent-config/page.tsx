'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle, CheckCircle, Loader, TestTube } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface OutboundAgentConfig {
  id?: string;
  vapi_api_key?: string;
  vapi_assistant_id?: string;
  system_prompt: string;
  first_message: string;
  voice_id: string;
  language: string;
  max_call_duration: number;
  is_active: boolean;
}

interface InboundStatus {
  configured: boolean;
  inboundNumber?: string;
  vapiPhoneNumberId?: string;
}

const VOICE_OPTIONS = [
  { id: 'Paige', name: 'Paige (Default)' },
  { id: 'Rohan', name: 'Rohan' },
  { id: 'Neha', name: 'Neha' },
  { id: 'Hana', name: 'Hana' },
  { id: 'Harry', name: 'Harry' },
  { id: 'Elliot', name: 'Elliot' },
  { id: 'Lily', name: 'Lily' },
  { id: 'Cole', name: 'Cole' },
  { id: 'Savannah', name: 'Savannah' },
  { id: 'Spencer', name: 'Spencer' },
  { id: 'Kylie', name: 'Kylie' }
];

const LANGUAGE_OPTIONS = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ko-KR', name: 'Korean' }
];

export default function OutboundAgentConfigPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<OutboundAgentConfig>({
    system_prompt: '',
    first_message: 'Hello! This is an outbound call.',
    voice_id: 'Paige',
    language: 'en-US',
    max_call_duration: 600,
    is_active: true
  });

  const [inboundStatus, setInboundStatus] = useState<InboundStatus | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchConfig();
      fetchInboundStatus();
    }
  }, [user]);

  const getToken = async () => {
    try {
      const response = await fetch('/api/auth/token');
      const data = await response.json();
      return data.token;
    } catch {
      return null;
    }
  };

  const fetchInboundStatus = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/inbound/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        setInboundStatus(null);
        return;
      }

      const data = await res.json();
      setInboundStatus({
        configured: Boolean(data?.configured),
        inboundNumber: data?.inboundNumber,
        vapiPhoneNumberId: data?.vapiPhoneNumberId
      });
    } catch {
      setInboundStatus(null);
    }
  };

  const fetchConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/founder-console/outbound-agent-config`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await res.json();

      // Don't overwrite existing values with masked values from backend
      setConfig(prev => ({
        ...data,
        vapi_api_key: data.vapi_api_key?.includes('••') ? prev.vapi_api_key : data.vapi_api_key,
      }));
    } catch (err: any) {
      setError(err?.message || 'Failed to load configuration');
      console.error('Error fetching config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'system_prompt':
        if (!value || value.trim() === '') return 'System prompt is required';
        return null;
      case 'first_message':
        if (!value || value.trim() === '') return 'First message is required';
        return null;
      case 'max_call_duration':
        const duration = parseInt(value);
        if (isNaN(duration)) return 'Must be a number';
        if (duration < 60 || duration > 3600) return 'Must be between 60 and 3600 seconds';
        return null;
      default:
        return null;
    }
  };

  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {};

    const fieldsToValidate = [
      'system_prompt',
      'first_message',
      'max_call_duration'
    ];

    fieldsToValidate.forEach(field => {
      const error = validateField(field, (config as any)[field]);
      if (error) errors[field] = error;
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field: string, value: any) => {
    setConfig({ ...config, [field]: value });
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: '' });
    }
  };

  const handleSave = async () => {
    // Validate all fields first
    if (!validateAllFields()) {
      setError('Please fix validation errors before saving');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const maxRetries = 3;
    const delays = [250, 500, 1000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const token = await getToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        // Prepare payload with correct types
        const payload = {
          system_prompt: config.system_prompt,
          first_message: config.first_message,
          voice_id: config.voice_id || 'Paige',
          language: config.language || 'en-US',
          max_call_duration: Number(config.max_call_duration) || 600,
          is_active: config.is_active !== false,
          // Only include optional fields if they have values
          ...(config.vapi_api_key && !config.vapi_api_key.includes('••') && { vapi_api_key: config.vapi_api_key }),
          ...(config.vapi_assistant_id && { vapi_assistant_id: config.vapi_assistant_id }),
        };

        const res = await fetch(`${API_BASE_URL}/api/founder-console/outbound-agent-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorData = await res.json();
          // Don't retry 4xx errors (validation failures)
          if (res.status >= 400 && res.status < 500) {
            throw new Error(errorData.error || 'Validation failed');
          }
          throw new Error(errorData.error || 'Server error');
        }

        const data = await res.json();
        setConfig(data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);

        // Invalidate cache so test page refetches fresh config
        if (typeof window !== 'undefined') {
          localStorage.removeItem('outbound_config_cache');
        }

        setIsSaving(false);
        return; // Success, exit retry loop
      } catch (err: any) {
        // Only retry network errors and timeouts
        const isNetworkError = err.name === 'AbortError' || err.name === 'TypeError';
        const isLastAttempt = attempt === maxRetries - 1;

        if (!isNetworkError || isLastAttempt) {
          setError(err?.message || 'Failed to save configuration');
          console.error('Error saving config:', err);
          setIsSaving(false);
          return;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      <LeftSidebar />

      <div className="flex-1 ml-64 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📤 Outbound Agent Configuration</h1>
            <p className="text-gray-600">Configure your outbound calling agent personality. Caller ID is always your inbound number.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Success</p>
                <p className="text-sm text-green-700">Configuration saved successfully</p>
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-8">
            {/* Caller ID (Read-only) */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">📞 Caller ID (Read-only)</h2>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  {inboundStatus?.configured && inboundStatus.inboundNumber
                    ? inboundStatus.inboundNumber
                    : 'Inbound not configured yet'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Outbound calls always use your inbound number.
                </p>
              </div>
            </div>

            {/* Vapi Configuration Section */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>🤖 Vapi Configuration</span>
                <span className="text-sm font-normal text-gray-600">(Shared with inbound)</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vapi API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={config.vapi_api_key || ''}
                    onChange={(e) => setConfig({ ...config, vapi_api_key: e.target.value })}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to use shared Vapi API key</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vapi Assistant ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={config.vapi_assistant_id || ''}
                    onChange={(e) => setConfig({ ...config, vapi_assistant_id: e.target.value })}
                    placeholder="assistant_xxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Vapi Assistant ID for this outbound agent</p>
                </div>
              </div>
            </div>

            {/* Agent Personality Section */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">🎭 Agent Personality</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    value={config.system_prompt || ''}
                    onChange={(e) => handleFieldChange('system_prompt', e.target.value)}
                    placeholder="You are a professional outbound sales representative..."
                    rows={4}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm ${fieldErrors.system_prompt ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {fieldErrors.system_prompt && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.system_prompt}</p>
                  )}
                  {!fieldErrors.system_prompt && (
                    <p className="text-xs text-gray-500 mt-1">Define the outbound agent&apos;s behavior and personality</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Message
                  </label>
                  <textarea
                    value={config.first_message || ''}
                    onChange={(e) => handleFieldChange('first_message', e.target.value)}
                    placeholder="Hello! This is an outbound call from..."
                    rows={3}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${fieldErrors.first_message ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {fieldErrors.first_message && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.first_message}</p>
                  )}
                  {!fieldErrors.first_message && (
                    <p className="text-xs text-gray-500 mt-1">The greeting message for outbound calls</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice
                    </label>
                    <select
                      value={config.voice_id}
                      onChange={(e) => setConfig({ ...config, voice_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {VOICE_OPTIONS.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language
                    </label>
                    <select
                      value={config.language}
                      onChange={(e) => setConfig({ ...config, language: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Call Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={config.max_call_duration}
                    onChange={(e) => handleFieldChange('max_call_duration', parseInt(e.target.value))}
                    min="60"
                    max="3600"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${fieldErrors.max_call_duration ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {fieldErrors.max_call_duration && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.max_call_duration}</p>
                  )}
                  {!fieldErrors.max_call_duration && (
                    <p className="text-xs text-gray-500 mt-1">Maximum duration for outbound calls (60-3600 seconds)</p>
                  )}
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={config.is_active}
                  onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active - Enable this outbound agent for making calls
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-gray-200 pt-8 flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Configuration
                  </>
                )}
              </button>

              <button
                onClick={() => router.push('/dashboard/test?tab=phone')}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <TestTube className="w-4 h-4" />
                Test Call
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
