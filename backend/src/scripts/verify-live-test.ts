/**
 * Live Test Verification Script
 * Run after completing live Twilio call test
 * Automatically verifies database state and generates report
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

config({ path: path.join(__dirname, '../../.env') });

import { supabase } from '../services/supabase-client';

interface TestVerificationResult {
    testPhone: string;
    timestamp: string;
    appointment: any;
    hold: any;
    contact: any;
    followUpTask: any;
    success: boolean;
    issues: string[];
}

async function verifyLiveTest(testPhone: string) {
    console.log('🔍 LIVE TEST VERIFICATION');
    console.log('='.repeat(70));
    console.log(`Test Phone: ${testPhone}\n`);

    const result: TestVerificationResult = {
        testPhone,
        timestamp: new Date().toISOString(),
        appointment: null,
        hold: null,
        contact: null,
        followUpTask: null,
        success: false,
        issues: []
    };

    try {
        // 1. Check Contact Created
        console.log('📋 Step 1: Verifying Contact...');
        const { data: contact } = await supabase
            .from('contacts')
            .select('*')
            .ilike('phone', `%${testPhone.slice(-10)}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (contact) {
            result.contact = contact;
            console.log(`✅ Contact found: ${contact.name} (${contact.id})`);
            console.log(`   Service interests: ${contact.service_interests?.join(', ') || 'None'}`);
        } else {
            result.issues.push('Contact not found');
            console.log('❌ Contact not found');
        }

        // 2. Check Appointment Hold
        console.log('\n📋 Step 2: Verifying Appointment Hold...');
        const { data: hold } = await supabase
            .from('appointment_holds')
            .select('*')
            .ilike('patient_phone', `%${testPhone.slice(-10)}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (hold) {
            result.hold = hold;
            console.log(`✅ Hold found: ${hold.id}`);
            console.log(`   Status: ${hold.status}`);
            console.log(`   OTP Code: ${hold.otp_code}`);
            console.log(`   Verification attempts: ${hold.verification_attempts}`);

            if (hold.status !== 'confirmed') {
                result.issues.push(`Hold status is ${hold.status}, expected 'confirmed'`);
            }
        } else {
            result.issues.push('Appointment hold not found');
            console.log('❌ Hold not found');
        }

        // 3. Check Appointment Created
        if (contact) {
            console.log('\n📋 Step 3: Verifying Appointment...');
            const { data: appointment } = await supabase
                .from('appointments')
                .select('*')
                .eq('contact_id', contact.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (appointment) {
                result.appointment = appointment;
                console.log(`✅ Appointment found: ${appointment.id}`);
                console.log(`   Service: ${appointment.service_type}`);
                console.log(`   Scheduled: ${appointment.scheduled_at}`);
                console.log(`   Status: ${appointment.status}`);

                if (appointment.status !== 'confirmed') {
                    result.issues.push(`Appointment status is ${appointment.status}, expected 'confirmed'`);
                }
            } else {
                result.issues.push('Appointment not found');
                console.log('❌ Appointment not found');
            }
        }

        // 4. Check Follow-up Task (for abandoned calls)
        console.log('\n📋 Step 4: Checking Follow-up Task...');
        const { data: task } = await supabase
            .from('follow_up_tasks')
            .select('*')
            .contains('metadata', { patient_phone: testPhone })
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (task) {
            result.followUpTask = task;
            console.log(`✅ Follow-up task found: ${task.id}`);
            console.log(`   Type: ${task.task_type}`);
            console.log(`   Service: ${task.service_context}`);
            console.log(`   Status: ${task.status}`);
        } else {
            console.log('ℹ️  No follow-up task (expected for completed bookings)');
        }

        // Final Assessment
        console.log('\n' + '='.repeat(70));
        console.log('📊 VERIFICATION SUMMARY');
        console.log('='.repeat(70));

        const hasContact = !!result.contact;
        const hasHold = !!result.hold;
        const hasAppointment = !!result.appointment;
        const holdConfirmed = result.hold?.status === 'confirmed';
        const appointmentConfirmed = result.appointment?.status === 'confirmed';

        result.success = hasContact && hasHold && hasAppointment && holdConfirmed && appointmentConfirmed;

        console.log(`Contact Created: ${hasContact ? '✅' : '❌'}`);
        console.log(`Hold Created: ${hasHold ? '✅' : '❌'}`);
        console.log(`Hold Confirmed: ${holdConfirmed ? '✅' : '❌'}`);
        console.log(`Appointment Created: ${hasAppointment ? '✅' : '❌'}`);
        console.log(`Appointment Confirmed: ${appointmentConfirmed ? '✅' : '❌'}`);

        if (result.issues.length > 0) {
            console.log('\n⚠️  ISSUES FOUND:');
            result.issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
        }

        console.log('\n' + '='.repeat(70));
        if (result.success) {
            console.log('STATUS: ✅ LIVE TEST PASSED');
            console.log('System is ready for pilot clinic deployment!');
        } else {
            console.log('STATUS: ❌ LIVE TEST FAILED');
            console.log('Review issues above and retry test.');
        }
        console.log('='.repeat(70));

        // Save report
        const reportPath = path.join(__dirname, '../../live-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
        console.log(`\n📄 Report saved: ${reportPath}`);

    } catch (error: any) {
        console.error('\n❌ VERIFICATION ERROR:', error.message);
        result.issues.push(`Verification error: ${error.message}`);
    }

    return result;
}

// Run verification
const testPhone = process.argv[2] || '+447123456789';
verifyLiveTest(testPhone);
