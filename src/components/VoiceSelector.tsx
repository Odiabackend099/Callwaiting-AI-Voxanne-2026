'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Volume2, Info } from 'lucide-react';

interface Voice {
  id: string;
  name: string;
  provider: string;
  gender: string;
  language: string;
  characteristics: string;
  accent: string;
  bestFor: string;
  latency: string;
  quality: string;
  isDefault: boolean;
  requiresApiKey: boolean;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selected: string;
  onSelect: (voiceId: string, provider: string) => void;
  className?: string;
}

/**
 * Professional Voice Selector Component
 *
 * Features:
 * - Simple mode: Basic dropdown (default for non-technical users)
 * - Advanced mode: Search, filter, categorized by provider
 * - Responsive design with light mode styling
 * - Voice metadata display (characteristics, accent, best for)
 * - Clear "API Key Required" badges for premium voices
 * - Mobile-friendly interface
 */
export function VoiceSelector({ voices, selected, onSelect, className = '' }: VoiceSelectorProps) {
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [simpleMode, setSimpleMode] = useState(true);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['vapi']));
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter voices based on criteria
  const filteredVoices = useMemo(() => {
    return voices.filter(v => {
      const matchesSearch = search === '' ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.characteristics.toLowerCase().includes(search.toLowerCase()) ||
        v.accent.toLowerCase().includes(search.toLowerCase());

      const matchesProvider = providerFilter === 'all' || v.provider === providerFilter;
      const matchesGender = genderFilter === 'all' || v.gender === genderFilter;

      return matchesSearch && matchesProvider && matchesGender;
    });
  }, [voices, search, providerFilter, genderFilter]);

  // Group filtered voices by provider
  const groupedVoices = useMemo(() => {
    const groups: Record<string, Voice[]> = {};
    filteredVoices.forEach(v => {
      if (!groups[v.provider]) groups[v.provider] = [];
      groups[v.provider].push(v);
    });
    return groups;
  }, [filteredVoices]);

  // Get unique providers for filter
  const providers = useMemo(() => {
    const unique = new Set(voices.map(v => v.provider));
    return Array.from(unique).sort();
  }, [voices]);

  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Voice Persona
        </label>
        <button
          onClick={() => setSimpleMode(!simpleMode)}
          className="text-xs text-blue-600 hover:underline transition-colors"
        >
          {simpleMode ? 'Show Advanced' : 'Show Simple'}
        </button>
      </div>

      {/* Simple Mode: Dropdown */}
      {simpleMode ? (
        <select
          value={selected}
          onChange={(e) => {
            const voice = voices.find(v => v.id === e.target.value);
            if (voice) onSelect(voice.id, voice.provider);
          }}
          className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        >
          <option value="">Select a voice...</option>
          {voices.map(v => (
            <option key={`${v.provider}-${v.id}`} value={v.id}>
              {v.name} ({v.gender}) - {v.provider}
            </option>
          ))}
        </select>
      ) : (
        /* Advanced Mode: Search & Filters */
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices by name, characteristics, or accent..."
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            >
              <option value="all">All Providers</option>
              {providers.map(p => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          {/* Grouped Voice List */}
          <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-300 rounded-lg p-2 bg-gray-50">
            {Object.entries(groupedVoices).length > 0 ? (
              Object.entries(groupedVoices).map(([provider, providerVoices]) => (
                <div key={provider} className="border-b border-gray-200 last:border-0">
                  {/* Provider Collapsible Header */}
                  <button
                    onClick={() => toggleProvider(provider)}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-200 rounded-lg transition-colors text-left"
                  >
                    <span className="font-medium text-gray-900 capitalize">
                      {provider} ({providerVoices.length})
                    </span>
                    {expandedProviders.has(provider) ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  {/* Voice Cards */}
                  {expandedProviders.has(provider) && (
                    <div className="space-y-1 pl-2 pr-2 pb-2">
                      {providerVoices.map(v => (
                        <button
                          key={`${v.provider}-${v.id}`}
                          onClick={() => onSelect(v.id, v.provider)}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                            selected === v.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Volume2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected === v.id ? 'text-blue-600' : 'text-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              {/* Voice Name with Badges */}
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-gray-900 truncate">
                                  {v.name}
                                </span>
                                {v.isDefault && (
                                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full whitespace-nowrap">
                                    Default
                                  </span>
                                )}
                                {v.requiresApiKey && (
                                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full whitespace-nowrap">
                                    API Key
                                  </span>
                                )}
                              </div>

                              {/* Characteristics */}
                              <div className="text-xs text-gray-600">
                                {v.characteristics}
                                {v.accent && ` • ${v.accent}`}
                              </div>

                              {/* Best For */}
                              <div className="text-xs text-gray-500 mt-1">
                                {v.bestFor && `Best for: ${v.bestFor}`}
                              </div>

                              {/* Latency & Quality */}
                              <div className="text-xs text-gray-500 mt-1">
                                Latency: {v.latency} • Quality: {v.quality}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              /* Empty State */
              <div className="text-center py-8">
                <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">
                  No voices found matching your filters
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-gray-500">
        {filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''} available
        {search && ` (filtered from ${voices.length} total)`}
      </p>
    </div>
  );
}
