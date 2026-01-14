
// Main async function to handle dynamic imports
(async () => {
  const { v4: uuidv4 } = await import('uuid');
  const axios = (await import('axios')).default;

  const API_URL = 'http://localhost:3001/api/handoff';

  // Mock Data
  // Use a valid UUID for a new organization/tenant context test
  const MOCK_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
  const SESSION_ID = uuidv4();
  const PATIENT_PHONE = '+15550262026';

  async function testHandoffUpdate() {
    console.log('\n--- Testing Handoff Update ---');
    try {
        const payload = {
            sessionId: SESSION_ID,
            tenantId: MOCK_TENANT_ID,
            timestamp: new Date().toISOString(),
            patient: {
                phoneNumber: PATIENT_PHONE,
                name: 'Jane Doe',
                isNewPatient: true
            },
            intent: {
                serviceCategory: 'consultation',
                specificInterest: 'Botox',
                urgency: 'medium'
            },
            status: 'otp_sent',
            verification: {
                status: 'pending',
                method: 'sms_otp',
                timestamp: new Date().toISOString()
            },
            conversationSummary: "Patient interested in Botox, prices discussed, waiting for OTP."
        };

        const res = await axios.post(`${API_URL}/update`, payload);
        console.log('Update Response:', res.data);
    } catch (e: any) {
        console.log('Update Error:', e.response?.data || e.message);
    }
}

async function testHandoffContext() {
    console.log('\n--- Testing Handoff Context Retrieval ---');
    try {
        const res = await axios.get(`${API_URL}/context`, {
            params: {
                tenantId: MOCK_TENANT_ID,
                patientPhone: PATIENT_PHONE
            }
        });
        console.log('Context Response:', JSON.stringify(res.data, null, 2));

        if (res.data.found && res.data.context.sessionId === SESSION_ID) {
            console.log('✅ SUCCESS: Context retrieved correctly.');
        } else {
            console.log('❌ FAILURE: Context mismatch or not found.');
        }

    } catch (e: any) {
        console.log('Context Error:', e.response?.data || e.message);
    }
}

async function run() {
    console.log('Verify Handoff API Endpoints on ' + API_URL);
    // Note: This test requires the server to be running and DB connected.
    // If DB has constraints on tenant_id, this might fail with foreign key violation 
    // unless '00000000-0000-0000-0000-000000000000' covers a valid org or RLS is permissive enough for insert.
    // The previous migration set up a foreign key to organizations(id), so we might need a real org ID.
    // However, usually manual testing uses a known ID. 
    // For this automated script, we'll try to execute it but handle failure gracefully.

    await testHandoffUpdate();
    await testHandoffContext();
  }

  run();
})();
