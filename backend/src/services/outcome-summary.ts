import OpenAI from 'openai';
import { createLogger } from './logger';

const logger = createLogger('OutcomeSummary');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export interface OutcomeSummaryResult {
    shortOutcome: string; // 1-2 words: "Booking Confirmed", "Information Provided"
    detailedSummary: string; // 2-3 sentences
}

export class OutcomeSummaryService {
    /**
     * Generate a meaningful outcome summary for a call transcript using GPT-4o
     */
    static async generateOutcomeSummary(
        transcript: string,
        sentimentLabel?: string
    ): Promise<OutcomeSummaryResult> {
        const startTime = Date.now();
        try {
            if (!transcript || transcript.trim().length < 10) {
                logger.info('Transcript too short for outcome analysis', { length: transcript?.length });
                return {
                    shortOutcome: 'Call Completed',
                    detailedSummary: 'Call completed successfully.'
                };
            }

            const prompt = `You are a Clinical Call Analyzer for a high-end medical clinic. Analyze this call transcript and generate an outcome summary.

Return strictly JSON with this structure:
{
  "short_outcome": "string (1-2 words, e.g., 'Booking Confirmed', 'Information Provided', 'Follow-up Scheduled')",
  "detailed_summary": "string (2-3 sentences describing what was discussed and what action was taken)"
}

Key Guidelines:
- Focus on actionable outcomes and key topics discussed
- Be concise but meaningful
- Examples of short outcomes: "Booking Confirmed", "Information Provided", "Follow-up Scheduled", "Consultation Booked", "Question Answered", "Referral Made"

Sentiment context: ${sentimentLabel || 'Neutral'}

Transcript (first 10000 chars):
"${transcript.substring(0, 10000)}"`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a Clinical Call Analyzer. Output strictly valid JSON with no additional text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3
            });

            const content = response.choices[0].message.content;
            if (!content) {
                throw new Error('No content received from OpenAI');
            }

            const result = JSON.parse(content);

            const shortOutcome = (result.short_outcome || 'Call Completed').trim();
            const detailedSummary = (result.detailed_summary || 'Call completed successfully.').trim();

            logger.info('Outcome summary generated', {
                durationMs: Date.now() - startTime,
                shortOutcome,
                summaryLength: detailedSummary.length
            });

            return {
                shortOutcome,
                detailedSummary
            };

        } catch (error: any) {
            logger.error('Outcome summary generation failed', { error: error.message });
            // Return default values on error to avoid breaking the pipeline
            return {
                shortOutcome: 'Call Completed',
                detailedSummary: 'Call completed successfully.'
            };
        }
    }
}
