/**
 * RAG System Test Script
 * Tests the Knowledge Base RAG system by simulating 5 questions
 * and verifying that the webhook returns relevant KB context
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

interface TestQuestion {
  question: string;
  expectedKeywords: string[];
}

const testQuestions: TestQuestion[] = [
  {
    question: 'What are your pricing tiers?',
    expectedKeywords: ['Essentials', '£169', 'Growth', '£289', 'Premium', '£449']
  },
  {
    question: 'How fast does it pay for itself?',
    expectedKeywords: ['2.1 days', 'first week', 'ROI', 'pays for itself']
  },
  {
    question: 'What\'s different from a regular answering service?',
    expectedKeywords: ['Safe Mode', 'medical-specific', '24/7', 'AI']
  },
  {
    question: 'Do you have any case studies?',
    expectedKeywords: ['Dr. Sarah Chen', 'Elite Aesthetics', '£127k', 'revenue']
  },
  {
    question: 'What if patients don\'t like talking to AI?',
    expectedKeywords: ['94%', 'can\'t tell', 'AI']
  }
];

async function testRAGSystem() {
  console.log('🚀 Starting RAG System Validation Tests\n');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  for (let i = 0; i < testQuestions.length; i++) {
    const { question, expectedKeywords } = testQuestions[i];
    console.log(`\n📝 Test ${i + 1}/5: "${question}"`);
    console.log('-'.repeat(60));

    try {
      // Call the RAG search endpoint to get KB context
      const response = await axios.post(
        `${API_BASE_URL}/api/knowledge-base/search`,
        {
          query: question,
          limit: 5
        },
        {
          timeout: 10000
        }
      );

      const { results, count } = response.data;

      if (!results || results.length === 0) {
        console.log('❌ FAILED: No KB chunks returned');
        console.log('   → Webhook did not retrieve any relevant context');
        failedTests++;
        continue;
      }

      // Combine all returned chunks
      const combinedContext = results
        .map((r: any) => r.content)
        .join(' ')
        .toLowerCase();

      // Check for expected keywords
      const foundKeywords = expectedKeywords.filter(keyword =>
        combinedContext.includes(keyword.toLowerCase())
      );

      const matchPercentage = (foundKeywords.length / expectedKeywords.length) * 100;

      console.log(`✅ Retrieved ${count} relevant KB chunks`);
      console.log(`📊 Keyword Match: ${foundKeywords.length}/${expectedKeywords.length} (${matchPercentage.toFixed(0)}%)`);
      console.log(`\n📌 Found Keywords:`);
      foundKeywords.forEach(kw => console.log(`   ✓ "${kw}"`));

      if (foundKeywords.length > 0) {
        console.log(`\n📄 Sample Context:`);
        const preview = results[0].content.substring(0, 150) + '...';
        console.log(`   "${preview}"`);
      }

      if (matchPercentage >= 60) {
        console.log(`\n✅ TEST PASSED (${matchPercentage.toFixed(0)}% match)`);
        passedTests++;
      } else {
        console.log(`\n⚠️  TEST PARTIAL (${matchPercentage.toFixed(0)}% match - expected 60%+)`);
        failedTests++;
      }
    } catch (error: any) {
      console.log(`❌ FAILED: ${error?.message}`);
      if (error?.response?.data) {
        console.log(`   Error: ${JSON.stringify(error.response.data)}`);
      }
      failedTests++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passedTests}/5`);
  console.log(`❌ Failed: ${failedTests}/5`);
  console.log(`📈 Success Rate: ${((passedTests / 5) * 100).toFixed(0)}%`);

  if (passedTests === 5) {
    console.log('\n🎉 ALL TESTS PASSED! RAG System is working correctly.');
    console.log('→ Webhook is retrieving KB context');
    console.log('→ Vapi assistant can now answer questions using Knowledge Base');
    process.exit(0);
  } else if (passedTests >= 3) {
    console.log('\n✅ MOST TESTS PASSED! RAG System is mostly working.');
    console.log('→ Some KB chunks may need better indexing');
    process.exit(0);
  } else {
    console.log('\n❌ TESTS FAILED! RAG System needs debugging.');
    console.log('→ Check KB upload and chunking');
    console.log('→ Verify embeddings are generated');
    console.log('→ Check vector search configuration');
    process.exit(1);
  }
}

// Run tests
testRAGSystem().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
