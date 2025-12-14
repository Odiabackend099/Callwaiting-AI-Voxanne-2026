'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Phone, Mic, Shield } from 'lucide-react';
import { agentAPI, BackendAPIError } from '@/lib/backend-api';

export default function AgentConfigPage() {
  const [testing, setTesting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  
  const webTestWsRef = useRef<WebSocket | null>(null);
  const userId = 'test-user-123';

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
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Agent Configuration</h1>
        <p className="text-slate-400 mb-8">Test and configure Voxanne</p>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700/50 mb-6">
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

        <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl p-8 border border-emerald-500/20">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            Safe Mode™ Active
          </h2>
          <p className="text-slate-300">
            All medical advice attempts are blocked. Emergency keywords trigger immediate escalation.
          </p>
        </div>
      </div>
    </div>
  );
}
