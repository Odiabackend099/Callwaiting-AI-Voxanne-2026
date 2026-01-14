/**
 * MOCK AI Conversation Simulation (No Live Integrations Required)
 * Demonstrates the complete flow with mock responses
 */

// Main async function to handle dynamic imports
(async () => {
  const { v4: uuidv4 } = await import('uuid');

  const CONFIG = {
    adminPhone: '+13024648548',        // Business owner (receives hot lead alerts)
    patientPhone: '+13024648548',      // Test patient (receives booking confirmation)
    patientName: 'John Doe',
    orgId: 'a0000000-0000-0000-0000-000000000001',
    appointmentDate: '2026-01-15',
    serviceType: 'Botox Consultation'
  };

console.log('═══════════════════════════════════════════════════════════');
console.log('    MEDICAL AI RECEPTIONIST - MOCK SIMULATION');
console.log('═══════════════════════════════════════════════════════════\n');

async function simulateMockConversation() {
    const sessionId = uuidv4();
    const selectedSlot = `${CONFIG.appointmentDate}T14:00:00Z`; // 2:00 PM

    console.log('📞 INCOMING CALL RECEIVED');
    console.log(`   From: ${CONFIG.patientPhone}`);
    console.log(`   Session: ${sessionId}\n`);

    // === SARAH (Screening Agent) ===
    console.log('🤖 SARAH: "Thank you for calling! I\'m Sarah, your AI assistant.');
    console.log('           How can I help you today?"\n');

    console.log('👤 PATIENT: "Hi, I\'d like to schedule a Botox consultation."\n');

    console.log('🤖 SARAH: "Perfect! Let me check our availability.');
    console.log('           What date works best for you?"\n');

    console.log(`👤 PATIENT: "${CONFIG.appointmentDate} if possible."\n`);

    // === STEP 1: Check Availability (MOCK) ===
    console.log('⚙️  [SYSTEM] Checking calendar availability...');
    const mockSlots = ['09:00 AM', '10:30 AM', '02:00 PM', '03:30 PM', '04:45 PM'];
    console.log(`✅ [SYSTEM] Found ${mockSlots.length} available slots\n`);

    console.log('🤖 SARAH: "Great news! We have openings at:');
    mockSlots.forEach(slot => console.log(`           • ${slot}`));
    console.log('           Which time works best for you?"\n');

    console.log('👤 PATIENT: "2:00 PM would be perfect!"\n');

    // === STEP 2: Reserve Slot (MOCK) ===
    console.log('⚙️  [SYSTEM] Reserving slot 2:00 PM (5-minute hold)...');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    console.log(`✅ [SYSTEM] Slot reserved until ${new Date(expiresAt).toLocaleTimeString()}\n`);

    console.log('🤖 SARAH: "Perfect! I\'ve reserved 2:00 PM for you.');
    console.log('           Can I get your full name please?"\n');

    console.log(`👤 PATIENT: "${CONFIG.patientName}"\n`);

    // === STEP 3: Send OTP (MOCK) ===
    const otp = Math.floor(1000 + Math.random() * 9000);
    console.log('⚙️  [SYSTEM] Sending SMS verification code...\n');

    console.log('📱 SMS TO PATIENT (+13024648548):');
    console.log('   ┌─────────────────────────────────────────────┐');
    console.log(`   │ Your verification code is: ${otp}           │`);
    console.log('   │ Valid for 5 minutes.                        │');
    console.log('   │ Reply STOP to opt-out.                      │');
    console.log('   │ Msg&Data rates may apply.                   │');
    console.log('   └─────────────────────────────────────────────┘\n');

    console.log(`✅ [SYSTEM] SMS sent successfully (SID: SM${uuidv4().substring(0, 32)})\n`);

    console.log('🤖 SARAH: "I just sent a verification code to your phone.');
    console.log('           Can you read it back to me?"\n');

    console.log(`👤 PATIENT: "Yes, it's ${otp}"\n`);

    // === STEP 4: Update Handoff State (MOCK) ===
    console.log('⚙️  [SYSTEM] Updating handoff state...');
    const handoffContext = {
        sessionId,
        tenantId: CONFIG.orgId,
        patient: {
            phoneNumber: CONFIG.patientPhone,
            name: CONFIG.patientName,
            isNewPatient: true
        },
        intent: {
            serviceCategory: 'procedure',
            specificInterest: CONFIG.serviceType,
            urgency: 'medium'
        },
        status: 'verified',
        scheduling: {
            proposedTime: selectedSlot,
            slotExpiresAt: expiresAt
        },
        verification: {
            status: 'verified',
            method: 'sms_otp',
            timestamp: new Date().toISOString()
        },
        conversationSummary: `Patient ${CONFIG.patientName} verified via OTP. Interested in ${CONFIG.serviceType} on ${CONFIG.appointmentDate} at 2:00 PM.`
    };

    console.log('✅ [SYSTEM] Handoff state saved to database\n');

    // === STEP 5: Handoff to Voxan ===
    console.log('⚙️  [SYSTEM] Transferring to Voxan (Receptionist Agent)...\n');

    console.log('🤖 SARAH: "Thank you for verifying! I\'m now connecting you');
    console.log('           to Voxan who will finalize your appointment."\n');

    console.log('─────────────── AGENT HANDOFF ───────────────\n');

    // === VOXAN (Receptionist) ===
    console.log('⚙️  [SYSTEM] Voxan retrieving handoff context...');
    console.log(`✅ [SYSTEM] Context loaded for ${CONFIG.patientPhone}\n`);

    console.log(`🤖 VOXAN: "Hello ${CONFIG.patientName}! I see Sarah already helped you`);
    console.log(`           reserve a ${CONFIG.serviceType} appointment for`);
    console.log(`           ${CONFIG.appointmentDate} at 2:00 PM.`);
    console.log('           Are you ready to confirm this booking?"\n');

    console.log('👤 PATIENT: "Yes, that\'s perfect!"\n');

    // === STEP 6: Confirm Appointment (MOCK) ===
    console.log('⚙️  [SYSTEM] Creating Google Calendar event...');
    const appointmentId = uuidv4();
    console.log(`✅ [SYSTEM] Event created (ID: ${appointmentId})\n`);

    console.log('🤖 VOXAN: "Wonderful! Your appointment is confirmed.');
    console.log('           I\'ll send you a confirmation text right now."\n');

    // === STEP 7: Send Confirmation SMS to Patient ===
    console.log('📱 SMS TO PATIENT (+13024648548):');
    console.log('   ┌─────────────────────────────────────────────┐');
    console.log('   │ ✅ Appointment Confirmed!                   │');
    console.log(`   │ ${CONFIG.serviceType}                        │`);
    console.log(`   │ Date: Jan 15, 2026 at 2:00 PM              │`);
    console.log('   │ Clinic Address: [From Google Calendar]      │');
    console.log('   │ To reschedule: [Link]                       │');
    console.log('   │ Reply STOP to opt-out.                      │');
    console.log('   └─────────────────────────────────────────────┘\n');

    console.log(`✅ [SYSTEM] Confirmation SMS sent (SID: SM${uuidv4().substring(0, 32)})\n`);

    // === STEP 8: Send Hot Lead Alert to Admin ===
    console.log('⚙️  [SYSTEM] Sending hot lead alert to admin...\n');

    console.log('📱 SMS TO ADMIN (+13024648548):');
    console.log('   ┌─────────────────────────────────────────────┐');
    console.log('   │ 🔥 NEW HOT LEAD BOOKED!                     │');
    console.log(`   │ Patient: ${CONFIG.patientName}                           │`);
    console.log(`   │ Service: ${CONFIG.serviceType}               │`);
    console.log(`   │ Date: Jan 15, 2026 @ 2:00 PM               │`);
    console.log(`   │ Phone: ${CONFIG.patientPhone}                │`);
    console.log('   │ Status: ✅ Confirmed & Paid                 │');
    console.log('   │ View in Dashboard: [Link]                   │');
    console.log('   └─────────────────────────────────────────────┘\n');

    console.log(`✅ [SYSTEM] Admin notification sent (SID: SM${uuidv4().substring(0, 32)})\n`);

    console.log('🤖 VOXAN: "All set! You should receive a confirmation text.');
    console.log('           We look forward to seeing you on January 15th.');
    console.log('           Have a wonderful day!"\n');

    console.log('👤 PATIENT: "Thank you so much!"\n');

    console.log('📞 [CALL ENDED]\n');

    // === SUMMARY ===
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SIMULATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 TRANSACTION SUMMARY:');
    console.log(`   Session ID:        ${sessionId}`);
    console.log(`   Appointment ID:    ${appointmentId}`);
    console.log(`   Patient:           ${CONFIG.patientName}`);
    console.log(`   Patient Phone:     ${CONFIG.patientPhone}`);
    console.log(`   Admin Notified:    ${CONFIG.adminPhone}`);
    console.log(`   Service:           ${CONFIG.serviceType}`);
    console.log(`   Date/Time:         ${CONFIG.appointmentDate} 2:00 PM`);
    console.log(`   Verification:      ✅ SMS OTP Verified`);
    console.log(`   Calendar Event:    ✅ Created`);
    console.log(`   Patient SMS:       ✅ Sent`);
    console.log(`   Admin SMS:         ✅ Sent`);
    console.log(`   Handoff Status:    ✅ Sarah → Voxan`);
    console.log('');

    console.log('📋 HANDOFF CONTEXT STORED:');
    console.log(JSON.stringify(handoffContext, null, 2));
    console.log('');
  }

  simulateMockConversation();
})();
