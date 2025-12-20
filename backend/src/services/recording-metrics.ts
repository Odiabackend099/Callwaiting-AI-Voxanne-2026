/**
 * Recording Upload Metrics Service
 * Tracks success/failure rates, duration, and file sizes for recording uploads
 * Provides monitoring and alerting capabilities
 */

import { supabase } from './supabase-client';
import { createLogger } from './logger';

const logger = createLogger('RecordingMetrics');

interface RecordingMetric {
  call_id: string;
  call_type: 'inbound' | 'outbound';
  status: 'success' | 'failure';
  duration_ms: number;
  file_size_bytes?: number;
  error_message?: string;
  created_at: string;
}

interface SuccessRateData {
  total_uploads: number;
  successful_uploads: number;
  failed_uploads: number;
  success_rate_percent: number;
  average_duration_ms: number;
  time_period: string;
}

/**
 * Record a successful recording upload
 */
export async function recordUploadSuccess(params: {
  callId: string;
  callType: 'inbound' | 'outbound';
  durationMs: number;
  fileSizeBytes: number;
}): Promise<boolean> {
  try {
    const { callId, callType, durationMs, fileSizeBytes } = params;

    const { error } = await supabase
      .from('recording_upload_metrics')
      .insert({
        call_id: callId,
        call_type: callType,
        status: 'success',
        duration_ms: durationMs,
        file_size_bytes: fileSizeBytes,
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Failed to record metric', {
        callId,
        error: error.message
      });
      return false;
    }

    logger.info('Metric recorded', {
      callId,
      callType,
      durationMs,
      fileSizeBytes
    });

    return true;
  } catch (error: any) {
    logger.error('Error recording upload success', {
      error: error.message
    });
    return false;
  }
}

/**
 * Record a failed recording upload
 */
export async function recordUploadFailure(params: {
  callId: string;
  callType: 'inbound' | 'outbound';
  durationMs: number;
  errorMessage: string;
}): Promise<boolean> {
  try {
    const { callId, callType, durationMs, errorMessage } = params;

    const { error } = await supabase
      .from('recording_upload_metrics')
      .insert({
        call_id: callId,
        call_type: callType,
        status: 'failure',
        duration_ms: durationMs,
        error_message: errorMessage.substring(0, 500), // Limit error message length
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Failed to record metric', {
        callId,
        error: error.message
      });
      return false;
    }

    logger.warn('Upload failure recorded', {
      callId,
      callType,
      durationMs,
      error: errorMessage
    });

    return true;
  } catch (error: any) {
    logger.error('Error recording upload failure', {
      error: error.message
    });
    return false;
  }
}

/**
 * Get success rate for a time period
 * @param hoursAgo Number of hours to look back (default 24)
 * @returns Success rate metrics
 */
export async function getSuccessRate(hoursAgo: number = 24): Promise<SuccessRateData | null> {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);

    const { data: metrics, error } = await supabase
      .from('recording_upload_metrics')
      .select('status')
      .gte('created_at', cutoffTime.toISOString());

    if (error) {
      logger.error('Failed to fetch metrics', {
        error: error.message,
        hoursAgo
      });
      return null;
    }

    if (!metrics || metrics.length === 0) {
      logger.info('No metrics found for period', { hoursAgo });
      return {
        total_uploads: 0,
        successful_uploads: 0,
        failed_uploads: 0,
        success_rate_percent: 0,
        average_duration_ms: 0,
        time_period: `Last ${hoursAgo} hours`
      };
    }

    const successful = metrics.filter(m => m.status === 'success').length;
    const failed = metrics.filter(m => m.status === 'failure').length;
    const total = metrics.length;
    const successRatePercent = (successful / total) * 100;

    // Get average duration
    const { data: durationsData, error: durationsError } = await supabase
      .from('recording_upload_metrics')
      .select('duration_ms')
      .gte('created_at', cutoffTime.toISOString())
      .eq('status', 'success');

    let averageDuration = 0;
    if (!durationsError && durationsData && durationsData.length > 0) {
      const totalDuration = durationsData.reduce((sum, m) => sum + (m.duration_ms || 0), 0);
      averageDuration = Math.round(totalDuration / durationsData.length);
    }

    const result: SuccessRateData = {
      total_uploads: total,
      successful_uploads: successful,
      failed_uploads: failed,
      success_rate_percent: Math.round(successRatePercent * 100) / 100,
      average_duration_ms: averageDuration,
      time_period: `Last ${hoursAgo} hours`
    };

    logger.info('Success rate calculated', {
      ...result,
      hoursAgo
    });

    return result;
  } catch (error: any) {
    logger.error('Error calculating success rate', {
      error: error.message
    });
    return null;
  }
}

