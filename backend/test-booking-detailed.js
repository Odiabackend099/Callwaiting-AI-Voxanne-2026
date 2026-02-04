/**
 * Detailed booking test to see full error message
 */

const http = require('http');

const data = JSON.stringify({
  message: {
    type: 'tool-call',
    toolCall: {
      id: 'test-book-detailed-001',
      type: 'function',
      function: {
        name: 'bookClinicAppointment',
        arguments: JSON.stringify({
          tenantId: '46cf2995-2bee-44e3-838b-24151486fe4e',
          customerName: 'Austyn Test',
          customerPhone: '+2348141995398',
          customerEmail: 'austyn.test@demo.com',
          appointmentDate: '2026-02-05',
          appointmentTime: '16:00',
          serviceType: 'consultation'
        })
      }
    }
  }
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/vapi/tools/bookClinicAppointment',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🧪 Testing bookClinicAppointment with detailed error logging...\n');

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => { body += chunk; });

  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}\n`);

    try {
      const result = JSON.parse(body);
      console.log('Full Response:');
      console.log(JSON.stringify(result, null, 2));

      if (result.result) {
        console.log('\nResult Details:');
        console.log('  Success:', result.result.success);
        console.log('  Error:', result.result.error || 'None');
        console.log('  Message:', result.result.message || 'None');

        if (result.result.success) {
          console.log('  Appointment ID:', result.result.appointmentId);
          console.log('\n✅ BOOKING SUCCEEDED');
        } else {
          console.log('\n❌ BOOKING FAILED');
        }
      }
    } catch (e) {
      console.log('Raw Response:', body);
      console.error('\nError parsing response:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
  process.exit(1);
});

req.write(data);
req.end();
