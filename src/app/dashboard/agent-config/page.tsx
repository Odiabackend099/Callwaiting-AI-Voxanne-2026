'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Phone, Mic, Shield, Bot, Save, Check, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { agentAPI, BackendAPIError } from '@/lib/backend-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// ============================================================================
// CONSTANTS
// ============================================================================

const SAVE_SUCCESS_DISPLAY_MS = 3000;
const AGENT_CONFIG_CONSTRAINTS = {
  MIN_DURATION_SECONDS: 60,
  MAX_DURATION_SECONDS: 3600,
  DEFAULT_DURATION_SECONDS: 300
};

const ERROR_MESSAGES = {
  EMPTY_VALUE: 'This field cannot be empty',
  INVALID_DURATION: `Duration must be between ${AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS} and ${AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS} seconds`,
  AGENT_NOT_LOADED: 'Agent configuration not loaded. Please refresh the page.',
  INVALID_API_KEY: 'Invalid API key - connection failed',
  FAILED_TO_SAVE: 'Failed to save. Please try again.',
  FAILED_TO_LOAD: 'Failed to load configuration. Please refresh the page.',
  VAPI_NOT_CONFIGURED: 'Configure Vapi API key in Settings first'
};

interface Voice {
  id: string;
  name: string;
  gender: string;
  provider: string;
  isDefault?: boolean;
}

interface AgentConfig {
  systemPrompt: string;
  firstMessage: string;
  voice: string;
  maxDuration: number;
}

type TabType = 'configuration' | 'testing';

