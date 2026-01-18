import { config } from '../config/index';
import { IntegrationSettingsService } from './integration-settings';
import { TwilioCredentials } from './twilio-service';
import VapiClient from './vapi-client';
import { getCalendarClient } from './google-oauth-service';
import { createLogger } from './logger';
import twilio from 'twilio';

const logger = createLogger('VerificationService');

export interface VerificationResult {
    step: 'twilio' | 'vapi' | 'calendar' | 'system';
    success: boolean;
    message: string;
    details?: any;
    timestamp: string;
}

export interface PreFlightStatus {
    orgId: string;
    overallHealth: 'healthy' | 'degraded' | 'critical';
    checks: VerificationResult[];
}

export class VerificationService {
    /**
     * Run all pre-flight checks for an organization
     */
    static async runPreFlightCheck(orgId: string): Promise<PreFlightStatus> {
        const results: VerificationResult[] = [];

        // 1. Verify Twilio
        results.push(await this.verifyTwilio(orgId));

        // 2. Verify Vapi
        results.push(await this.verifyVapi(orgId));

        // 3. Verify Google Calendar
        results.push(await this.verifyGoogleCalendar(orgId));

        // Determine overall health
        const failedChecks = results.filter(r => !r.success);
        let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';

        if (failedChecks.length > 0) {
            // If critical integrations fail (all of them), it's critical. 
            // If only one fails, it might be degraded (but for now let's be strict).
            overallHealth = 'critical';
        }

        // TODO: We could add a "System" check for logic/webhooks if needed.

        return {
            orgId,
            overallHealth,
            checks: results
        };
    }

    /**
     * Verify Twilio Credentials & Configuration
     */
    static async verifyTwilio(orgId: string): Promise<VerificationResult> {
        try {
            const keys = await IntegrationSettingsService.getTwilioCredentials(orgId);

            // Initialize client to test credentials
            const client = twilio(keys.accountSid, keys.authToken);

            // Perform a lightweight API call to validate creds
            // Fetching the account details is a good way to check SID/Token
            const account = await client.api.v2010.accounts(keys.accountSid).fetch();

            if (account.status !== 'active') {
                throw new Error(`Twilio account status is ${account.status}`);
            }

            // Verify the phone number exists in this account (IncomingPhoneNumbers)
            const incomingNumbers = await client.incomingPhoneNumbers.list({
                phoneNumber: keys.phoneNumber,
                limit: 1
            });

            if (incomingNumbers.length === 0) {
                throw new Error(`Phone number ${keys.phoneNumber} not found in this Twilio account`);
            }

            return {
                step: 'twilio',
                success: true,
                message: 'Twilio connection verified',
                details: {
                    accountName: account.friendlyName,
                    phoneNumber: keys.phoneNumber
                },
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            logger.error('Twilio verification failed', { orgId, error: error.message });
            return {
                step: 'twilio',
                success: false,
                message: `Twilio verification failed: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verify Vapi Configuration (Platform Provider Check)
     */
    static async verifyVapi(orgId: string): Promise<VerificationResult> {
        try {
            // 1. Platform Health Check: Ensure System API Key is valid
            const platformKey = config.VAPI_PRIVATE_KEY;
            if (!platformKey) {
                throw new Error('System Error: VAPI_PRIVATE_KEY missing in backend environment');
            }

            // 2. Tenant Configuration Check: Get Assistant ID
            // We use IntegrationSettingsService just to get the Assistant ID, ignoring any stored key
            const keys = await IntegrationSettingsService.getVapiCredentials(orgId);
            const assistantId = keys.assistantId;

            if (!assistantId) {
                return {
                    step: 'vapi',
                    success: false,
                    message: 'Vapi Assistant not configured for this organization',
                    timestamp: new Date().toISOString()
                };
            }

            // 3. Connection Check: Use Platform Key to verify Assistant
            const vapi = new VapiClient(platformKey);
            const assistant = await vapi.getAssistant(assistantId);

            if (!assistant || assistant.id !== assistantId) {
                throw new Error('Vapi Assistant retrieval failed or ID mismatch');
            }

            return {
                step: 'vapi',
                success: true,
                message: 'Platform Integration Active',
                details: {
                    status: 'Connected via Platform Key',
                    assistantName: assistant.name,
                    model: assistant.model?.model,
                    voice: assistant.voice?.voiceId
                },
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            logger.error('Vapi verification failed', { orgId, error: error.message });
            return {
                step: 'vapi',
                success: false,
                message: `Vapi verification failed: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verify Google Calendar Authorization
     */
    static async verifyGoogleCalendar(orgId: string): Promise<VerificationResult> {
        try {
            // This throws if credentials missing or refresh fails
            const calendar = await getCalendarClient(orgId);

            // Perform a lightweight API call: List calendars (limit 1)
            const res = await calendar.calendarList.list({
                maxResults: 1
            });

            if (res.status !== 200) {
                throw new Error(`Google API returned status ${res.status}`);
            }

            return {
                step: 'calendar',
                success: true,
                message: 'Google Calendar connection verified',
                details: {
                    calendarsFound: res.data.items?.length || 0
                },
                timestamp: new Date().toISOString()
            };

        } catch (error: any) {
            // Differentiate between "Not Configured" and "Broken"
            const message = error.message.includes('not connected')
                ? 'Google Calendar not connected'
                : `Google Calendar verification failed: ${error.message}`;

            logger.error('Google Calendar verification failed', { orgId, error: error.message });

            return {
                step: 'calendar',
                success: false,
                message: message,
                timestamp: new Date().toISOString()
            };
        }
    }
}
