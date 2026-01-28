/**
 * Global Exception Handlers
 * Catches uncaught exceptions and unhandled promise rejections
 * Reports to Sentry and attempts graceful shutdown
 */

import * as Sentry from '@sentry/node';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';

export function setupExceptionHandlers(): void {
  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    log.error('Process', 'Uncaught Exception', { error: error.message, stack: error.stack });
    
    Sentry.captureException(error, { level: 'fatal' });
    sendSlackAlert(' CRITICAL: Uncaught Exception', {
      error: error.message,
      stack: error.stack
    }).catch(() => {});
    
    // Graceful shutdown after 2s
    setTimeout(() => process.exit(1), 2000);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: {} | null | undefined, promise: Promise<any>) => {
    log.error('Process', 'Unhandled Rejection', { reason: String(reason) });
    
    Sentry.captureMessage(`Unhandled Rejection: ${reason}`, { level: 'fatal' });
    sendSlackAlert(' CRITICAL: Unhandled Rejection', {
      reason: String(reason)
    }).catch(() => {});
  });

  // SIGTERM handling
  process.on('SIGTERM', () => {
    log.info('Process', 'SIGTERM received - starting graceful shutdown');
    
    // Flush Sentry
    Sentry.close(2000)
      .then(() => log.info('Sentry', 'Events flushed'))
      .finally(() => process.exit(0));
  });
}
