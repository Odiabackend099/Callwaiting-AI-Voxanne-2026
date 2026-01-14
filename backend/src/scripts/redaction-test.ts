
import { RedactionService } from '../services/redaction-service';

function testRedaction() {
    console.log('🧪 UNIT TEST: Redaction Service');
    console.log('===============================');

    const testCases = [
        {
            input: "My name is John and I had a facelift yesterday. Call me at 07700 900123.",
            expectedContains: ["[REDACTED: MEDICAL]", "[REDACTED: PHONE]"],
            shouldNotContain: ["facelift", "07700 900123"]
        },
        {
            input: "I take insulin for my diabetes. Email: john@example.com",
            expectedContains: ["[REDACTED: MEDICAL]", "[REDACTED: EMAIL]"],
            shouldNotContain: ["insulin", "diabetes", "john@example.com"]
        },
        {
            input: "Scheduled for rhinoplasty on Monday. +1-555-0199 is my number.",
            expectedContains: ["[REDACTED: MEDICAL]", "[REDACTED: PHONE]"],
            shouldNotContain: ["rhinoplasty", "+1-555-0199"]
        }
    ];

    let passed = true;

    testCases.forEach((tc, i) => {
        const result = RedactionService.redact(tc.input);
        console.log(`\nCase ${i + 1}: Input: "${tc.input}"`);
        console.log(`        Result: "${result}"`);

        const missingExpected = tc.expectedContains.filter(e => !result.includes(e));
        const leaksFound = tc.shouldNotContain.filter(e => result.includes(e));

        if (missingExpected.length > 0) {
            console.error(`❌ FAIL: Missing redaction markers: ${missingExpected.join(', ')}`);
            passed = false;
        }
        if (leaksFound.length > 0) {
            console.error(`❌ FAIL: LEAKED SENSITIVE DATA: ${leaksFound.join(', ')}`);
            passed = false;
        }
    });

    if (passed) {
        console.log('\n✅ ALL REDACTION TESTS PASSED');
        process.exit(0);
    } else {
        console.log('\n❌ REDACTION TESTS FAILED');
        process.exit(1);
    }
}

testRedaction();
