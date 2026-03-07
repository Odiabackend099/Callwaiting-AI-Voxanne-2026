'use client';

import { useState, useCallback } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

export interface AvailableNumber {
  phoneNumber: string;
  locality?: string;
  region?: string;
}

export interface NumberSearchError {
  message: string;
  canRetry: boolean;
  failedStep: string;
}

/**
 * Shared hook for searching Twilio available numbers.
 * Used by BuyNumberModal and StepNumberSelection.
 */
export function useNumberSearch() {
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NumberSearchError | null>(null);

  const searchNumbers = useCallback(async (params: {
    country: string;
    numberType: string;
    areaCode?: string;
  }) => {
    setLoading(true);
    setError(null);
    setAvailableNumbers([]);

    try {
      const searchParams = new URLSearchParams({
        country: params.country,
        numberType: params.numberType,
      });
      if (params.areaCode) searchParams.set('areaCode', params.areaCode);

      const data = await authedBackendFetch<{ numbers: AvailableNumber[] }>(
        `/api/managed-telephony/available-numbers?${searchParams.toString()}`
      );

      setAvailableNumbers(data.numbers || []);

      if (!data.numbers?.length) {
        setError({
          message: 'No numbers found. Try a different area code or number type.',
          canRetry: true,
          failedStep: 'search',
        });
      }

      return data.numbers || [];
    } catch (err: any) {
      const searchError: NumberSearchError = {
        message: err.message || 'Failed to search numbers',
        canRetry: true,
        failedStep: 'search',
      };
      setError(searchError);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const resetSearch = useCallback(() => {
    setAvailableNumbers([]);
    setError(null);
  }, []);

  return {
    availableNumbers,
    loading,
    error,
    searchNumbers,
    resetSearch,
  };
}
