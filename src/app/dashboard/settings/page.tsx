'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Bot, Phone, Save, Check, X, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// ============================================================================
// CONSTANTS
// ============================================================================

// Retry configuration for network failures
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [250, 500, 1000] // ms
};

// UI timing constants
const SAVE_SUCCESS_DISPLAY_MS = 3000; // Show "Saved" indicator for 3 seconds
const BATCH_SAVE_DEBOUNCE_MS = 500; // Wait 500ms before batching saves

// Validation constraints
const AGENT_CONFIG_CONSTRAINTS = {
  MIN_DURATION_SECONDS: 60,
  MAX_DURATION_SECONDS: 3600,
  DEFAULT_DURATION_SECONDS: 300
};

// Error messages
const ERROR_MESSAGES = {
  EMPTY_VALUE: 'This field cannot be empty',
  INVALID_DURATION: `Duration must be between ${AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS} and ${AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS} seconds`,
  AGENT_NOT_LOADED: 'Agent configuration not loaded. Please refresh the page.',
  INVALID_API_KEY: 'Invalid API key - connection failed',
  FAILED_TO_SAVE: 'Failed to save. Please try again.',
  FAILED_TO_LOAD: 'Failed to load settings. Please refresh the page.',
  VAPI_NOT_CONFIGURED: 'Configure Vapi API key first to enable this feature'
};

interface Voice {
  id: string;
  name: string;
  gender: string;
  provider: string;
  isDefault?: boolean;
}

interface FieldState {
  value: string;
  originalValue: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
  visible?: boolean;
}

