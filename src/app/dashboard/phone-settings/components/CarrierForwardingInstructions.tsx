'use client';

import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Shield, Zap, Clock } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SavedForwardingConfig {
  forwardingType: 'total_ai' | 'safety_net';
  carrier: string;
  status: string;
  ringTimeSeconds: number;
  activationCode: string;
  deactivationCode: string;
}

interface CarrierForwardingInstructionsProps {
  managedNumber: string;
  savedConfig?: SavedForwardingConfig | null;
}

type CountryCode = 'US' | 'GB' | 'CA' | 'TR' | 'NG';
type ForwardingMode = 'total_ai' | 'safety_net';

interface CarrierCodes {
  total_ai: {
    activationCode: (number: string) => string;
    deactivationCode: string;
  };
  safety_net: {
    activationCode: (number: string, ringTime: number) => string;
    deactivationCode: string;
  };
}

interface CarrierInfo {
  id: string;
  name: string;
  codes: CarrierCodes;
}

interface CountryInfo {
  name: string;
  flag: string;
  carriers: CarrierInfo[];
  supportUrl: string;
}

// ─── Forwarding Code Templates ───────────────────────────────────────────────
//
// Standard GSM (3GPP TS 22.030): **21* unconditional, **004* all-conditional
// AT&T single-star variant: *21* unconditional, *004* all-conditional
// Verizon CDMA: *72 unconditional, *71 conditional

const GSM_STANDARD: CarrierCodes = {
  total_ai: {
    activationCode: (n: string) => `**21*${n}#`,
    deactivationCode: '##21#',
  },
  safety_net: {
    activationCode: (n: string, r: number) => `**004*${n}*11*${r}#`,
    deactivationCode: '##004#',
  },
};

const ATT_CODES: CarrierCodes = {
  total_ai: {
    activationCode: (n: string) => `*21*${n}#`,
    deactivationCode: '#21#',
  },
  safety_net: {
    activationCode: (n: string, r: number) => `*004*${n}*11*${r}#`,
    deactivationCode: '##004#',
  },
};

const VERIZON_CODES: CarrierCodes = {
  total_ai: {
    activationCode: (n: string) => `*72${n}`,
    deactivationCode: '*73',
  },
  safety_net: {
    activationCode: (n: string) => `*71${n}`,
    deactivationCode: '*73',
  },
};

// ─── Country + Carrier Data ──────────────────────────────────────────────────

const countryData: Record<CountryCode, CountryInfo> = {
  US: {
    name: 'United States',
    flag: '\u{1F1FA}\u{1F1F8}',
    supportUrl: '',
    carriers: [
      { id: 'att', name: 'AT&T', codes: ATT_CODES },
      { id: 'verizon', name: 'Verizon', codes: VERIZON_CODES },
      { id: 'tmobile', name: 'T-Mobile', codes: GSM_STANDARD },
    ],
  },
  GB: {
    name: 'United Kingdom',
    flag: '\u{1F1EC}\u{1F1E7}',
    supportUrl: '',
    carriers: [
      { id: 'ee', name: 'EE', codes: GSM_STANDARD },
      { id: 'vodafone_uk', name: 'Vodafone', codes: GSM_STANDARD },
      { id: 'three', name: 'Three', codes: GSM_STANDARD },
      { id: 'o2', name: 'O2', codes: GSM_STANDARD },
    ],
  },
  CA: {
    name: 'Canada',
    flag: '\u{1F1E8}\u{1F1E6}',
    supportUrl: '',
    carriers: [
      { id: 'bell', name: 'Bell', codes: GSM_STANDARD },
      { id: 'rogers', name: 'Rogers', codes: GSM_STANDARD },
      { id: 'telus', name: 'Telus', codes: GSM_STANDARD },
    ],
  },
  TR: {
    name: 'Turkey',
    flag: '\u{1F1F9}\u{1F1F7}',
    supportUrl: '',
    carriers: [
      { id: 'turkcell', name: 'Turkcell', codes: GSM_STANDARD },
      { id: 'vodafone_tr', name: 'Vodafone TR', codes: GSM_STANDARD },
      { id: 'turk_telekom', name: 'Turk Telekom', codes: GSM_STANDARD },
    ],
  },
  NG: {
    name: 'Nigeria',
    flag: '\u{1F1F3}\u{1F1EC}',
    supportUrl: '',
    carriers: [
      { id: 'mtn', name: 'MTN', codes: GSM_STANDARD },
      { id: 'glo', name: 'Glo', codes: GSM_STANDARD },
      { id: 'airtel_ng', name: 'Airtel', codes: GSM_STANDARD },
      { id: '9mobile', name: '9mobile', codes: GSM_STANDARD },
    ],
  },
};

