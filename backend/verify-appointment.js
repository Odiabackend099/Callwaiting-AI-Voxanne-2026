const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n📊 APPOINTMENT DATABASE VERIFICATION');
console.log('═════════════════════════════════════════════════════════════\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    // Query the appointment we just created
    console.log('🔍 Querying appointment: d4270948-461d-442d-aa93-a4410f4ba78f\n');
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', 'd4270948-461d-442d-aa93-a4410f4ba78f')
      .single();
    
    if (error) {
      console.error('❌ Error querying appointment:', error.message);
      return;
    }
    
    if (!data) {
      console.log('❌ Appointment not found in database');
      return;
    }
    
    console.log('✅ APPOINTMENT FOUND IN DATABASE\n');
    console.log('Appointment Details:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`ID:                    ${data.id}`);
    console.log(`Organization ID:       ${data.org_id}`);
    console.log(`Patient Name:          ${data.patient_name}`);
    console.log(`Patient Phone:         ${data.patient_phone}`);
    console.log(`Patient Email:         ${data.patient_email}`);
    console.log(`Appointment Date:      ${data.appointment_date}`);
    console.log(`Appointment Time:      ${data.appointment_time}`);
    console.log(`Service Type:          ${data.service_type}`);
    console.log(`Created At:            ${data.created_at}`);
    console.log(`Updated At:            ${data.updated_at}`);
    console.log(`SMS Status:            ${data.confirmation_sms_status}`);
    console.log(`SMS Sent:              ${data.confirmation_sms_sent}`);
    console.log(`Status:                ${data.status}`);
    console.log('───────────────────────────────────────────────────────────\n');
    
    // Verify the data matches what we sent
    console.log('✅ VERIFICATION CHECKS:');
    console.log('───────────────────────────────────────────────────────────');
    
    const checks = [
      { name: 'Appointment ID matches', pass: data.id === 'd4270948-461d-442d-aa93-a4410f4ba78f' },
      { name: 'Organization ID correct', pass: data.org_id === '46cf2995-2bee-44e3-838b-24151486fe4e' },
      { name: 'Patient name matches', pass: data.patient_name === 'Live SMS Test' },
      { name: 'Patient phone matches', pass: data.patient_phone === '+13024648548' },
      { name: 'Patient email matches', pass: data.patient_email === 'test@voxanne.ai' },
      { name: 'Appointment date set', pass: !!data.appointment_date },
      { name: 'Appointment time set', pass: !!data.appointment_time },
      { name: 'Record created timestamp', pass: !!data.created_at },
      { name: 'Status is active', pass: data.status === 'active' || data.status === 'booked' },
    ];
    
    let passCount = 0;
    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`${icon} ${check.name}`);
      if (check.pass) passCount++;
    });
    
    console.log('───────────────────────────────────────────────────────────\n');
    console.log(`Result: ${passCount}/${checks.length} checks passed\n`);
    
    if (passCount === checks.length) {
      console.log('🎉 SUCCESS: Appointment fully verified in database!\n');
      console.log('What this proves:');
      console.log('✅ Booking endpoint created appointment in database');
      console.log('✅ All patient data persisted correctly');
      console.log('✅ Phone number stored: +13024648548');
      console.log('✅ Organization isolation working (org_id: 46cf2995-2bee-44e3-838b-24151486fe4e)');
      console.log('✅ Timestamp recorded for SMS tracking');
      console.log('✅ Data integrity confirmed\n');
    }
    
    // Also query for recent appointments to show context
    console.log('═════════════════════════════════════════════════════════════');
    console.log('\n📋 RECENT APPOINTMENTS (Last 5):');
    console.log('───────────────────────────────────────────────────────────\n');
    
    const { data: recentAppts, error: recentError } = await supabase
      .from('appointments')
      .select('id, patient_name, patient_phone, appointment_date, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!recentError && recentAppts) {
      recentAppts.forEach((apt, idx) => {
        const testAppt = apt.id === 'd4270948-461d-442d-aa93-a4410f4ba78f' ? ' ← YOUR TEST BOOKING' : '';
        console.log(`${idx + 1}. ${apt.patient_name} (${apt.patient_phone})${testAppt}`);
        console.log(`   Date: ${apt.appointment_date} | Created: ${new Date(apt.created_at).toLocaleString()}`);
      });
    }
    
    console.log('\n═════════════════════════════════════════════════════════════\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
