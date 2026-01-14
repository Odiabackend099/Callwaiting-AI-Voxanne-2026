import 'dotenv/config';
import { SentimentService } from '../services/sentiment-analysis';
import { createLogger } from '../services/logger';

// Mock logger to avoid cluttering real logs
const logger = createLogger('SentimentTest');

async function testSentiment() {
    console.log('Starting Gold Standard Sentiment Validation...\n');

    const cases = [
        {
            id: 'Case A (High Value)',
            text: "I've been thinking about this facelift for years. I'm a bit nervous about the recovery, but I really want to go ahead. The £15,000 price is fine, I just want the best doctor.",
            expected: { minScore: 0.8, intent: 'Facelift', urgency: ['High', 'Medium', 'Low'] }
        },
        {
            id: 'Case B (Friction)',
            text: "I've been on hold for 10 minutes! This is ridiculous. I just need to reschedule my appointment.",
            expected: { maxScore: 0.4, label: 'Frustrated', urgency: ['High'] }
        },
        {
            id: 'Case C (Routine)',
            text: "Hi, I was just wondering what your opening hours are on Saturdays?",
            expected: { minScore: 0.4, maxScore: 0.6, label: 'Neutral', urgency: ['Low'] }
        }
    ];

    let passed = true;

    for (const testCase of cases) {
        console.log(`Analyzing ${testCase.id}...`);
        const result = await SentimentService.analyzeCall(testCase.text);
        console.log(`Result: Score=${result.score}, Label=${result.label}, Urgency=${result.urgency}`);
        console.log(`Summary: ${result.summary}`);

        let casePassed = true;

        // Score Checks
        if (testCase.expected.minScore !== undefined && result.score < testCase.expected.minScore) {
            console.error(`FAIL: Score ${result.score} < ${testCase.expected.minScore}`);
            casePassed = false;
        }
        if (testCase.expected.maxScore !== undefined && result.score > testCase.expected.maxScore) {
            console.error(`FAIL: Score ${result.score} > ${testCase.expected.maxScore}`);
            casePassed = false;
        }

        // Label Checks (if specified)
        if (testCase.expected.label && result.label !== testCase.expected.label) {
            // Allow synonym if strictly not matching but emotionally close? No, strict for now.
            // Actually, "Frustrated" is expected for Case B.
            // "Neutral" for Case C.
            if (result.label !== testCase.expected.label) {
                console.error(`FAIL: Label ${result.label} !== ${testCase.expected.label}`);
                casePassed = false;
            }
        }

        // Intent Keyword Check
        if (testCase.expected.intent && !result.summary.toLowerCase().includes(testCase.expected.intent.toLowerCase())) {
            console.error(`FAIL: Summary does not contain '${testCase.expected.intent}'`);
            casePassed = false;
        }

        // Urgency Check
        if (testCase.expected.urgency && !testCase.expected.urgency.includes(result.urgency)) {
            console.error(`FAIL: Urgency ${result.urgency} not in [${testCase.expected.urgency.join(', ')}]`);
            casePassed = false;
        }

        if (casePassed) console.log('✅ PASS\n');
        else {
            console.log('❌ FAIL\n');
            passed = false;
        }
    }

    if (passed) {
        console.log('🏆 All Gold Standard Tests Passed!');
        process.exit(0);
    } else {
        console.error('⚠️ Verification Failed');
        process.exit(1);
    }
}

testSentiment();
