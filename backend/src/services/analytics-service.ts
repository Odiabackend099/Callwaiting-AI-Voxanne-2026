import { RedactionService } from './redaction-service';
import { supabase } from './supabase-client';
import { log } from './logger';

// ... (existing imports)



export class AnalyticsService {
    /**
     * Process end-of-call report asynchronously
     * This is the "Async Hook" - returns immediately, processes in background
     */
    static async processEndOfCall(payload: any): Promise<void> {
        // Fire and forget (in a real serverless env, use a queue like BullMQ or Inngest)
        // For this backend, we just don't await the promise in the webhook handler
        this.analyzeCall(payload).catch(err => {
            log.error('AnalyticsService', 'Failed to analyze call', { error: err.message });
        });
    }

    /**
     * Main analysis logic
     */
    private static async analyzeCall(payload: any): Promise<void> {
        const { call, transcript, summary, recordingUrl } = payload;

        if (!call || !call.id) {
            log.warn('AnalyticsService', 'No call ID in payload');
            return;
        }

        log.info('AnalyticsService', 'Starting analysis', { callId: call.id });

        try {
            // 1. Determine Intent (Simple keyword matching for now, scalable to LLM)
            const intent = this.determineIntent(transcript, summary);

            // 2. Calculate Sentiment (Mock logic or simple word analysis if no LLM score provided)
            // Vapi sometimes provides a sentiment analysis in the analysis object
            const sentimentScore = this.calculateSentiment(payload.analysis);

            // 3. Determine Booking Status
            // Check if "appointment" or "booked" is a tool call or in summary
            const isBooked = this.checkIfBooked(payload);

            // 4. Update Database
            // We rely on the DB function check_lead_temperature (or update directly)
            // But we can also calculate lead temp here to be safe and explicit
            const leadTemp = this.calculateLeadTemperature(call.status, intent, call.durationSeconds, isBooked);

            // Financial Value Map
            // Financial Value Map
            const financialValue = this.getFinancialValue(intent);

            // GDPR Redaction
            const cleanTranscript = RedactionService.redact(transcript);
            const cleanSummary = RedactionService.redact(summary);

            const updateData = {
                procedure_intent: intent,
                sentiment_score: sentimentScore,
                lead_temp: leadTemp,
                financial_value: financialValue,
                org_id: orgId,
                metadata: {
                    booking_confirmed: isBooked,
                    summary: cleanSummary,
                    transcript_preview: cleanTranscript ? cleanTranscript.substring(0, 200) + '...' : '',
                    vapi_analysis: payload.analysis
                }
            };

            const { error } = await supabase
                .from('calls')
                .update(updateData)
                .eq('id', call.id); // Assuming we map Vapi Call ID to our DB ID or have a mapping

            // Fallback: If updated 0 rows, maybe we need to find by vapi_call_id column if it exists
            // For now assuming ID matches or we query by vapi_id

            if (error) {
                log.error('AnalyticsService', 'DB Update failed', { error: error.message });
            } else {
                log.info('AnalyticsService', 'Analysis complete', { callId: call.id, leadTemp });

                // 5. Create Follow Up Task for Hot Leads
                if (leadTemp === 'hot') {
                    const { error: taskError } = await supabase
                        .from('follow_up_tasks')
                        .insert({
                            org_id: updateData.org_id || call.orgId,
                            lead_id: call.contactId || call.customer?.id, // Mapping contact to lead_id
                            task_type: 'call_back', // Valid enum value
                            service_context: {
                                description: `Hot lead detected. Intent: ${intent}. Financial Value: £${financialValue}.`,
                                intent: intent,
                                source: 'analytics_engine'
                            }, // Assuming JSONB or Text. If Text, stringify it or just use string.
                            priority: 'high',
                            status: 'pending',
                            scheduled_for: new Date(Date.now() + 30 * 60000).toISOString()
                        });

                    if (taskError) {
                        // Fallback if service_context is text
                        if (taskError.message.includes('json')) {
                            // Retry with string? Or log.
                            log.error('AnalyticsService', 'Task creation schema mismatch (JSON)', { error: taskError.message });
                        } else {
                            log.error('AnalyticsService', 'Failed to create follow-up task', { error: taskError.message });
                        }
                    } else {
                        log.info('AnalyticsService', 'Follow-up task created');
                    }
                }
            }

        } catch (error: any) {
            log.error('AnalyticsService', 'Analysis error', { error: error.message });
        }
    }

    private static determineIntent(transcript: string, summary: string): string {
        const text = (transcript + ' ' + summary).toLowerCase();

        if (text.includes('facelift') || text.includes('face lift')) return 'facelift';
        if (text.includes('rhinoplasty') || text.includes('nose job')) return 'rhinoplasty';
        if (text.includes('breast') || text.includes('augmentation') || text.includes('boob')) return 'breast_augmentation';
        if (text.includes('price') || text.includes('cost') || text.includes('how much')) return 'pricing_inquiry';
        if (text.includes('schedule') || text.includes('appointment') || text.includes('book')) return 'booking_inquiry';

        return 'general_inquiry';
    }

    private static calculateSentiment(analysis: any): number {
        // If Vapi provides sentiment
        if (analysis && analysis.sentiment) {
            // Map 'positive', 'neutral', 'negative' to score
            if (analysis.sentiment === 'positive') return 0.9;
            if (analysis.sentiment === 'neutral') return 0.5;
            if (analysis.sentiment === 'negative') return 0.2;
        }
        // Default
        return 0.5;
    }

    private static checkIfBooked(payload: any): boolean {
        // Check tool calls for successful booking
        const toolCalls = payload.toolCalls || [];
        const hasBookingTool = toolCalls.some((tc: any) =>
            (tc.function?.name === 'checkSlotAvailability' || tc.function?.name === 'bookAppointment')
            && !tc.error
        );

        // Also check summary for "booked"
        const summaryBooked = (payload.summary || '').toLowerCase().includes('booked appointment');

        return hasBookingTool || summaryBooked;
    }

    private static calculateLeadTemperature(status: string, intent: string, duration: number, isBooked: boolean): 'hot' | 'warm' | 'cool' {
        const highValue = ['facelift', 'rhinoplasty', 'breast_augmentation'].includes(intent);

        // HOT: High value, not booked
        if (highValue && !isBooked) return 'hot';

        // WARM: General intent, call completed, not booked (needs follow up)
        if (status === 'ended' && !isBooked && duration > 30) return 'warm';

        // COOL: Booked (mission accomplished) or short inquiry
        if (isBooked) return 'cool'; // Actually if booked, it's successful, but maybe "cool" lead temp means "no sales action needed"

        return 'cool';
    }

    private static getFinancialValue(intent: string): number {
        switch (intent) {
            case 'facelift': return 10000;
            case 'rhinoplasty': return 6000;
            case 'breast_augmentation': return 7000;
            case 'booking_inquiry': return 150; // Consult value
            default: return 0;
        }
    }
}
