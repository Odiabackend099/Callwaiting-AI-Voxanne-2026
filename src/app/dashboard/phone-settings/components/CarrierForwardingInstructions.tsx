'use client';

import React, { useState } from 'react';
import { Phone, Copy, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface CarrierForwardingInstructionsProps {
  managedNumber: string;
}

type Carrier = 'att' | 'verizon' | 'tmobile' | 'other';

const carrierData = {
  att: {
    name: 'AT&T',
    activationCode: (number: string) => `*71${number}`,
    deactivationCode: '*73',
    supportUrl: 'https://www.att.com/support/article/wireless/KM1062648/',
  },
  verizon: {
    name: 'Verizon',
    activationCode: (number: string) => `*71${number}`,
    deactivationCode: '*73',
    supportUrl: 'https://www.verizon.com/support/call-forwarding-faqs/',
  },
  tmobile: {
    name: 'T-Mobile',
    activationCode: (number: string) => `**21*${number}#`,
    deactivationCode: '##21#',
    supportUrl: 'https://www.t-mobile.com/support/plans-features/call-forwarding',
  },
  other: {
    name: 'Other Carrier',
    activationCode: (number: string) => `*71${number} or **21*${number}#`,
    deactivationCode: '*73 or ##21#',
    supportUrl: '',
  },
};

export default function CarrierForwardingInstructions({ managedNumber }: CarrierForwardingInstructionsProps) {
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier>('att');
  const [copied, setCopied] = useState(false);
  const [showDeactivation, setShowDeactivation] = useState(false);

  const carrier = carrierData[selectedCarrier];
  const activationCode = carrier.activationCode(managedNumber);
  const deactivationCode = carrier.deactivationCode;

  const handleCopy = async () => {
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
      {/* Carrier Selection */}
      <div>
        <label className="block text-sm font-medium text-obsidian mb-3">
          Select Your Phone Carrier
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.keys(carrierData) as Carrier[]).map((carrierKey) => (
            <button
              key={carrierKey}
              onClick={() => setSelectedCarrier(carrierKey)}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                selectedCarrier === carrierKey
                  ? 'border-surgical-600 bg-surgical-50 text-surgical-600'
                  : 'border-surgical-200 bg-white text-obsidian/60 hover:border-surgical-300'
              }`}
            >
              {carrierData[carrierKey].name}
            </button>
          ))}
        </div>
      </div>

      {/* Activation Instructions */}
      <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-surgical-600" />
          <h3 className="text-lg font-semibold text-obsidian">
            Activate Call Forwarding
          </h3>
        </div>

        {/* Dial Code Box */}
        <div className="bg-white border border-surgical-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-obsidian/60 mb-1">Dial this code on your phone:</p>
              <p className="text-2xl font-mono font-bold text-surgical-600">
                {activationCode}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors flex items-center gap-2 font-medium"
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

        {/* Step-by-step Instructions */}
        <div className="space-y-3">
          <Step
            number={1}
            text="Pick up your office or cell phone (the number you want to forward FROM)"
          />
          <Step
            number={2}
            text={`Dial the code shown above: ${activationCode}`}
          />
          <Step
            number={3}
            text="Wait for a confirmation tone or message from your carrier"
          />
          <Step
            number={4}
            text="Done! All incoming calls now forward to your AI receptionist"
          />
        </div>

        {/* Carrier Support Link */}
        {carrier.supportUrl && (
          <div className="mt-4 pt-4 border-t border-surgical-200">
            <a
              href={carrier.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-surgical-600 hover:text-surgical-700 font-medium flex items-center gap-2"
            >
              View {carrier.name} call forwarding guide
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Deactivation Section (Collapsible) */}
      <div className="border border-surgical-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDeactivation(!showDeactivation)}
          className="w-full px-6 py-4 bg-white hover:bg-surgical-50 transition-colors flex items-center justify-between"
        >
          <span className="text-sm font-medium text-obsidian">
            How to Deactivate Call Forwarding
          </span>
          {showDeactivation ? (
            <ChevronUp className="w-5 h-5 text-obsidian/60" />
          ) : (
            <ChevronDown className="w-5 h-5 text-obsidian/60" />
          )}
        </button>

        {showDeactivation && (
          <div className="px-6 py-4 bg-surgical-50 border-t border-surgical-200">
            <p className="text-sm text-obsidian/60 mb-3">
              To stop forwarding calls to your AI receptionist:
            </p>
            <div className="bg-white border border-surgical-200 rounded-lg p-4 mb-3">
              <p className="text-xs text-obsidian/60 mb-1">Dial this code:</p>
              <p className="text-xl font-mono font-bold text-obsidian">
                {deactivationCode}
              </p>
            </div>
            <p className="text-sm text-obsidian/60">
              Calls will now ring your original phone number normally.
            </p>
          </div>
        )}
      </div>

      {/* Important Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Important:</span> These codes forward calls from your
          personal/office number to your AI number. Your phone number stays with your current
          carrier — no porting required.
        </p>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
        {number}
      </div>
      <p className="text-sm text-obsidian pt-0.5">{text}</p>
    </div>
  );
}
