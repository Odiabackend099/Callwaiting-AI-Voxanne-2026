/**
 * Live AI Conversation Simulation
 * Simulates Sarah (Screening Agent) → Voxan (Receptionist) handoff
 * with real SMS notifications
 */

import axios from 'axios';

const API_URL = 'http://localhost:3001';

// Main async function to handle dynamic imports
(async () => {
  const { v4: uuidv4 } = await import('uuid');

  // Configuration from user
  const CONFIG = {
    // Admin/Business Owner (receives hot lead notifications)
    adminPhone: '+13024648548',

    // Test Patient (client booking appointment)
    patientPhone: '+13024648548', // Using admin number for testing
    patientName: 'Test Patient',

    // Organization
    orgId: 'a0000000-0000-0000-0000-000000000001', // Default Organization

    // Appointment details
    appointmentDate: '2026-01-15',
    serviceType: 'consultation'
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log('    MEDICAL AI RECEPTIONIST - LIVE SIMULATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  async function simulateConversation() {
    const sessionId = uuidv4();

    console.log('📞 INCOMING CALL');
    console.log(`   Patient: ${CONFIG.patientName}`);
    console.log(`   Phone: ${CONFIG.patientPhone}`);
    console.log(`   Session ID: ${sessionId}\n`);

    // ========== STEP 1: Sarah checks availability ==========
    console.log('🤖 SARAH (Screening Agent):');
    console.log('   "Hi! I\'m Sarah from the clinic. How can I help you today?"\n');

    console.log('👤 PATIENT:');
    console.log(`   "I'd like to book a ${CONFIG.serviceType} appointment for ${CONFIG.appointmentDate}"\n`);

    console.log('🤖 SARAH:');
    console.log('   "Let me check our availability for you..."\n');

    try {
        console.log('📡 API Call: POST /api/vapi/tools/calendar/check');
        const availabilityResponse = await axios.post(`${API_URL}/api/vapi/tools/calendar/check`, {
            tenantId: CONFIG.orgId,
            date: CONFIG.appointmentDate,
            serviceType: CONFIG.serviceType
        });

        console.log('✅ Response:', availabilityResponse.data);
        console.log('');

        // ========== STEP 2: Patient selects slot ==========
        console.log('🤖 SARAH:');
        console.log('   "We have openings at 10:00 AM, 2:00 PM, and 3:30 PM. Which works best?"\n');

        console.log('👤 PATIENT:');
        console.log('   "2:00 PM works great!"\n');

        // ========== STEP 3: Reserve slot ==========
        const selectedSlot = `${CONFIG.appointmentDate}T14:00:00Z`;

        console.log('🤖 SARAH:');
        console.log('   "Perfect! Let me reserve that time for you..."\n');

        console.log('📡 API Call: POST /api/vapi/tools/calendar/reserve');
        const reserveResponse = await axios.post(`${API_URL}/api/vapi/tools/calendar/reserve`, {
            tenantId: CONFIG.orgId,
            slotId: selectedSlot,
            patientPhone: CONFIG.patientPhone,
            patientName: CONFIG.patientName
        });

        console.log('✅ Response:', reserveResponse.data);
        console.log('');

        // ========== STEP 4: Update handoff state ==========
        console.log('💾 Updating Handoff State...\n');

        const handoffContext = {
            sessionId: sessionId,
            tenantId: CONFIG.orgId,
            timestamp: new Date().toISOString(),
            patient: {
                phoneNumber: CONFIG.patientPhone,
                name: CONFIG.patientName,
                isNewPatient: true
            },
            intent: {
                serviceCategory: 'consultation',
                specificInterest: CONFIG.serviceType,
                urgency: 'medium'
            },
            status: 'slot_held',
            scheduling: {
                heldSlotId: uuidv4(),
                proposedTime: selectedSlot,
                slotExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            },
            conversationSummary: `Patient ${CONFIG.patientName} interested in ${CONFIG.serviceType}. Selected ${selectedSlot}.`
        };

        console.log('📡 API Call: POST /api/handoff/update');
        const handoffResponse = await axios.post(`${API_URL}/api/handoff/update`, handoffContext);

        console.log('✅ Response:', handoffResponse.data);
        console.log('');

        // ========== STEP 5: Send SMS to Patient ==========
        console.log('📱 SENDING SMS TO PATIENT...\n');

        console.log('📡 API Call: POST /api/vapi/tools/sms/send (Patient Confirmation)');
        const patientSmsResponse = await axios.post(`${API_URL}/api/vapi/tools/sms/send`, {
            tenantId: CONFIG.orgId,
            phoneNumber: CONFIG.patientPhone,
            messageType: 'confirmation',
            appointmentId: sessionId
        });

        console.log('✅ Response:', patientSmsResponse.data);
        console.log('');

        // ========== STEP 6: Send SMS to Admin (Hot Lead Alert) ==========
        console.log('📱 SENDING HOT LEAD ALERT TO ADMIN...\n');

        console.log('📡 API Call: POST /api/vapi/tools/sms/send (Admin Notification)');
        const adminSmsResponse = await axios.post(`${API_URL}/api/vapi/tools/sms/send`, {
            tenantId: CONFIG.orgId,
            phoneNumber: CONFIG.adminPhone,
            messageType: 'reminder',
            appointmentId: sessionId
        });

        console.log('✅ Response:', adminSmsResponse.data);
        console.log('');

        // ========== STEP 7: Voxan retrieves context (when patient calls back) ==========
        console.log('═══════════════════════════════════════════════════════════');
        console.log('⏰ 2 MINUTES LATER - PATIENT CALLS BACK');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('📡 API Call: GET /api/handoff/context');
        const contextResponse = await axios.get(`${API_URL}/api/handoff/context`, {
            params: {
                tenantId: CONFIG.orgId,
                patientPhone: CONFIG.patientPhone
            }
        });

        console.log('✅ Response:', JSON.stringify(contextResponse.data, null, 2));
        console.log('');

        if (contextResponse.data.found) {
            console.log('🤖 VOXAN (Receptionist):');
            console.log(`   "Hello ${CONFIG.patientName}! I see Sarah helped you reserve a ${CONFIG.serviceType} appointment`);
            console.log(`    for ${CONFIG.appointmentDate} at 2:00 PM. Are you ready to confirm?"\n`);
        }

        // ========== FINAL SUMMARY ==========
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ SIMULATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('📊 Summary:');
        console.log(`   • Session ID: ${sessionId}`);
        console.log(`   • Patient: ${CONFIG.patientName} (${CONFIG.patientPhone})`);
        console.log(`   • Admin Notified: ${CONFIG.adminPhone}`);
        console.log(`   • Appointment: ${selectedSlot}`);
        console.log(`   • Handoff Status: ${contextResponse.data.found ? '✅ Success' : '❌ Failed'}`);
        console.log('');

    } catch (error: any) {
        console.error('❌ ERROR:', error.response?.data || error.message);
        console.error('');

        if (error.response?.data?.details) {
            console.error('📝 Details:', error.response.data.details);
        }
    }
  }

  // Run simulation
  simulateConversation();
})();