/**
 * Get success rate alert if it falls below threshold
 * @param thresholdPercent Alert threshold (default 95%)
 * @returns Alert object if threshold exceeded, null otherwise
 */
export async function checkSuccessRateAlert(thresholdPercent: number = 95): Promise<{
  alert: boolean;
  successRate: number;
  message: string;
} | null> {
  try {
    const metrics = await getSuccessRate(1); // Check last 1 hour

    if (!metrics || metrics.total_uploads < 5) {
      // Not enough data to alert
      return null;
    }

    if (metrics.success_rate_percent < thresholdPercent) {
      logger.warn('ALERT: Success rate below threshold', {
        successRate: metrics.success_rate_percent,
        threshold: thresholdPercent,
        totalUploads: metrics.total_uploads,
        failedUploads: metrics.failed_uploads
      });

      return {
        alert: true,
        successRate: metrics.success_rate_percent,
        message: `Recording upload success rate is ${metrics.success_rate_percent}% (threshold: ${thresholdPercent}%). Failed uploads: ${metrics.failed_uploads}/${metrics.total_uploads}`
      };
    }

    return {
      alert: false,
      successRate: metrics.success_rate_percent,
      message: `Recording upload success rate is healthy at ${metrics.success_rate_percent}%`
    };
  } catch (error: any) {
    logger.error('Error checking success rate alert', {
      error: error.message
    });
    return null;
  }
}

/**
 * Get metrics by call type
 */
export async function getMetricsByCallType(
  hoursAgo: number = 24
): Promise<Record<'inbound' | 'outbound', SuccessRateData> | null> {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);

    const callTypes: ('inbound' | 'outbound')[] = ['inbound', 'outbound'];
    const result: Record<'inbound' | 'outbound', SuccessRateData> = {
      inbound: {
        total_uploads: 0,
        successful_uploads: 0,
        failed_uploads: 0,
        success_rate_percent: 0,
        average_duration_ms: 0,
        time_period: `Last ${hoursAgo} hours`
      },
      outbound: {
        total_uploads: 0,
        successful_uploads: 0,
        failed_uploads: 0,
        success_rate_percent: 0,
        average_duration_ms: 0,
        time_period: `Last ${hoursAgo} hours`
      }
    };

    for (const callType of callTypes) {
      const { data: metrics, error } = await supabase
        .from('recording_upload_metrics')
        .select('status, duration_ms')
        .eq('call_type', callType)
        .gte('created_at', cutoffTime.toISOString());

      if (error) {
        logger.warn(`Failed to fetch ${callType} metrics`, {
          error: error.message
        });
        continue;
      }

      if (metrics && metrics.length > 0) {
        const successful = metrics.filter(m => m.status === 'success').length;
        const failed = metrics.filter(m => m.status === 'failure').length;
        const total = metrics.length;
        const successRate = (successful / total) * 100;

        const avgDuration = metrics.reduce((sum, m) => sum + (m.duration_ms || 0), 0) / total;

        result[callType] = {
          total_uploads: total,
          successful_uploads: successful,
          failed_uploads: failed,
          success_rate_percent: Math.round(successRate * 100) / 100,
          average_duration_ms: Math.round(avgDuration),
          time_period: `Last ${hoursAgo} hours`
        };
      }
    }

    logger.info('Metrics by call type retrieved', {
      hoursAgo,
      inbound: result.inbound,
      outbound: result.outbound
    });

    return result;
  } catch (error: any) {
    logger.error('Error getting metrics by call type', {
      error: error.message
    });
    return null;
  }
}
