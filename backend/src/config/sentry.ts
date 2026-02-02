/**
 * Sentry Error Monitoring Configuration
 * Tracks errors, performance, and user sessions
 */

import * as Sentry from '@sentry/node';

// Try to import profiling, but don't fail if not available
let nodeProfilingIntegration: any;
try {
    const profilingModule = require('@sentry/profiling-node');
    nodeProfilingIntegration = profilingModule.nodeProfilingIntegration;
} catch (err) {
    console.warn('⚠️  Sentry profiling not available (native module missing) - profiling disabled');
}

export function initializeSentry() {
    const dsn = process.env.SENTRY_DSN;
    const environment = process.env.NODE_ENV || 'development';

    if (!dsn) {
        console.warn('⚠️  SENTRY_DSN not configured - error monitoring disabled');
        return;
    }

    const integrations = [];
    if (nodeProfilingIntegration) {
        integrations.push(nodeProfilingIntegration());
    }

    Sentry.init({
        dsn,
        environment,
        integrations,
        // Performance Monitoring
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        // Profiling (only if profiling integration is available)
        profilesSampleRate: nodeProfilingIntegration && environment === 'production' ? 0.1 : 1.0,
        beforeSend(event, hint) {
            // Add custom context
            event.contexts = {
                ...event.contexts,
                app: {
                    version: process.env.npm_package_version || '1.0.0',
                    deployment: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
                    node_env: process.env.NODE_ENV
                }
            };

            // Redact PII
            if (event.request) {
                delete event.request.cookies;
                delete event.request.headers?.Authorization;
            }

            return event;
        },
        ignoreErrors: [
            'AbortError',
            'NetworkError',
            'Non-Error promise rejection captured',
            'ResizeObserver loop limit exceeded',
            'CORS not allowed'
        ]
    });

    console.log('✅ Sentry error monitoring initialized');
}

export function reportError(
    error: Error,
    context: { orgId?: string; userId?: string; [key: string]: any }
): void {
    if (process.env.NODE_ENV !== 'production' || !process.env.SENTRY_DSN) {
        return;
    }

    Sentry.withScope((scope) => {
        if (context.userId || context.orgId) {
            scope.setUser({ id: context.userId, org_id: context.orgId });
        }
        scope.setContext('custom', context);
        scope.setLevel('error');
        Sentry.captureException(error);
    });
}

export { Sentry };
