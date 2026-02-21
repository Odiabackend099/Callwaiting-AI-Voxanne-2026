'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useCookieConsent } from './cookie-consent/useCookieConsent';

/**
 * GoogleAnalyticsLoader Component
 *
 * Conditionally loads Google Analytics ONLY when users consent to analytics cookies
 * Complies with UK PECR which requires explicit consent before loading tracking scripts
 *
 * Features:
 * - Respects user cookie preferences
 * - GDPR-compliant configuration
 * - Anonymized IP addresses
 * - No cross-device tracking
 */
export function GoogleAnalyticsLoader() {
  const { isAnalyticsConsented, hasConsented } = useCookieConsent();

  // Listen for consent changes
  useEffect(() => {
    const handleConsentChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.consent?.analytics) {
        // Analytics consent granted - GA should be loaded or already loaded
        console.log('Analytics consent granted');
      } else {
        // Analytics consent withdrawn - GA won't be loaded
        console.log('Analytics consent withdrawn');
      }
    };

    window.addEventListener('cookieConsentChanged', handleConsentChange);
    return () => {
      window.removeEventListener('cookieConsentChanged', handleConsentChange);
    };
  }, []);

  // Only render if user has consented to analytics
  if (!hasConsented || !isAnalyticsConsented) {
    return null;
  }

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) {
    return null;
  }

  return (
    <>
      {/* Google Analytics Script */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        async
      />

      {/* Google Analytics Configuration */}
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            // GDPR-compliant configuration
            gtag('config', '${measurementId}', {
              'anonymize_ip': true,                    // Anonymize user IP addresses
              'cookie_flags': 'SameSite=None;Secure',  // Secure cookie handling
              'ads_data_redaction': true,               // Redact sensitive ad data
              'allow_google_signals': false,            // Disable cross-device tracking
              'cookie_expires': 15724800,               // 182 days (default)
              'user_id': undefined                      // Do not send user ID
            });
          `,
        }}
      />
    </>
  );
}
