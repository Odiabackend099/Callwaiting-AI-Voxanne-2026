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
    sentimentLabel: string; // 'positive', 'neutral', 'negative'
    sentimentScore: number; // 0.0-1.0
    sentimentSummary: string; // Human-readable sentiment description
    sentimentUrgency: string; // 'low', 'medium', 'high', 'critical'
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
                    detailedSummary: 'Call completed successfully.',
                    sentimentLabel: 'neutral',
                    sentimentScore: 0.5,
                    sentimentSummary: 'Call completed with insufficient data for sentiment analysis.',
                    sentimentUrgency: 'low'
                };
            }

            const prompt = `You are a Clinical Call Analyzer for a high-end medical clinic. Analyze this call transcript and generate BOTH an outcome summary AND a sentiment analysis.

Return strictly JSON with this structure:
{
  "short_outcome": "string (1-2 words, e.g., 'Booking Confirmed', 'Information Provided', 'Follow-up Scheduled')",
  "detailed_summary": "string (2-3 sentences describing what was discussed and what action was taken)",
  "sentiment_label": "string (exactly one of: 'positive', 'neutral', 'negative')",
  "sentiment_score": "number (0.0 to 1.0 where 1.0 is most positive)",
  "sentiment_summary": "string (1-2 sentences describing the caller's emotional state and satisfaction)",
  "sentiment_urgency": "string (exactly one of: 'low', 'medium', 'high', 'critical')"
}

Key Guidelines:
- Focus on actionable outcomes and key topics discussed
- Be concise but meaningful
- Examples of short outcomes: "Booking Confirmed", "Information Provided", "Follow-up Scheduled", "Consultation Booked", "Question Answered", "Referral Made"
- For sentiment: Analyze the caller's tone, satisfaction, and emotional state throughout the conversation
- sentiment_score: 0.0 = very negative, 0.5 = neutral, 1.0 = very positive
- sentiment_urgency: 'critical' if caller expressed urgent medical need or frustration, 'high' if time-sensitive, 'medium' for standard inquiries, 'low' for informational calls

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
            const sentimentLabel = (result.sentiment_label || 'neutral').toLowerCase().trim();
            const sentimentScore = typeof result.sentiment_score === 'number'
                ? Math.max(0, Math.min(1, result.sentiment_score))
                : 0.5;
            const sentimentSummary = (result.sentiment_summary || 'Call completed.').trim();
            const sentimentUrgency = (result.sentiment_urgency || 'low').toLowerCase().trim();

            logger.info('Outcome + sentiment generated', {
                durationMs: Date.now() - startTime,
                shortOutcome,
                summaryLength: detailedSummary.length,
                sentimentLabel,
                sentimentScore
            });

            return {
                shortOutcome,
                detailedSummary,
                sentimentLabel,
                sentimentScore,
                sentimentSummary,
                sentimentUrgency
            };

        } catch (error: any) {
            logger.error('Outcome summary generation failed', { error: error.message });
            // Return default values on error to avoid breaking the pipeline
            return {
                shortOutcome: 'Call Completed',
                detailedSummary: 'Call completed successfully.',
                sentimentLabel: 'neutral',
                sentimentScore: 0.5,
                sentimentSummary: 'Unable to analyze sentiment.',
                sentimentUrgency: 'low'
            };
        }
    }
}
