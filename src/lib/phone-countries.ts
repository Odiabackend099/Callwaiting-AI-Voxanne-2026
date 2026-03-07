/**
 * Shared country configuration for phone number provisioning.
 *
 * Used by both the BuyNumberModal (phone-settings page) and
 * the onboarding wizard (StepNumberSelection).
 *
 * Backend validates country codes in managed-telephony.ts (line 73):
 *   const validCountries = ['US', 'GB', 'CA', 'AU'];
 */

export interface PhoneCountry {
  code: string;
  name: string;
  flag: string;
  areaCodeFormat: string;
  areaCodeLength: number;
  regulatoryReady: boolean;
  approvalDays: string | null;
  complianceInfo?: string;
}

export const COUNTRIES: readonly PhoneCountry[] = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    areaCodeFormat: '3 digits (e.g., 415, 212)',
    areaCodeLength: 3,
    regulatoryReady: true,
    approvalDays: null,
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    areaCodeFormat: '3-5 digits (e.g., 020, 0161)',
    areaCodeLength: 5,
    regulatoryReady: true,
    approvalDays: null,
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    areaCodeFormat: '3 digits (e.g., 416, 514)',
    areaCodeLength: 3,
    regulatoryReady: false,
    approvalDays: '7-14 days',
    complianceInfo: 'Requires Canadian Business Registry number and CRTC approval',
  },
] as const;
