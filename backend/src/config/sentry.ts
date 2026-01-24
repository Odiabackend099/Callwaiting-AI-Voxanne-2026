/**
 * Sentry Error Monitoring Configuration
 * Tracks errors, performance, and user sessions
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initializeSentry() {
    const dsn = process.env.SENTRY_DSN;
    const environment = process.env.NODE_ENV || 'development';

    if (!dsn) {
        console.warn('⚠️  SENTRY_DSN not configured - error monitoring disabled');
        return;
    }

    Sentry.init({
        dsn,
        environment,
        integrations: [
            nodeProfilingIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        // Profiling
        profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    });

    console.log('✅ Sentry error monitoring initialized');
}

export { Sentry };
