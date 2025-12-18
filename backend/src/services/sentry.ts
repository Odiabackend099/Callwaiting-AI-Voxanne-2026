/**
 * Sentry Error Tracking Integration
 * Captures and reports errors to Sentry for production monitoring
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

/**
 * Initialize Sentry for error tracking
 */
export function initSentry(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!sentryDsn) {
    console.warn('[Sentry] SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
    beforeSend(event, hint) {
      // Filter out health check errors
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },
  });

  console.log(`[Sentry] Initialized for ${environment}`);
}

/**
 * Express middleware for Sentry request tracking
 */
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/**
 * Express middleware for Sentry error handling
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (context) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture message with level
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email: email || undefined,
  });
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for error tracking context
 */
export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  });
}
