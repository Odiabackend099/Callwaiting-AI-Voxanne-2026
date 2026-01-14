
import { sendSmsTwilio, TwilioResult } from './twilio-service';
import { IntegrationSettingsService } from './integration-settings';
import { supabase } from './supabase-client';
import { log } from './logger';

export class SmsComplianceService {
    /**
     * Send a 10DLC compliant SMS
     */
    async sendCompliantSMS(tenantId: string, phone: string, template: string): Promise<TwilioResult> {
        try {
            // 1. Get business name
            const { data: org, error } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', tenantId)
                .single();

            if (error) {
                log.warn('SmsComplianceService', 'Could not fetch org name, using default', { tenantId, error: error.message });
            }

            const businessName = org?.name || 'CallWaiting AI';

            // 2. Get Twilio Creds
            // This will throw if not configured, which is correct
            const creds = await IntegrationSettingsService.getTwilioCredentials(tenantId);

            // 3. Construct 10DLC compliant message
            // Ensure specific opt-out language is present
            const compliantMessage = `Hi! ${template} Reply STOP to opt-out. ${businessName} Msg&Data rates may apply.`;

            // 4. Send
            const result = await sendSmsTwilio({
                to: phone,
                message: compliantMessage
            }, creds);

            return result;
        } catch (error: any) {
            log.error('SmsComplianceService', 'Error sending SMS', { tenantId, error: error.message });
            throw error;
        }
    }
}

export const smsComplianceService = new SmsComplianceService();