type TabType = 'api-keys' | 'agent-config';

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return '••••••••' + key.slice(-4);
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  return token || null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('api-keys');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [vapiConfigured, setVapiConfigured] = useState(false);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [globalSaving, setGlobalSaving] = useState(false);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [vapiApiKey, setVapiApiKey] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null, visible: false
  });
  const [vapiPublicKey, setVapiPublicKey] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null, visible: false
  });
  const [twilioSid, setTwilioSid] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null, visible: false
  });
  const [twilioToken, setTwilioToken] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null, visible: false
  });
  const [twilioPhone, setTwilioPhone] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null, visible: false
  });

  const [systemPrompt, setSystemPrompt] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null
  });
  const [firstMessage, setFirstMessage] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null
  });
  const [maxSeconds, setMaxSeconds] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null
  });
  const [voiceId, setVoiceId] = useState<FieldState>({
    value: '', originalValue: '', saving: false, saved: false, error: null
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setLoadError(null);

        // Parallel fetching instead of sequential
        const [settingsRes, voicesRes, agentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/founder-console/settings`),
          fetch(`${API_BASE_URL}/api/assistants/voices/available`),
          fetch(`${API_BASE_URL}/api/founder-console/agent/config`)
        ]);

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setVapiConfigured(data.vapiConfigured);
          setTwilioConfigured(data.twilioConfigured);
        } else {
          console.error('[Settings] Failed to fetch settings:', settingsRes.status);
        }

        if (voicesRes.ok) {
          const voicesData = await voicesRes.json();
          setVoices(voicesData);
        } else {
          console.error('[Settings] Failed to fetch voices:', voicesRes.status);
        }

        if (agentRes.ok) {
          const config = await agentRes.json();
          if (config?.agentId && config?.vapi) {
            setAgentId(config.agentId);
            const vapi = config.vapi;
            const maxDuration = vapi.maxCallDuration ?? AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS;
            
            setSystemPrompt(prev => ({
              ...prev,
              value: vapi.systemPrompt || '',
              originalValue: vapi.systemPrompt || ''
            }));
            setFirstMessage(prev => ({
              ...prev,
              value: vapi.firstMessage || '',
              originalValue: vapi.firstMessage || ''
            }));
            setMaxSeconds(prev => ({
              ...prev,
              value: maxDuration.toString(),
              originalValue: maxDuration.toString()
            }));
            setVoiceId(prev => ({
              ...prev,
              value: vapi.voice || '',
              originalValue: vapi.voice || ''
            }));
          } else {
            console.warn('[Settings] Agent config incomplete or missing', { hasAgentId: !!config?.agentId, hasVapi: !!config?.vapi });
          }
        } else {
          console.error('[Settings] Failed to fetch agent config:', { status: agentRes.status });
        }
      } catch (error) {
        console.error('[Settings] Failed to load settings:', { error: error instanceof Error ? error.message : String(error) });
        setLoadError(ERROR_MESSAGES.FAILED_TO_LOAD);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadSettings();
    }

    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, [user]);

  async function fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    attempt = 0
  ): Promise<T> {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const delay = RETRY_CONFIG.delays[attempt];
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry<T>(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async function validateVapiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || !apiKey.trim()) {
      return false;
    }
    try {
      const data = await fetchWithRetry<{ success: boolean }>(
        `${API_BASE_URL}/api/integrations/vapi/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey })
        }
      );
      return data.success === true;
    } catch {
      return false;
    }
  }

  async function saveApiKeyField(
    fieldName: string,
    value: string,
    setState: React.Dispatch<React.SetStateAction<FieldState>>,
    validate?: boolean
  ) {
    if (globalSaving) return;
    
    if (!value || !value.trim()) {
      setState(prev => ({ ...prev, error: ERROR_MESSAGES.EMPTY_VALUE }));
      return;
    }

    setState(prev => ({ ...prev, saving: true, error: null, saved: false }));
    setGlobalSaving(true);

    try {
      if (validate && fieldName === 'vapi_api_key') {
        const isValid = await validateVapiKey(value);
        if (!isValid) {
          setState(prev => ({ ...prev, saving: false, error: ERROR_MESSAGES.INVALID_API_KEY }));
          setGlobalSaving(false);
          return;
        }
      }

      const csrfToken = getCsrfToken();
      const data = await fetchWithRetry<{ success: boolean; error?: string }>(
        `${API_BASE_URL}/api/founder-console/settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken })
          },
          body: JSON.stringify({ [fieldName]: value })
        }
      );

      setState(prev => ({ ...prev, saving: false, saved: true, originalValue: value }));
      
      if (fieldName === 'vapi_api_key') setVapiConfigured(!!value);
      if (fieldName === 'twilio_account_sid') setTwilioConfigured(!!value);

      const timeoutId = setTimeout(() => {
        setState(prev => ({ ...prev, saved: false }));
      }, SAVE_SUCCESS_DISPLAY_MS);
      timeoutRefs.current.push(timeoutId);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_SAVE;
      setState(prev => ({ ...prev, saving: false, error: errorMsg }));
    } finally {
      setGlobalSaving(false);
    }
  }

  async function saveAgentField(
    fieldName: string,
    value: string,
    setState: React.Dispatch<React.SetStateAction<FieldState>>
  ) {
    if (globalSaving) return;
    
    if (!agentId) {
      setState(prev => ({ ...prev, error: ERROR_MESSAGES.AGENT_NOT_LOADED }));
      return;
    }

    if (!value) {
      setState(prev => ({ ...prev, error: ERROR_MESSAGES.EMPTY_VALUE }));
      return;
    }

    if (fieldName === 'max_seconds') {
      const seconds = parseInt(value);
      if (isNaN(seconds) || seconds < AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS || seconds > AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS) {
        setState(prev => ({ ...prev, error: ERROR_MESSAGES.INVALID_DURATION }));
        return;
      }
    }

    setState(prev => ({ ...prev, saving: true, error: null, saved: false }));
    setGlobalSaving(true);

    try {
      const payload: Record<string, any> = {};
      if (fieldName === 'system_prompt') payload.systemPrompt = value;
      if (fieldName === 'first_message') payload.firstMessage = value;
      if (fieldName === 'max_seconds') payload.maxDurationSeconds = parseInt(value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS;
      if (fieldName === 'voice') payload.voiceId = value;

      const csrfToken = getCsrfToken();
      const data = await fetchWithRetry<{ success: boolean; agentId?: string; assistantId?: string; error?: string }>(
        `${API_BASE_URL}/api/founder-console/agent/behavior`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken })
          },
          body: JSON.stringify(payload)
        }
      );

      setState(prev => ({ ...prev, saving: false, saved: true, originalValue: value }));

      const timeoutId = setTimeout(() => {
        setState(prev => ({ ...prev, saved: false }));
      }, SAVE_SUCCESS_DISPLAY_MS);
      timeoutRefs.current.push(timeoutId);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_SAVE;
      setState(prev => ({ ...prev, saving: false, error: errorMsg }));
    } finally {
      setGlobalSaving(false);
    }
  }

  const hasChanges = (field: FieldState) => field.value !== field.originalValue;

  const getSaveButtonClasses = (field: FieldState, globalSaving: boolean): string => {
    if (field.saved) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (hasChanges(field) && !globalSaving) return 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90';
    return 'bg-slate-700 text-slate-400 cursor-not-allowed';
  };

  const getSaveButtonText = (field: FieldState, globalSaving: boolean): string => {
    if (field.saving || globalSaving) return 'Saving...';
    if (field.saved) return 'Saved';
    return 'Save';
  };

  const renderSaveButton = (
    field: FieldState,
    onSave: () => void,
    disabled?: boolean
  ) => (
    <button
      onClick={onSave}
      disabled={field.saving || globalSaving || disabled || !hasChanges(field)}
      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${getSaveButtonClasses(field, globalSaving)}`}
    >
      {field.saving || globalSaving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : field.saved ? (
        <Check className="w-4 h-4" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      {getSaveButtonText(field, globalSaving)}
    </button>
  );

  const renderError = (error: string | null) => error && (
    <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
      <AlertCircle className="w-4 h-4" />
      {error}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-slate-400 mb-8">Configure your integrations and agent</p>

        {loadError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {loadError}
          </div>
        )}

        <div className="flex gap-2 mb-8 border-b border-slate-700 pb-4">
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'api-keys'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-5 h-5" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('agent-config')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'agent-config'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-5 h-5" />
            Agent Configuration
          </button>
        </div>

        {activeTab === 'api-keys' && (
          <div className="space-y-6">
            <div className="flex gap-4 mb-6">
              <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                vapiConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {vapiConfigured ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                Vapi {vapiConfigured ? 'Connected' : 'Not Configured'}
              </div>
              <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                twilioConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {twilioConfigured ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                Twilio {twilioConfigured ? 'Connected' : 'Not Configured'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                Vapi API Key (Private)
              </h3>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type={vapiApiKey.visible ? 'text' : 'password'}
                    value={vapiApiKey.value}
                    onChange={(e) => setVapiApiKey(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                    placeholder={vapiConfigured ? maskApiKey('configured') : 'Enter Vapi API Key'}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none pr-12"
                  />
                  <button
                    onClick={() => setVapiApiKey(prev => ({ ...prev, visible: !prev.visible }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {vapiApiKey.visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {renderSaveButton(vapiApiKey, () => saveApiKeyField('vapi_api_key', vapiApiKey.value, setVapiApiKey, true))}
              </div>
              {renderError(vapiApiKey.error)}
              <p className="text-xs text-slate-400 mt-2">Your Vapi private API key. Will be validated before saving.</p>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                Vapi Public Key
              </h3>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type={vapiPublicKey.visible ? 'text' : 'password'}
                    value={vapiPublicKey.value}
                    onChange={(e) => setVapiPublicKey(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                    placeholder="Enter Vapi Public Key"
                    className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none pr-12"
                  />
                  <button
                    onClick={() => setVapiPublicKey(prev => ({ ...prev, visible: !prev.visible }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {vapiPublicKey.visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {renderSaveButton(vapiPublicKey, () => saveApiKeyField('vapi_public_key', vapiPublicKey.value, setVapiPublicKey))}
              </div>
              {renderError(vapiPublicKey.error)}
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-purple-400" />
                Twilio Account SID
              </h3>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type={twilioSid.visible ? 'text' : 'password'}
                    value={twilioSid.value}
                    onChange={(e) => setTwilioSid(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                    placeholder={twilioConfigured ? maskApiKey('configured') : 'Enter Twilio Account SID'}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none pr-12"
                  />
                  <button
                    onClick={() => setTwilioSid(prev => ({ ...prev, visible: !prev.visible }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {twilioSid.visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {renderSaveButton(twilioSid, () => saveApiKeyField('twilio_account_sid', twilioSid.value, setTwilioSid))}
              </div>
              {renderError(twilioSid.error)}
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                Twilio Auth Token
              </h3>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type={twilioToken.visible ? 'text' : 'password'}
                    value={twilioToken.value}
                    onChange={(e) => setTwilioToken(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                    placeholder="Enter Twilio Auth Token"
                    className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none pr-12"
                  />
                  <button
                    onClick={() => setTwilioToken(prev => ({ ...prev, visible: !prev.visible }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {twilioToken.visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {renderSaveButton(twilioToken, () => saveApiKeyField('twilio_auth_token', twilioToken.value, setTwilioToken))}
              </div>
              {renderError(twilioToken.error)}
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-purple-400" />
                Twilio Phone Number (Calling From)
              </h3>
              <div className="flex gap-3">
                <input
                  type="tel"
                  value={twilioPhone.value}
                  onChange={(e) => setTwilioPhone(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                  placeholder="+1234567890"
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
                />
                {renderSaveButton(twilioPhone, () => saveApiKeyField('twilio_from_number', twilioPhone.value, setTwilioPhone))}
              </div>
              {renderError(twilioPhone.error)}
              <p className="text-xs text-slate-400 mt-2">Must be in E.164 format (e.g., +1234567890)</p>
            </div>
          </div>
        )}

        {activeTab === 'agent-config' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                Voice
              </h3>
              <div className="flex gap-3">
                <select
                  value={voiceId.value}
                  onChange={(e) => setVoiceId(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
                >
                  <option value="">Select a voice...</option>
                  {voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.gender}) {voice.isDefault ? '- Default' : ''}
                    </option>
                  ))}
                </select>
                {renderSaveButton(voiceId, () => saveAgentField('voice', voiceId.value, setVoiceId), !vapiConfigured)}
              </div>
              {renderError(voiceId.error)}
              {!vapiConfigured && (
                <p className="text-xs text-amber-400 mt-2">{ERROR_MESSAGES.VAPI_NOT_CONFIGURED}</p>
              )}
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                First Message
              </h3>
              <div className="space-y-3">
                <textarea
                  value={firstMessage.value}
                  onChange={(e) => setFirstMessage(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                  placeholder="Hello! Thank you for calling. How can I help you today?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
                />
                <div className="flex justify-end">
                  {renderSaveButton(firstMessage, () => saveAgentField('first_message', firstMessage.value, setFirstMessage), !vapiConfigured)}
                </div>
              </div>
              {renderError(firstMessage.error)}
              <p className="text-xs text-slate-400 mt-2">What the agent says when answering a call</p>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                System Prompt
              </h3>
              <div className="space-y-3">
                <textarea
                  value={systemPrompt.value}
                  onChange={(e) => setSystemPrompt(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                  placeholder="You are a professional AI receptionist..."
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none font-mono text-sm"
                />
                <div className="flex justify-end">
                  {renderSaveButton(systemPrompt, () => saveAgentField('system_prompt', systemPrompt.value, setSystemPrompt), !vapiConfigured)}
                </div>
              </div>
              {renderError(systemPrompt.error)}
              <p className="text-xs text-slate-400 mt-2">Core instructions for your AI agent. Be specific about your services and policies.</p>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                Max Call Duration (seconds)
              </h3>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={maxSeconds.value}
                  onChange={(e) => setMaxSeconds(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                  placeholder="300"
                  min="60"
                  max="3600"
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
                />
                {renderSaveButton(maxSeconds, () => saveAgentField('max_seconds', maxSeconds.value, setMaxSeconds), !vapiConfigured)}
              </div>
              {renderError(maxSeconds.error)}
              <p className="text-xs text-slate-400 mt-2">Maximum duration for a single call (60-3600 seconds)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
