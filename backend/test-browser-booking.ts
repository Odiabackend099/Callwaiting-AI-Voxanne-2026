import axios from 'axios';

/**
 * Test the browser booking flow end-to-end
 * Simulates what happens when user clicks "Browser Test" and asks for booking
 */

async function testBrowserBooking() {
  console.log('🧪 Testing Browser Booking Flow\n');
  console.log('=' .repeat(60) + '\n');

  const backendUrl = 'http://localhost:3001';

  try {
    console.log('Step 1: Initialize web voice session (simulating browser test start)\n');

    // This would normally be called when user clicks "Browser Test" tab
    const sessionResponse = await axios.post(`${backendUrl}/api/web-voice/session`, {
      orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
      assistantId: '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada'
    });

    console.log('✅ Web voice session created');
    console.log(`   Session ID: ${sessionResponse.data.sessionId}\n`);

    console.log('Step 2: Simulate AI tool call to booking endpoint\n');

    // This is what happens when AI calls the bookClinicAppointment tool
    const bookingResponse = await axios.post(
      `${backendUrl}/api/vapi-tools/tools/bookClinicAppointment`,
      {
        appointmentDate: '2026-01-20',
        appointmentTime: '14:00',
        patientName: 'John Doe',
        patientEmail: 'john@example.com',
        serviceType: 'Consultation',
        orgId: '46cf2995-2bee-44e3-838b-24151486fe4e'
      }
    );

    console.log('✅ Booking tool called successfully');
    console.log(`   Response: ${JSON.stringify(bookingResponse.data, null, 2)}\n`);

    if (bookingResponse.data.success || bookingResponse.data.appointmentId) {
      console.log('=' .repeat(60));
      console.log('\n🎉 SUCCESS! BOOKING WORKS!\n');
      console.log('You can now:');
      console.log('  1. Open http://localhost:3000/dashboard/test-agent');
      console.log('  2. Click "Browser Test" tab');
      console.log('  3. Say: "I want to book an appointment for Tuesday at 2pm"');
      console.log('  4. Provide your name and email when asked');
      console.log('  5. AI will call the booking tool and create appointment');
      console.log('  6. Appointment will appear in Google Calendar\n');
      console.log('=' .repeat(60));
    } else {
      console.log('⚠️  Booking returned but may have failed');
      console.log(`   Response: ${JSON.stringify(bookingResponse.data, null, 2)}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('\n⚠️  Note: This test requires backend to be running');
    console.log('   Make sure: npm run dev is running in /backend');
  }
}

testBrowserBooking().catch(console.error);