const COUNTRIES: CountryCode[] = ['US', 'GB', 'CA', 'TR', 'NG'];
const DEFAULT_RING_TIME = 25;

// ─── Component ───────────────────────────────────────────────────────────────

export default function CarrierForwardingInstructions({ managedNumber, savedConfig }: CarrierForwardingInstructionsProps) {
  // Initialize from saved config if available
  const initialMode: ForwardingMode = savedConfig?.forwardingType || 'total_ai';

  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [forwardingMode, setForwardingMode] = useState<ForwardingMode>(initialMode);
  const [copied, setCopied] = useState(false);
  const [showDeactivation, setShowDeactivation] = useState(false);

  // Derived state
  const country = selectedCountry ? countryData[selectedCountry] : null;
  const carrier = country?.carriers.find((c) => c.id === selectedCarrierId) ?? null;

  // Generate codes when carrier + mode are selected
  const activationCode = carrier
    ? forwardingMode === 'safety_net'
      ? carrier.codes.safety_net.activationCode(managedNumber, DEFAULT_RING_TIME)
      : carrier.codes.total_ai.activationCode(managedNumber)
    : null;
  const deactivationCode = carrier
    ? carrier.codes[forwardingMode].deactivationCode
    : null;

  const handleCountrySelect = (code: CountryCode) => {
    setSelectedCountry(code);
    setSelectedCarrierId(null); // reset carrier when country changes
    setCopied(false);
  };

  const handleCarrierSelect = (id: string) => {
    setSelectedCarrierId(id);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Step 1: Select Country ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            1
          </div>
          <label className="text-sm font-semibold text-obsidian">
            Select Your Country
          </label>
        </div>
        <p className="text-xs text-obsidian/60 mb-3 ml-8">
          Choose the country of the phone number you want to forward calls from.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 ml-8">
          {COUNTRIES.map((code) => {
            const c = countryData[code];
            return (
              <button
                key={code}
                onClick={() => handleCountrySelect(code)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  selectedCountry === code
                    ? 'border-surgical-600 bg-surgical-50 ring-1 ring-surgical-600'
                    : 'border-surgical-200 bg-white hover:border-surgical-300'
                }`}
              >
                <span className="text-xl leading-none">{c.flag}</span>
                <span className={`text-sm font-medium truncate ${
                  selectedCountry === code ? 'text-surgical-700' : 'text-obsidian/70'
                }`}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step 2: Select Carrier (appears after country) ─────────────────── */}
      {country && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              2
            </div>
            <label className="text-sm font-semibold text-obsidian">
              Select Your Carrier
            </label>
          </div>
          <p className="text-xs text-obsidian/60 mb-3 ml-8">
            Choose your mobile carrier in {country.name}.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 ml-8">
            {country.carriers.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCarrierSelect(c.id)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  selectedCarrierId === c.id
                    ? 'border-surgical-600 bg-surgical-50 text-surgical-700 ring-1 ring-surgical-600'
                    : 'border-surgical-200 bg-white text-obsidian/70 hover:border-surgical-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Forwarding Mode (appears after carrier) ────────────────── */}
      {carrier && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              3
            </div>
            <label className="text-sm font-semibold text-obsidian">
              Choose Forwarding Mode
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-8">
            {/* Full AI Managed */}
            <button
              onClick={() => setForwardingMode('total_ai')}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                forwardingMode === 'total_ai'
                  ? 'border-surgical-600 bg-surgical-50 ring-1 ring-surgical-600'
                  : 'border-surgical-200 bg-white hover:border-surgical-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  forwardingMode === 'total_ai' ? 'bg-surgical-600 text-white' : 'bg-surgical-100 text-surgical-500'
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    forwardingMode === 'total_ai' ? 'text-surgical-700' : 'text-obsidian'
                  }`}>
                    Full AI Managed
                  </p>
                  <p className="text-xs text-obsidian/60 mt-1">
                    AI answers ALL incoming calls immediately
                  </p>
                </div>
              </div>
              {forwardingMode === 'total_ai' && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-surgical-600" />
                </div>
              )}
            </button>

            {/* Safety Net */}
            <button
              onClick={() => setForwardingMode('safety_net')}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                forwardingMode === 'safety_net'
                  ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500'
                  : 'border-surgical-200 bg-white hover:border-surgical-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  forwardingMode === 'safety_net' ? 'bg-amber-500 text-white' : 'bg-surgical-100 text-surgical-500'
                }`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    forwardingMode === 'safety_net' ? 'text-amber-700' : 'text-obsidian'
                  }`}>
                    Safety Net
                  </p>
                  <p className="text-xs text-obsidian/60 mt-1">
                    AI answers only when you&apos;re busy or don&apos;t pick up
                  </p>
                </div>
              </div>
              {forwardingMode === 'safety_net' && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-amber-500" />
                </div>
              )}
            </button>
          </div>

          {/* Ring time info for safety_net */}
          {forwardingMode === 'safety_net' && (
            <div className="mt-3 ml-8 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Your phone will ring for <strong>{DEFAULT_RING_TIME} seconds</strong> before forwarding to AI.
                This gives you time to answer first.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Activation Instructions (appears after mode selected) ──── */}
      {activationCode && deactivationCode && carrier && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                4
              </div>
              <h3 className="text-lg font-semibold text-obsidian">
                Activate Call Forwarding
              </h3>
            </div>

            {/* Dial Code Box */}
            <div className="bg-white border border-surgical-200 rounded-lg p-4 mb-4 ml-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-obsidian/60 mb-1">
                    Dial this code on your {country?.name} phone ({carrier.name}):
                  </p>
                  <p className="text-2xl font-mono font-bold text-surgical-600 break-all">
                    {activationCode}
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors flex items-center gap-2 font-medium flex-shrink-0 ml-4"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="space-y-3 ml-8">
              <InstructionStep
                number={1}
                text={`Pick up your ${carrier.name} phone (the number you want to forward FROM)`}
              />
              <InstructionStep
                number={2}
                text={`Open your phone dialer and dial: ${activationCode}`}
              />
              <InstructionStep
                number={3}
                text="Press the call button and wait for a confirmation tone or message"
              />
              <InstructionStep
                number={4}
                text={forwardingMode === 'total_ai'
                  ? 'Done! All incoming calls now forward to your AI receptionist'
                  : `Done! Calls you don't answer within ${DEFAULT_RING_TIME}s will forward to your AI receptionist`
                }
              />
            </div>
          </div>

          {/* Important Note */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Important:</span> These codes forward calls from your
              personal/office number to your AI number. Your phone number stays with your current
              carrier — no porting required.
            </p>
          </div>
        </div>
      )}

      {/* ── Deactivation Reference (always visible) ──────────────────────── */}
      <div className="border border-surgical-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDeactivation(!showDeactivation)}
          className="w-full px-6 py-4 bg-white hover:bg-surgical-50 transition-colors flex items-center justify-between"
        >
          <span className="text-sm font-semibold text-obsidian">
            How to Deactivate Call Forwarding
          </span>
          {showDeactivation ? (
            <ChevronUp className="w-5 h-5 text-obsidian/60" />
          ) : (
            <ChevronDown className="w-5 h-5 text-obsidian/60" />
          )}
        </button>

        {showDeactivation && (
          <div className="border-t border-surgical-200 bg-surgical-50/50">
            <p className="px-6 pt-4 pb-2 text-xs text-obsidian/60">
              Dial the code for your carrier on your phone to stop forwarding calls to AI.
            </p>

            {COUNTRIES.map((code) => {
              const c = countryData[code];
              return (
                <div key={code} className="px-6 py-3 border-t border-surgical-100 first:border-t-0">
                  <p className="text-xs font-semibold text-obsidian/80 mb-2">
                    {c.flag} {c.name}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-obsidian/50">
                          <th className="text-left font-medium pr-4 pb-1">Carrier</th>
                          <th className="text-left font-medium pr-4 pb-1">Full AI</th>
                          <th className="text-left font-medium pb-1">Safety Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.carriers.map((carr) => (
                          <tr key={carr.id}>
                            <td className="pr-4 py-1 text-obsidian/70">{carr.name}</td>
                            <td className="pr-4 py-1 font-mono font-semibold text-obsidian">
                              {carr.codes.total_ai.deactivationCode}
                            </td>
                            <td className="py-1 font-mono font-semibold text-obsidian">
                              {carr.codes.safety_net.deactivationCode}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            <div className="px-6 py-3 border-t border-surgical-100">
              <p className="text-xs text-obsidian/50">
                After dialing, calls will ring your original phone number normally.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InstructionStep({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-surgical-600/20 text-surgical-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
        {number}
      </div>
      <p className="text-sm text-obsidian pt-0.5">{text}</p>
    </div>
  );
}
