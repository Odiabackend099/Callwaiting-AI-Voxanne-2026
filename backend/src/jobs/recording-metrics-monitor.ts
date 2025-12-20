/**
 * Recording Metrics Monitor Job
 * Periodically checks recording upload success rate and generates alerts if below threshold
 * Runs every 5 minutes
 */

import { createLogger } from '../services/logger';
import {
  getSuccessRate,
  checkSuccessRateAlert,
  getMetricsByCallType
} from '../services/recording-metrics';

const logger = createLogger('RecordingMetricsMonitor');

// Configuration
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SUCCESS_RATE_THRESHOLD_PERCENT = 95; // Alert if below 95%

/**
 * Monitor recording upload metrics
 */
export async function monitorRecordingMetrics(): Promise<void> {
  try {
    logger.info('Starting metrics check');

    // Check current success rate (last 1 hour)
    const successRateData = await getSuccessRate(1);

    if (!successRateData || successRateData.total_uploads === 0) {
      logger.info('No recording metrics to monitor yet');
      return;
    }

    logger.info('Current metrics', {
      totalUploads: successRateData.total_uploads,
      successfulUploads: successRateData.successful_uploads,
      failedUploads: successRateData.failed_uploads,
      successRatePercent: successRateData.success_rate_percent,
      averageDurationMs: successRateData.average_duration_ms,
      timePeriod: successRateData.time_period
    });

    // Check if alert threshold exceeded
    const alertResult = await checkSuccessRateAlert(SUCCESS_RATE_THRESHOLD_PERCENT);

    if (alertResult?.alert) {
      logger.warn('SUCCESS RATE ALERT', {
        successRate: alertResult.successRate,
        threshold: SUCCESS_RATE_THRESHOLD_PERCENT,
        message: alertResult.message
      });

      // TODO: Send alert to monitoring service (Datadog, PagerDuty, etc.)
      // await notificationService.sendAlert({
      //   severity: 'warning',
      //   title: 'Recording Upload Success Rate Low',
      //   message: alertResult.message,
      //   source: 'recording-metrics-monitor'
      // });
    } else if (alertResult) {
      logger.info('Success rate is healthy', {
        successRate: alertResult.successRate,
        message: alertResult.message
      });
    }

    // Get detailed metrics by call type
    const metricsByType = await getMetricsByCallType(1);

    if (metricsByType) {
      logger.info('Metrics by call type', {
        inbound: {
          total: metricsByType.inbound.total_uploads,
          successful: metricsByType.inbound.successful_uploads,
          failed: metricsByType.inbound.failed_uploads,
          successRate: metricsByType.inbound.success_rate_percent,
          avgDuration: metricsByType.inbound.average_duration_ms
        },
        outbound: {
          total: metricsByType.outbound.total_uploads,
          successful: metricsByType.outbound.successful_uploads,
          failed: metricsByType.outbound.failed_uploads,
          successRate: metricsByType.outbound.success_rate_percent,
          avgDuration: metricsByType.outbound.average_duration_ms
        }
      });
    }

    logger.info('Metrics check completed');
  } catch (error: any) {
    logger.error('Error during metrics monitoring', {
      error: error?.message
    });
  }
}

/**
 * Schedule recording metrics monitor to run every 5 minutes
 */
export function scheduleRecordingMetricsMonitor(): void {
  logger.info('Scheduling recording metrics monitor', {
    intervalMs: CHECK_INTERVAL_MS,
    thresholdPercent: SUCCESS_RATE_THRESHOLD_PERCENT
  });

  // Run immediately on startup
  monitorRecordingMetrics().catch((error) => {
    logger.error('Initial check failed', {
      error: error?.message
    });
  });

  // Schedule recurring checks
  setInterval(() => {
    monitorRecordingMetrics().catch((error) => {
      logger.error('Scheduled check failed', {
        error: error?.message
      });
    });
  }, CHECK_INTERVAL_MS);

  logger.info('Recording metrics monitor scheduled');
}
