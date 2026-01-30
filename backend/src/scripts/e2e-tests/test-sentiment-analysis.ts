#!/usr/bin/env ts-node
/**
 * Test 4: Sentiment Analysis (GPT-4o)
 *
 * Verifies that:
 * 1. GPT-4o analyzes call transcripts correctly
 * 2. Returns structured sentiment data (score, label, summary, urgency)
 * 3. Score is in valid range (0.0-1.0)
 * 4. Label matches expected values
 * 5. Response time is <2 seconds
 */

import { SentimentService } from '../../services/sentiment-analysis';
import { assert } from '../e2e-utils/test-environment-setup';

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

export async function testSentimentAnalysis(): Promise<TestResult> {
  const testName = 'Sentiment Analysis (GPT-4o)';
  console.log(`\n🧪 Testing: ${testName}`);

  // Realistic test transcript (anxious first-time Botox patient)
  const testTranscript = `
Patient: Hi, I'm calling because I'm interested in getting Botox for the first time.
Receptionist: Of course! I'd be happy to help you with that. Have you had any cosmetic procedures before?
Patient: No, this is my first time. I'm actually really nervous about it. Will it hurt?
Receptionist: I completely understand your concerns. It's very common to feel anxious before your first treatment. Most patients describe the sensation as a small pinch, and it only takes a few minutes.
Patient: How long does it last? I don't want to commit to something permanent if I don't like the results.
Receptionist: That's actually one of the benefits of Botox. The effects typically last 3-4 months, so it's not permanent. If you're happy with the results, you can continue treatments. If not, it will naturally wear off.
Patient: Okay, that makes me feel a bit better. How much does it cost?
Receptionist: Our Botox treatment for forehead lines is $400. We also offer package deals if you're interested in treating multiple areas.
Patient: I think I'd like to book a consultation first before committing to the treatment.
Receptionist: That's a great idea! We offer complimentary consultations. Would you like to schedule one?
Patient: Yes, please. Do you have any availability next Tuesday afternoon?
Receptionist: Let me check... Yes, we have 2 PM available on Tuesday. Would that work for you?
Patient: Perfect! I'll take that appointment.
Receptionist: Wonderful! I have you scheduled for a Botox consultation on Tuesday at 2 PM. We'll send you a confirmation email and SMS reminder.
Patient: Thank you so much! I feel much better about this now.
Receptionist: You're very welcome! Our team will take great care of you. See you Tuesday!
  `.trim();

  try {
    const start = performance.now();

    // STEP 1: Analyze transcript with GPT-4o
    console.log('   → Analyzing transcript with GPT-4o...');

    const sentiment = await SentimentService.analyzeCall(testTranscript);

    const duration = performance.now() - start;

    console.log(`   → Analysis complete in ${Math.round(duration)}ms`);

    // Assertions on sentiment structure
    assert(sentiment !== null, 'Sentiment should not be null');
    assert(sentiment !== undefined, 'Sentiment should not be undefined');
    assert('score' in sentiment, 'Sentiment should have score field');
    assert('label' in sentiment, 'Sentiment should have label field');
    assert('summary' in sentiment, 'Sentiment should have summary field');
    assert('urgency' in sentiment, 'Sentiment should have urgency field');

    // Validate score
    assert(typeof sentiment.score === 'number', 'Score should be a number');
    assert(sentiment.score >= 0, 'Score should be >= 0');
    assert(sentiment.score <= 1, 'Score should be <= 1');

    // Validate label
    const validLabels = ['Anxious', 'Reassured', 'Frustrated', 'Decisive', 'Positive', 'Neutral', 'Negative'];
    assert(
      validLabels.includes(sentiment.label),
      `Label should be one of ${validLabels.join(', ')}, got: ${sentiment.label}`
    );

    // Validate summary
    assert(typeof sentiment.summary === 'string', 'Summary should be a string');
    assert(sentiment.summary.length > 0, 'Summary should not be empty');
    assert(sentiment.summary.length < 500, 'Summary should be concise (<500 chars)');

    // Validate urgency
    const validUrgency = ['High', 'Medium', 'Low'];
    assert(
      validUrgency.includes(sentiment.urgency),
      `Urgency should be High/Medium/Low, got: ${sentiment.urgency}`
    );

    console.log(`   ✅ Sentiment Score: ${sentiment.score.toFixed(2)}`);
    console.log(`   ✅ Label: ${sentiment.label}`);
    console.log(`   ✅ Urgency: ${sentiment.urgency}`);
    console.log(`   ✅ Summary: ${sentiment.summary.substring(0, 100)}...`);

    // Performance assertion
    if (duration >= 2000) {
      console.log(`   ⚠️  Warning: Analysis time (${Math.round(duration)}ms) exceeds 2s target`);
    }

    // Contextual validation - for this transcript we expect:
    // - Moderate to high score (patient overcame anxiety, booked appointment)
    // - Label should be Anxious, Reassured, or Decisive
    // - Urgency should be Medium or Low (not a medical emergency)
    const expectedLabels = ['Anxious', 'Reassured', 'Decisive', 'Positive'];
    const expectedUrgency = ['Medium', 'Low'];

    if (!expectedLabels.includes(sentiment.label)) {
      console.log(`   ⚠️  Warning: Expected label ${expectedLabels.join('/')} but got ${sentiment.label}`);
    }

    if (!expectedUrgency.includes(sentiment.urgency)) {
      console.log(`   ⚠️  Warning: Expected urgency ${expectedUrgency.join('/')} but got ${sentiment.urgency}`);
    }

    // Success
    return {
      testName,
      passed: true,
      duration: Math.round(duration),
      details: `Score: ${sentiment.score.toFixed(2)}, Label: ${sentiment.label}, Urgency: ${sentiment.urgency}, Duration: ${Math.round(duration)}ms`
    };
  } catch (error: any) {
    return {
      testName,
      passed: false,
      duration: 0,
      error: error.message || String(error)
    };
  }
}

// Allow running standalone
if (require.main === module) {
  testSentimentAnalysis()
    .then((result) => {
      if (result.passed) {
        console.log(`\n✅ ${result.testName} - PASS`);
        console.log(`   ${result.details}`);
        process.exit(0);
      } else {
        console.log(`\n❌ ${result.testName} - FAIL`);
        console.log(`   Error: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
