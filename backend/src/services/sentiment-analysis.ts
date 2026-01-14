import OpenAI from 'openai';
import { createLogger } from './logger';

const logger = createLogger('SentimentAnalysis');

// Initialize OpenAI client
// Note: Requires OPENAI_API_KEY in environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface SentimentAnalysisResult {
    score: number; // 0.0 to 1.0
    label: 'Anxious' | 'Reassured' | 'Frustrated' | 'Decisive' | 'Positive' | 'Neutral' | 'Negative';
    summary: string;
    urgency: 'High' | 'Medium' | 'Low';
}

export class SentimentService {
    /**
     * Analyze call transcript for clinical sentiment and summary using GPT-4o
     */
    static async analyzeCall(transcript: string): Promise<SentimentAnalysisResult> {
        const startTime = Date.now();
        try {
            if (!transcript || transcript.trim().length < 10) {
                logger.info('Transcript too short for analysis', { length: transcript?.length });
                return {
                    score: 0.5,
                    label: 'Neutral',
                    summary: 'Insufficient transcript for analysis.',
                    urgency: 'Low'
                };
            }

            const prompt = `Act as a Harley Street Clinical Auditor. Analyze this transcript. Return JSON:
{
  "score": number, // 0.0-1.0 (0.0=Angry/Severe, 0.5=Neutral/Info, 1.0=Happy/Success)
  "label": "Anxious" | "Reassured" | "Frustrated" | "Decisive" | "Neutral",
  "summary": "2-sentence summary of patient emotional state and procedure intent.",
  "urgency": "High" | "Medium" | "Low"
}
Key Definitions:
- Urgency 'High': Medical emergencies OR Severe Service Dissatisfaction (e.g. long hold times).
- Score 0.5: Purely informational queries (e.g. hours, address).
- Label 'Decisive': Clear intent to book/pay (e.g. "I want to book").

Transcript:
"${transcript.substring(0, 15000)}"`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a Clinical Sentiment Auditor for a high-end medical clinic. Output strictly JSON.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1
            });

            const content = response.choices[0].message.content;
            if (!content) {
                throw new Error('No content received from OpenAI');
            }

            const result = JSON.parse(content);

            // Validate and normalize result
            const score = Math.min(Math.max(Number(result.score) || 0.5, 0), 1);

            // Normalize label
            let label = result.label;
            const validLabels = ['Anxious', 'Reassured', 'Frustrated', 'Decisive', 'Positive', 'Neutral', 'Negative'];
            if (!validLabels.includes(label)) {
                // Fallback mapping
                if (score > 0.8) label = 'Decisive';
                else if (score > 0.6) label = 'Reassured';
                else if (score < 0.4) label = 'Frustrated';
                else label = 'Neutral';
            }

            const summary = result.summary || 'Analysis unavailable.';
            const urgency = ['High', 'Medium', 'Low'].includes(result.urgency) ? result.urgency : 'Low';

            logger.info('Analysis complete', {
                durationMs: Date.now() - startTime,
                score,
                label,
                urgency
            });

            return { score, label, summary, urgency };

        } catch (error: any) {
            logger.error('Analysis failed', { error: error.message });
            // Return neutral default on error to avoid breaking the pipeline
            return {
                score: 0.5,
                label: 'Neutral',
                summary: 'Error during sentiment analysis.',
                urgency: 'Low'
            };
        }
    }
}
