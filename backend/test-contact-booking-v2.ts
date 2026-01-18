import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/vapi';
const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function testContactBooking() {
  console.log('Testing booking...\n');

  const timestamp = Date.now();
  const testEmail = `test-${timestamp}@example.com`;

  try {
    const response = await axios.post(`${BASE_URL}/tools/bookClinicAppointment`, {
      customer: {
        metadata: { org_id: orgId }
      },
      message: {
        toolCall: {
          function: {
            arguments: {
              org_id: orgId,
              appointmentDate: '2026-01-20',
              appointmentTime: '14:00',
              patientEmail: testEmail,
              patientPhone: '+1-555-0100',
              patientName: 'Test Patient',
              serviceType: 'Botox',
              duration: 30
            }
          }
        }
      }
    });

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('❌ Error:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
  }
}

testContactBooking();