export default function AgentConfigPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('configuration');
  
  // Configuration state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [vapiConfigured, setVapiConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [config, setConfig] = useState<AgentConfig>({
    systemPrompt: '',
    firstMessage: '',
    voice: '',
    maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
  });
  
  const [originalConfig, setOriginalConfig] = useState<AgentConfig>({
    systemPrompt: '',
    firstMessage: '',
    voice: '',
    maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
  });
  
  // Testing state
  const [testing, setTesting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const webTestWsRef = useRef<WebSocket | null>(null);
  const userId = 'test-user-123';

  // Load configuration on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        setLoadError(null);

        const [settingsRes, voicesRes, agentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/founder-console/settings`),
          fetch(`${API_BASE_URL}/api/assistants/voices/available`),
          fetch(`${API_BASE_URL}/api/founder-console/agent/config`)
        ]);

        if (voicesRes.ok) {
          const voicesData = await voicesRes.json();
          setVoices(voicesData);
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setVapiConfigured(data.vapiConfigured);
        }

        if (agentRes.ok) {
          const agentConfig = await agentRes.json();
          if (agentConfig?.agentId && agentConfig?.vapi) {
            setAgentId(agentConfig.agentId);
            const vapi = agentConfig.vapi;
            const maxDuration = vapi.maxCallDuration ?? AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS;
            
            const newConfig: AgentConfig = {
              systemPrompt: vapi.systemPrompt || '',
              firstMessage: vapi.firstMessage || '',
              voice: vapi.voice || '',
              maxDuration
            };
            setConfig(newConfig);
            setOriginalConfig(newConfig);
          }
        }
      } catch (error) {
        console.error('[AgentConfig] Failed to load:', error);
        setLoadError(ERROR_MESSAGES.FAILED_TO_LOAD);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  const hasChanges = () => {
    return config.systemPrompt !== originalConfig.systemPrompt ||
           config.firstMessage !== originalConfig.firstMessage ||
           config.voice !== originalConfig.voice ||
           config.maxDuration !== originalConfig.maxDuration;
  };

  const validateConfig = (): string | null => {
    if (!config.systemPrompt.trim()) return ERROR_MESSAGES.EMPTY_VALUE;
    if (!config.firstMessage.trim()) return ERROR_MESSAGES.EMPTY_VALUE;
    if (!config.voice) return 'Please select a voice';
    if (config.maxDuration < AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS || 
        config.maxDuration > AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS) {
      return ERROR_MESSAGES.INVALID_DURATION;
    }
    return null;
  };

  async function saveConfiguration() {
    const validationError = validateConfig();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        systemPrompt: config.systemPrompt,
        firstMessage: config.firstMessage,
        voiceId: config.voice,
        maxDurationSeconds: config.maxDuration
      };

      const response = await fetch(`${API_BASE_URL}/api/founder-console/agent/behavior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setOriginalConfig(config);
      setSaveSuccess(true);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(false);
      }, SAVE_SUCCESS_DISPLAY_MS);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_SAVE;
      setSaveError(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  async function startWebTest() {
    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const result = await agentAPI.startWebTest(userId);
      
      if (webTestWsRef.current) {
        webTestWsRef.current.close();
      }

      const ws = new WebSocket(result.bridgeWebsocketUrl);
      webTestWsRef.current = ws;
      
      ws.onopen = () => {
        setTestResult('✅ Connected! Start speaking...');
      };

      ws.onerror = () => {
        setTestError('Connection failed');
        setTesting(false);
      };

      ws.onclose = () => {
        setTesting(false);
        webTestWsRef.current = null;
      };

      setTestResult('🎤 Audio capture not yet implemented');
      
    } catch (error) {
      const message = error instanceof BackendAPIError ? error.message : 'Failed to start test';
      setTestError(message);
      setTesting(false);
    }
  }

  async function startPhoneTest() {
    if (!phoneNumber) {
      setTestError('Please enter a phone number');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const result = await agentAPI.startPhoneTest(phoneNumber, userId);
      setTestResult(`✅ ${result.message}`);
      
      setTimeout(() => {
        setTesting(false);
      }, 3000);
    } catch (error) {
      const message = error instanceof BackendAPIError ? error.message : 'Failed to make call';
      setTestError(message);
      setTesting(false);
    }
  }

  useEffect(() => {
    return () => {
      if (webTestWsRef.current) {
        webTestWsRef.current.close();
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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

        <h1 className="text-3xl font-bold mb-2">Agent Configuration</h1>
        <p className="text-slate-400 mb-8">Configure your AI agent personality, voice, and behavior</p>

        {loadError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {loadError}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-slate-700 pb-4">
          <button
            onClick={() => setActiveTab('configuration')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'configuration'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-5 h-5" />
            Configuration
          </button>
          <button
            onClick={() => setActiveTab('testing')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'testing'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-5 h-5" />
            Testing
          </button>
        </div>

        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="space-y-6">
            {saveError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-3">
                <Check className="w-5 h-5 flex-shrink-0" />
                Configuration saved successfully
              </div>
            )}

            {/* Voice Selection */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                Voice
              </h3>
              <select
                value={config.voice}
                onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                disabled={!vapiConfigured}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none disabled:opacity-50"
              >
                <option value="">Select a voice...</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} ({voice.gender}) {voice.isDefault ? '- Default' : ''}
                  </option>
                ))}
              </select>
              {!vapiConfigured && (
                <p className="text-xs text-amber-400 mt-2">{ERROR_MESSAGES.VAPI_NOT_CONFIGURED}</p>
              )}
            </div>

            {/* First Message */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                First Message
              </h3>
              <textarea
                value={config.firstMessage}
                onChange={(e) => setConfig(prev => ({ ...prev, firstMessage: e.target.value }))}
                placeholder="Hello! Thank you for calling. How can I help you today?"
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
              />
              <p className="text-xs text-slate-400 mt-2">What the agent says when answering a call</p>
            </div>

            {/* System Prompt */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                System Prompt
              </h3>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="You are a professional AI receptionist..."
                rows={10}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-2">Core instructions for your AI agent. Be specific about your services and policies.</p>
            </div>

            {/* Max Duration */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                Max Call Duration (seconds)
              </h3>
              <input
                type="number"
                value={config.maxDuration}
                onChange={(e) => setConfig(prev => ({ ...prev, maxDuration: parseInt(e.target.value) || 300 }))}
                min={AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS}
                max={AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
              />
              <p className="text-xs text-slate-400 mt-2">Maximum duration for a single call (60-3600 seconds)</p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfig(originalConfig)}
                disabled={!hasChanges() || saving}
                className="px-6 py-3 rounded-lg bg-slate-700 text-slate-400 hover:text-white disabled:opacity-50 transition-all"
              >
                Discard
              </button>
              <button
                onClick={saveConfiguration}
                disabled={!hasChanges() || saving || !vapiConfigured}
                className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all ${
                  saveSuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : hasChanges() && !saving && vapiConfigured
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Testing Tab */}
        {activeTab === 'testing' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700/50">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Mic className="w-6 h-6 text-emerald-400" />
                Test Your Agent
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="font-bold mb-2">Browser Test</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Test using your microphone
                  </p>
                  <button
                    onClick={startWebTest}
                    disabled={testing}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Mic className="w-5 h-5 inline mr-2" />
                    {testing ? 'Testing...' : 'Start Web Test'}
                  </button>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="font-bold mb-2">Phone Test</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Receive a real call
                  </p>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+44 7424 038250"
                    className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 mb-3 focus:border-emerald-500 outline-none text-white"
                  />
                  <button
                    onClick={startPhoneTest}
                    disabled={testing || !phoneNumber}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Phone className="w-5 h-5 inline mr-2" />
                    {testing ? 'Calling...' : 'Call My Phone'}
                  </button>
                </div>
              </div>

              {testResult && (
                <div className="mt-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  {testResult}
                </div>
              )}
              
              {testError && (
                <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  ❌ {testError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
