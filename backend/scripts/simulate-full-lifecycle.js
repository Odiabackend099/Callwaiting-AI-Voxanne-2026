/**
 * ULTIMATE END-TO-END SIMULATION: Full Vapi Lifecycle (4-Step Flow)
 *
 * Tests complete patient interaction:
 * 1. RECOGNITION: lookupContact
 * 2. NEGOTIATION: checkAvailability
 * 3. CONVERSION: bookClinicAppointment
 * 4. CLOSURE: endCall
 */

const https = require('https');

const BACKEND_URL = 'localhost:3001';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const TEST_PHONE = '+2348141995397';
const TEST_DATE = '2026-02-06';
const TEST_TIME = '16:00';

console.log('🎓 ULTIMATE END-TO-END SIMULATION: Full Vapi Lifecycle');
console.log('='.repeat(70));
console.log('Testing: Recognition → Negotiation → Conversion → Closure');
console.log('Patient: Austyn (+2348141995397)');
console.log('Date: February 6, 2026 at 4:00 PM');
console.log('='.repeat(70));

function makeRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: BACKEND_URL.split(':')[0],
      port: parseInt(BACKEND_URL.split(':')[1]),
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Invalid JSON', raw: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

(async () => {
  const results = {
    step1_lookup: null,
    step2_check: null,
    step3_book: null,
    step4_end: null
  };

  try {
    // STEP 1: RECOGNITION (lookupContact)
    console.log('\n[STEP 1/4] RECOGNITION: lookupContact');
    console.log('-'.repeat(70));

    const lookupPayload = {
      message: {
        toolCalls: [{
          id: 'test-lookup-001',
          function: {
            name: 'lookupContact',
            arguments: JSON.stringify({ phone: TEST_PHONE })
          }
        }]
      }
    };

    console.log('Request:', JSON.stringify(lookupPayload, null, 2));

    try {
      const lookupResponse = await makeRequest('/api/vapi/tools/lookupContact', lookupPayload);
      results.step1_lookup = lookupResponse;
      console.log('Response:', JSON.stringify(lookupResponse, null, 2));

      if (lookupResponse && lookupResponse.results) {
        console.log('✅ PASS: Contact lookup executed');
      } else {
        console.log('⚠️  WARN: Unexpected response format');
      }
    } catch (error) {
      results.step1_lookup = { error: error.message };
      console.log('❌ FAIL:', error.message);
    }

    // STEP 2: NEGOTIATION (checkAvailability)
    console.log('\n[STEP 2/4] NEGOTIATION: checkAvailability');
    console.log('-'.repeat(70));

    const checkPayload = {
      message: {
        toolCalls: [{
          id: 'test-check-001',
          function: {
            name: 'checkAvailability',
            arguments: JSON.stringify({ date: TEST_DATE, time: TEST_TIME })
          }
        }]
      }
    };

    console.log('Request: checkAvailability for', TEST_DATE, 'at', TEST_TIME);

    try {
      const checkResponse = await makeRequest('/api/vapi/tools/checkAvailability', checkPayload);
      results.step2_check = checkResponse;
      console.log('Response:', JSON.stringify(checkResponse, null, 2));

      if (checkResponse && checkResponse.results && checkResponse.results[0]?.available) {
        console.log('✅ PASS: Slot available for booking');
      } else {
        console.log('⚠️  WARN: Slot not available or unexpected format');
      }
    } catch (error) {
      results.step2_check = { error: error.message };
      console.log('❌ FAIL:', error.message);
    }

    // STEP 3: CONVERSION (bookClinicAppointment)
    console.log('\n[STEP 3/4] CONVERSION: bookClinicAppointment');
    console.log('-'.repeat(70));

    const bookPayload = {
      message: {
        toolCalls: [{
          id: 'test-book-001',
          function: {
            name: 'bookClinicAppointment',
            arguments: JSON.stringify({
              patientName: 'Austyn FullCycle',
              phone: TEST_PHONE,
              serviceType: 'Consultation',
              date: TEST_DATE,
              time: TEST_TIME,
              notes: 'Full lifecycle test run'
            })
          }
        }],
        call: {
          customer: {
            number: TEST_PHONE
          }
        }
      }
    };

    console.log('Request: Book appointment for Austyn FullCycle');

    try {
      const bookResponse = await makeRequest('/api/vapi/tools/bookClinicAppointment', bookPayload);
      results.step3_book = bookResponse;
      console.log('Response:', JSON.stringify(bookResponse, null, 2));

      if (bookResponse && bookResponse.results && bookResponse.results[0]?.success) {
        console.log('✅ PASS: Appointment booked successfully');
        console.log('   Appointment ID:', bookResponse.results[0].appointmentId);
      } else {
        console.log('❌ FAIL: Booking failed or unexpected format');
      }
    } catch (error) {
      results.step3_book = { error: error.message };
      console.log('❌ FAIL:', error.message);
    }

    // STEP 4: CLOSURE (endCall)
    console.log('\n[STEP 4/4] CLOSURE: endCall');
    console.log('-'.repeat(70));

    const endPayload = {
      message: {
        toolCalls: [{
          id: 'test-end-001',
          function: {
            name: 'endCall',
            arguments: JSON.stringify({
              reason: 'customer_booked',
              summary: 'Customer booked for Feb 6th.'
            })
          }
        }]
      }
    };

    console.log('Request: End call with reason "customer_booked"');

    try {
      const endResponse = await makeRequest('/api/vapi/tools/endCall', endPayload);
      results.step4_end = endResponse;
      console.log('Response:', JSON.stringify(endResponse, null, 2));

      if (endResponse && endResponse.results) {
        console.log('✅ PASS: Call ended successfully');
      } else {
        console.log('⚠️  WARN: Unexpected response format');
      }
    } catch (error) {
      results.step4_end = { error: error.message };
      console.log('❌ FAIL:', error.message);
    }

    // FINAL REPORT
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(70));
    console.log('');
    console.log('| Step | Tool                    | Status    | Details                |');
    console.log('|------|-------------------------|-----------|------------------------|');

    const step1Status = results.step1_lookup && !results.step1_lookup.error ? '✅ PASS' : '❌ FAIL';
    const step1Detail = results.step1_lookup?.results ? 'Contact lookup OK' : 'See logs';
    console.log(`| 1    | lookupContact           | ${step1Status} | ${step1Detail.padEnd(22)} |`);

    const step2Status = results.step2_check && results.step2_check.results && results.step2_check.results[0]?.available ? '✅ PASS' : '❌ FAIL';
    const step2Detail = step2Status === '✅ PASS' ? 'Slot available' : 'See logs';
    console.log(`| 2    | checkAvailability       | ${step2Status} | ${step2Detail.padEnd(22)} |`);

    const step3Status = results.step3_book && results.step3_book.results && results.step3_book.results[0]?.success ? '✅ PASS' : '❌ FAIL';
    const step3Detail = step3Status === '✅ PASS' ? results.step3_book.results[0].appointmentId?.substring(0, 22) : 'See logs';
    console.log(`| 3    | bookClinicAppointment   | ${step3Status} | ${step3Detail.padEnd(22)} |`);

    const step4Status = results.step4_end && !results.step4_end.error ? '✅ PASS' : '❌ FAIL';
    const step4Detail = results.step4_end?.results ? 'Call closed OK' : 'See logs';
    console.log(`| 4    | endCall                 | ${step4Status} | ${step4Detail.padEnd(22)} |`);

    console.log('');
    console.log('='.repeat(70));

    const allPassed = step1Status === '✅ PASS' && step2Status === '✅ PASS' && step3Status === '✅ PASS' && step4Status === '✅ PASS';

    if (allPassed) {
      console.log('🎉 ALL 4 STEPS PASSED - Backend is BULLETPROOF!');
    } else {
      console.log('⚠️  Some steps failed - Review logs above');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
})();
