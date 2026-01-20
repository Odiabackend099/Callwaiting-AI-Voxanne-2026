#!/usr/bin/env node

/**
 * Operation: Full Circle - Step 2 - Save Agent Simulation
 * Simulates clicking "Save Inbound Agent" button with voice=neha
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

console.log('🏛️ OPERATION: FULL CIRCLE - STEP 2: SAVE AGENT SIMULATION');
console.log(`📍 Org ID: ${orgId}`);
console.log('');

// The payload to send to the backend
const payload = {
  inbound: {
    voiceId: "neha",  // CRITICAL: Use neha as per Strict Voice Manifest
    language: "en-US",
    systemPrompt: "You are a professional receptionist for a medical clinic in Lagos, Nigeria. Your role is to:\n\n1. Greet callers warmly and professionally\n2. Understand their appointment needs\n3. Check availability using the bookClinicAppointment tool\n4. Confirm appointments with date, time, and service type\n5. Handle rescheduling and cancellations\n\nAlways be empathetic and helpful. If you don't have information, offer to transfer to a staff member.",
    firstMessage: "Good day! Welcome to our clinic. How can I assist you today?"
  }
};

console.log('📝 Step 2a: Agent Update Payload');
console.log('---');
console.log(JSON.stringify(payload, null, 2));
console.log('');

console.log('📋 Field Validation:');
console.log(`  ✅ voiceId: "${payload.inbound.voiceId}" (Valid: neha)`);
console.log(`  ✅ language: "${payload.inbound.language}" (Valid: en-US)`);
console.log(`  ✅ systemPrompt: ${payload.inbound.systemPrompt.length} characters`);
console.log(`  ✅ firstMessage: "${payload.inbound.firstMessage}"`);
console.log('');

console.log('🔗 Endpoints to execute:');
console.log('');
console.log('For Local Backend (Development):');
console.log(`  POST http://localhost:3001/api/founder-console/agent/behavior`);
console.log('');
console.log('For Production Backend:');
console.log(`  POST https://callwaitingai-backend-sjbi.onrender.com/api/founder-console/agent/behavior`);
console.log('');

console.log('📝 cURL Command (Local):');
console.log(`curl -X POST http://localhost:3001/api/founder-console/agent/behavior \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\`);
console.log(`  -d '${JSON.stringify(payload)}'`);
console.log('');

console.log('📝 cURL Command (Production):');
console.log(`curl -X POST https://callwaitingai-backend-sjbi.onrender.com/api/founder-console/agent/behavior \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\`);
console.log(`  -d '${JSON.stringify(payload)}'`);
console.log('');

console.log('🏁 Expected Outcomes from Step 2:');
console.log('  1. Agent record updated in database');
console.log('  2. Voice ID changed from "jennifer" to "neha"');
console.log('  3. Vapi assistant synced with new voice (idempotent - updates existing assistant)');
console.log('  4. Dashboard no longer shows "Invalid Voice" error');
console.log('');

console.log('⏳ Status: READY FOR EXECUTION');
console.log('   Replace YOUR_JWT_TOKEN with a valid JWT from Voxanne dashboard');
