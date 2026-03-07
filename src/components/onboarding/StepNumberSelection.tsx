'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneOutgoing, Search, Loader2, MapPin } from 'lucide-react';
import { useOnboardingStore, CallDirection } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { useNumberSearch } from '@/hooks/useNumberSearch';
import { COUNTRIES } from '@/lib/phone-countries';

const DIRECTION_OPTIONS: {
  value: CallDirection;
  label: string;
  desc: string;
  icon: typeof Phone;
}[] = [
  {
    value: 'inbound',
    label: 'Inbound Receptionist',
    desc: 'Answer calls from patients & clients',
    icon: Phone,
  },
  {
    value: 'outbound',
    label: 'Outbound Sales',
    desc: 'Make calls to leads & follow-ups',
    icon: PhoneOutgoing,
  },
];

export default function StepNumberSelection() {
  const {
    callDirection,
    country,
    numberType,
    areaCode,
    selectedNumber,
    setCallDirection,
    setCountry,
    setNumberType,
    setAreaCode,
    setSelectedNumber,
    nextStep,
  } = useOnboardingStore();

  const { track } = useOnboardingTelemetry();
  const { availableNumbers, loading, error, searchNumbers, resetSearch } = useNumberSearch();

  // Reset search when key params change
  useEffect(() => {
    resetSearch();
    setSelectedNumber(null);
  }, [country, numberType, resetSearch, setSelectedNumber]);

  const handleDirectionChosen = (dir: CallDirection) => {
    setCallDirection(dir);
    resetSearch();
    setSelectedNumber(null);
    track('direction_chosen', 0, { direction: dir });
  };

  const handleSearch = async () => {
    const results = await searchNumbers({ country, numberType, areaCode });
    track('number_searched', 0, { country, numberType, areaCode, resultCount: results.length });
  };

  const handleSelectNumber = (phoneNumber: string) => {
    setSelectedNumber(phoneNumber);
    track('number_selected', 0, { phoneNumber: phoneNumber.slice(-4) });
    nextStep();
  };

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const areaCodeRequired = selectedCountry && selectedCountry.areaCodeLength > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
          Choose your AI phone number
        </h1>
        <p className="text-lg text-obsidian/60">
          Pick a direction & search for the perfect number.
        </p>
      </div>

      {/* Direction chooser */}
      <div className="grid grid-cols-2 gap-3">
        {DIRECTION_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
          <button
            key={value}
            onClick={() => handleDirectionChosen(value)}
            className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ease-in-out ${
              callDirection === value
                ? 'border-surgical-600 bg-surgical-50'
                : 'border-surgical-200 bg-white hover:border-surgical-300'
            }`}
          >
            <Icon
              className={`w-6 h-6 mb-2 ${
                callDirection === value ? 'text-surgical-600' : 'text-obsidian/40'
              }`}
            />
            <p
              className={`text-sm font-semibold ${
                callDirection === value ? 'text-surgical-700' : 'text-obsidian'
              }`}
            >
              {label}
            </p>
            <p className="text-xs text-obsidian/50 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* Number search panel — only visible after direction chosen */}
      {callDirection && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="space-y-4 overflow-hidden"
        >
          {/* Country + Number type row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-obsidian/70 mb-1.5">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2.5 border border-surgical-200 rounded-lg text-obsidian bg-white focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent text-sm"
              >
                {COUNTRIES.filter((c) => c.regulatoryReady).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-obsidian/70 mb-1.5">
                Number Type
              </label>
              <div className="flex gap-2">
                {(['local', 'toll_free'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNumberType(type)}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                      numberType === type
                        ? 'bg-surgical-600 text-white border-surgical-600'
                        : 'bg-white text-obsidian/70 border-surgical-200 hover:border-surgical-400'
                    }`}
                  >
                    {type === 'local' ? 'Local' : 'Toll-Free'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Area code */}
          {numberType === 'local' && areaCodeRequired && (
            <div>
              <label className="block text-sm font-medium text-obsidian/70 mb-1.5">
                Area Code <span className="text-obsidian/40">(optional)</span>
              </label>
              <input
                type="text"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                placeholder={selectedCountry?.areaCodeFormat ?? '3 digits'}
                className="w-full px-3 py-2.5 border border-surgical-200 rounded-lg text-obsidian placeholder:text-obsidian/30 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent text-sm"
              />
            </div>
          )}

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? 'Searching...' : 'Search Available Numbers'}
          </button>

          {/* Error */}
          {error && (
            <p className="text-sm text-obsidian/70 bg-surgical-50 border border-surgical-200 rounded-lg px-4 py-2">
              {error.message}
            </p>
          )}

          {/* Results grid */}
          {availableNumbers.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {availableNumbers.map((num) => (
                <button
                  key={num.phoneNumber}
                  onClick={() => handleSelectNumber(num.phoneNumber)}
                  className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all duration-200 ${
                    selectedNumber === num.phoneNumber
                      ? 'border-surgical-600 bg-surgical-50'
                      : 'border-surgical-200 bg-white hover:border-surgical-400 hover:bg-surgical-50/50'
                  }`}
                >
                  <span className="font-mono text-obsidian font-medium">{num.phoneNumber}</span>
                  {num.locality && (
                    <span className="flex items-center gap-1 text-xs text-obsidian/50">
                      <MapPin className="w-3 h-3" />
                      {num.locality}
                      {num.region ? `, ${num.region}` : ''}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
