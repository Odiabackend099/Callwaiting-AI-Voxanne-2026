// Cookie Consent Configuration
// Defines all cookie categories, their descriptions, and purposes

export type CookieCategory = 'essential' | 'analytics' | 'functional' | 'marketing';

export interface CookieCategoryConfig {
  name: string;
  description: string;
  required: boolean;
  defaultConsent: boolean;
  cookies: {
    name: string;
    purpose: string;
    retention?: string;
  }[];
}

export const COOKIE_CATEGORIES: Record<CookieCategory, CookieCategoryConfig> = {
  essential: {
    name: 'Essential Cookies',
    description: 'Required for the website to function properly. Enable security, user authentication, and session management.',
    required: true,
    defaultConsent: true,
    cookies: [
      {
        name: 'auth_token',
        purpose: 'User authentication and session management',
        retention: 'Until logout',
      },
      {
        name: 'csrf_token',
        purpose: 'Protection against cross-site request forgery attacks',
        retention: 'Session',
      },
      {
        name: 'session_id',
        purpose: 'Maintain your session as you navigate',
        retention: 'Session',
      },
      {
        name: 'user_preferences',
        purpose: 'Remember your language and display preferences',
        retention: '1 year',
      },
    ],
  },

  analytics: {
    name: 'Analytics Cookies',
    description: 'Help us understand how you use Voxanne AI so we can improve our website and services.',
    required: false,
    defaultConsent: false,
    cookies: [
      {
        name: '_ga',
        purpose: 'Google Analytics - track website usage and user behavior',
        retention: '2 years',
      },
      {
        name: '_ga_*',
        purpose: 'Google Analytics - session and conversion tracking',
        retention: '2 years',
      },
      {
        name: 'ga_session_id',
        purpose: 'Google Analytics - session identification',
        retention: 'Session',
      },
    ],
  },

  functional: {
    name: 'Functional Cookies',
    description: 'Enable enhanced functionality and personalization features based on your preferences.',
    required: false,
    defaultConsent: false,
    cookies: [
      {
        name: 'theme_preference',
        purpose: 'Remember your theme choice (light/dark mode)',
        retention: '1 year',
      },
      {
        name: 'language_preference',
        purpose: 'Remember your language preference',
        retention: '1 year',
      },
      {
        name: 'sidebar_state',
        purpose: 'Remember if dashboard sidebar is expanded or collapsed',
        retention: 'Session',
      },
    ],
  },

  marketing: {
    name: 'Marketing Cookies',
    description: 'Used to track your interest in our services and deliver targeted marketing campaigns.',
    required: false,
    defaultConsent: false,
    cookies: [
      {
        name: 'marketing_id',
        purpose: 'Track marketing campaign effectiveness',
        retention: '1 year',
      },
      {
        name: 'utm_source',
        purpose: 'Track traffic source for conversion analysis',
        retention: '1 year',
      },
    ],
  },
};

export interface CookieConsentState {
  version: number;
  timestamp: string;
  expiry: string;
  consent: {
    essential: boolean;
    analytics: boolean;
    functional: boolean;
    marketing: boolean;
  };
}

// Default consent state - essential only
export const DEFAULT_CONSENT_STATE: CookieConsentState = {
  version: 1,
  timestamp: new Date().toISOString(),
  expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
  consent: {
    essential: true,
    analytics: false,
    functional: false,
    marketing: false,
  },
};

// LocalStorage key for cookie consent
export const COOKIE_CONSENT_STORAGE_KEY = 'cookie_consent_v1';

// Consent expiry duration (1 year in milliseconds)
export const CONSENT_EXPIRY_DURATION = 365 * 24 * 60 * 60 * 1000;
