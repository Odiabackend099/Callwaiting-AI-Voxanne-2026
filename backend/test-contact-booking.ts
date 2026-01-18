import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/vapi';
const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function testContactBooking() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST: Contact Creation + Appointment Booking');
  console.log('='.repeat(80) + '\n');

  const testEmail = `test-${Date.now()}@example.com`;
  const testName = 'Test Patient';

  console.log(`📋 Testing with:`);
  console.log(`   Email: ${testEmail}`);
  console.log(`   Name: ${testName}`);
  console.log(`   Org ID: ${orgId}\n`);

  try {
    const response = await axios.post(`${BASE_URL}/tools/bookClinicAppointment`, {
      customer: {
        metadata: {
          org_id: orgId
        }
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
              patientName: testName,
              serviceType: 'Botox',
              duration: 30
            }
          }
        }
      }
    });

    console.log('✅ Response received\n');
    const result = JSON.parse(response.data.toolResult.content);

    if (result.success === false) {
      console.log('❌ Booking failed:');
      console.log(`   Error: ${result.error}`);
      console.log(`   Message: ${result.message}\n`);
      return;
    }

    console.log('✅ Booking successful!');
    console.log(`   Appointment ID: ${result.appointmentId}`);
    console.log(`   Scheduled: ${result.scheduledAt}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Speech: ${response.data.speech}\n`);

    // Now verify in database
    console.log('📊 Verifying in database...\n');

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      'https://lbjymlodxprzqgtyqtcq.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
      { auth: { persistSession: false } }
    );

    // Check if contact was created
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('email', testEmail)
      .single();

    if (!contact) {
      console.log('❌ Contact NOT found in database!');
      return;
    }

    console.log('✅ Contact created:');
    console.log(`   ID: ${contact.id}`);
    console.log(`   Name: ${contact.name}`);
    console.log(`   Email: ${contact.email}\n`);

    // Check if appointment is linked
    const { data: apt } = await supabase
      .from('appointments')
      .select('id, contact_id, service_type, status')
      .eq('id', result.appointmentId)
      .single();

    if (!apt) {
      console.log('❌ Appointment NOT found!');
      return;
    }

    console.log('✅ Appointment found:');
    console.log(`   ID: ${apt.id}`);
    console.log(`   Service: ${apt.service_type}`);
    console.log(`   Status: ${apt.status}`);

    if (apt.contact_id === contact.id) {
      console.log(`   Contact ID: ${apt.contact_id} ✅ LINKED\n`);
      console.log('🎉 SUCCESS: Contact created AND linked to appointment!\n');
    } else {
      console.log(`   Contact ID: ${apt.contact_id || 'NULL'} ❌ NOT LINKED\n`);
      console.log('❌ FAILURE: Appointment created but not linked to contact\n');
    }
  } catch (error: any) {
    console.error('❌ Error during test:');
    console.error(error.response?.data || error.message);
  }
}

testContactBooking();
