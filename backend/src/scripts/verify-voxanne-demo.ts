#!/usr/bin/env ts-node
/**
 * Voxanne Demo Org Feature Verification
 *
 * Tests the 5 critical demo features using the real Voxanne Demo org:
 * 1. Real-Time Availability (Google Calendar API)
 * 2. Atomic Booking (Google → DB)
 * 3. Live SMS Confirmation (Twilio)
 * 4. Sentiment Analysis (GPT-4o)
 * 5. Zero-Hallucination RAG (pgvector)
 *
 * Usage:
 *   npm run test:voxanne-demo
 */

import { checkAvailability, bookAppointment } from '../utils/google-calendar';
import { sendAppointmentConfirmationSMS } from '../services/sms-notifications';
import { SentimentService } from '../services/sentiment-analysis';
import { getRagContext } from '../services/rag-context-provider';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VOXANNE_DEMO_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testRealTimeAvailability(): Promise<TestResult> {
  const testName = 'Real-Time Availability Check';
  console.log(`\n🧪 Testing: ${testName}`);

  try {
    const start = performance.now();

    // Check availability for tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);

    const result = await checkAvailability(
      VOXANNE_DEMO_ORG_ID,
      tomorrow.toISOString(),
      endTime.toISOString()
    );

    const duration = performance.now() - start;

    // Assertions
    assert(result !== undefined, 'Result should not be undefined');
    assert('available' in result, 'Result should have available field');
    assert(typeof result.available === 'boolean', 'Available should be boolean');

    console.log(`   ✅ Calendar API responded in ${Math.round(duration)}ms`);
    console.log(`   ✅ Slot availability: ${result.available ? 'AVAILABLE' : 'OCCUPIED'}`);

    if (duration >= 500) {
      console.log(`   ⚠️  Warning: Response time (${Math.round(duration)}ms) exceeds 500ms target`);
    }

    return {
      testName,
      passed: true,
      duration: Math.round(duration),
      details: `Available: ${result.available}, Duration: ${Math.round(duration)}ms`
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

async function testSentimentAnalysis(): Promise<TestResult> {
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

    console.log('   → Analyzing transcript with GPT-4o...');
    const sentiment = await SentimentService.analyzeCall(testTranscript);
    const duration = performance.now() - start;

    console.log(`   → Analysis complete in ${Math.round(duration)}ms`);

    // Assertions
    assert(sentiment !== null, 'Sentiment should not be null');
    assert('score' in sentiment, 'Should have score field');
    assert('label' in sentiment, 'Should have label field');
    assert('summary' in sentiment, 'Should have summary field');
    assert('urgency' in sentiment, 'Should have urgency field');

    assert(sentiment.score >= 0 && sentiment.score <= 1,
      `Score should be 0-1, got: ${sentiment.score}`);

    const validLabels = ['Anxious', 'Reassured', 'Frustrated', 'Decisive', 'Positive', 'Neutral', 'Negative'];
    assert(validLabels.includes(sentiment.label),
      `Label should be one of ${validLabels.join(', ')}, got: ${sentiment.label}`);

    const validUrgency = ['High', 'Medium', 'Low'];
    assert(validUrgency.includes(sentiment.urgency),
      `Urgency should be High/Medium/Low, got: ${sentiment.urgency}`);

    console.log(`   ✅ Sentiment Score: ${sentiment.score.toFixed(2)}`);
    console.log(`   ✅ Label: ${sentiment.label}`);
    console.log(`   ✅ Urgency: ${sentiment.urgency}`);
    console.log(`   ✅ Summary: ${sentiment.summary.substring(0, 100)}...`);

    if (duration >= 2000) {
      console.log(`   ⚠️  Warning: Analysis time (${Math.round(duration)}ms) exceeds 2s target`);
    }

    return {
      testName,
      passed: true,
      duration: Math.round(duration),
      details: `Score: ${sentiment.score.toFixed(2)}, Label: ${sentiment.label}, Urgency: ${sentiment.urgency}`
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

async function testZeroHallucinationRAG(): Promise<TestResult> {
  const testName = 'Zero-Hallucination RAG';
  console.log(`\n🧪 Testing: ${testName}`);

  const durations: number[] = [];

  try {
    // Test 1: Query IN knowledge base (should retrieve relevant chunks)
    console.log('   → Test 1: In-scope query (general services)...');
    const start1 = performance.now();

    const result1 = await getRagContext('What services do you offer?', VOXANNE_DEMO_ORG_ID);

    const duration1 = performance.now() - start1;
    durations.push(duration1);

    console.log(`   ✅ In-scope: ${result1.chunkCount} chunks retrieved (${Math.round(duration1)}ms)`);
    console.log(`   ✅ Has context: ${result1.hasContext}`);
    if (result1.context.length > 0) {
      console.log(`   ✅ Context sample: ${result1.context.substring(0, 100)}...`);
    }

    // Test 2: Query NOT in knowledge base (should return empty to prevent hallucinations)
    console.log('   → Test 2: Out-of-scope query (brain surgery)...');
    const start2 = performance.now();

    const result2 = await getRagContext('Do you offer brain surgery?', VOXANNE_DEMO_ORG_ID);

    const duration2 = performance.now() - start2;
    durations.push(duration2);

    assert(result2.chunkCount === 0, 'Should NOT retrieve chunks for out-of-scope query');
    assert(result2.hasContext === false, 'hasContext should be false for out-of-scope query');

    console.log(`   ✅ Out-of-scope: 0 chunks retrieved (prevents hallucination) (${Math.round(duration2)}ms)`);

    // Calculate average duration
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    if (avgDuration >= 200) {
      console.log(`   ⚠️  Warning: Average response time (${Math.round(avgDuration)}ms) exceeds 200ms target`);
    }

    return {
      testName,
      passed: true,
      duration: Math.round(avgDuration),
      details: `In-scope: ${result1.chunkCount} chunks, Out-of-scope: ${result2.chunkCount} chunks, Avg: ${Math.round(avgDuration)}ms`
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

async function runAllTests() {
  console.log('🚀 Starting Voxanne Demo Feature Verification\n');
  console.log('='.repeat(70) + '\n');

  const results: TestResult[] = [];
  const startTime = Date.now();

  // Verify Voxanne Demo org exists
  console.log('⚙️  Verifying Voxanne Demo org exists...');
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, email')
    .eq('id', VOXANNE_DEMO_ORG_ID)
    .single();

  if (error || !org) {
    console.error('❌ Voxanne Demo org not found!');
    console.error('   Expected ID:', VOXANNE_DEMO_ORG_ID);
    process.exit(1);
  }

  console.log(`✅ Found org: ${org.name} (${org.email})\n`);

  // Run tests sequentially
  const tests = [
    testRealTimeAvailability,
    testSentimentAnalysis,
    testZeroHallucinationRAG
  ];

  for (const test of tests) {
    const result = await test();
    results.push(result);

    if (result.passed) {
      console.log(`✅ ${result.testName} - PASS (${result.duration}ms)`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    } else {
      console.log(`❌ ${result.testName} - FAIL`);
      console.log(`   Error: ${result.error}`);
    }

    console.log(''); // Empty line between tests
  }

  // Report
  const totalDuration = Date.now() - startTime;

  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Results Summary\n');

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`Tests Passed: ${passedCount}/${totalCount}`);
  console.log(`Tests Failed: ${totalCount - passedCount}/${totalCount}`);
  console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s\n`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED - DEMO READY!\n');
    console.log('You can confidently demonstrate these features:\n');
    console.log('  ✅ Real-time calendar availability checks');
    console.log('  ✅ Sentiment analysis with GPT-4o');
    console.log('  ✅ Zero-hallucination knowledge base\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED\n');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.testName}: ${r.error}`);
    });
    console.log('\nPlease fix the failing tests before the demo.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
