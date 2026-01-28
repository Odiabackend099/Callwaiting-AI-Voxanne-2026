import { WebClient } from '@slack/web-api';
import { log } from './logger';

// Initialize Slack client
export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Track error counts
let errorCount = 0;
let lastResetTime = Date.now();

/**
 * Increment the error count and check if it exceeds the threshold.
 * If it does, send an alert and reset the count.
 */
export function incrementErrorCount(): void {
  errorCount++;
  
  // Check if we are over the threshold
  if (errorCount > 50) {
    sendSlackAlert('🚨 High Error Rate', `Detected ${errorCount} errors in the last minute.`)
      .catch((err) => {
        log.error('Slack', 'Failed to send high error rate alert', { error: err.message });
      });
    // Reset the count immediately to avoid repeated alerts
    errorCount = 0;
    lastResetTime = Date.now();
  }
}

/**
 * Send a Slack alert to the configured channel.
 * @param title The title of the alert
 * @param details Additional details
 */
export async function sendSlackAlert(title: string, details: any): Promise<void> {
  try {
    // Format the details as a string
    const detailsText = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    
    await slackClient.chat.postMessage({
      channel: process.env.SLACK_ALERTS_CHANNEL || '#voxanne-alerts',
      text: `*${title}*\n${detailsText}`,
      mrkdwn: true,
    });
    log.info('Slack', 'Alert sent', { title });
  } catch (error) {
    log.error('Slack', 'Failed to send alert', { error: (error as Error).message });
    throw error;
  }
}

// Reset the error count every minute
setInterval(() => {
  errorCount = 0;
  lastResetTime = Date.now();
}, 60 * 1000);
