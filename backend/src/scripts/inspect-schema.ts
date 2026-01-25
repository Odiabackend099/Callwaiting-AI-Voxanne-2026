
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspectSchema() {
    console.log('🔍 Inspecting Table Schemas...\n');

    // Check appointments
    const { data: appts, error: apptError } = await supabase
        .from('appointments')
        .select('*')
        .limit(1);

    if (apptError) {
        console.error('❌ Error fetching appointments:', apptError.message);
    } else if (appts && appts.length > 0) {
        console.log('📋 Appointments Table Columns:');
        console.log(Object.keys(appts[0]).join(', '));
    } else {
        console.log('⚠️ Appointments table is empty, cannot infer schema from data.');
    }

    // Check patients (if exists)
    const { data: patients, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .limit(1);

    if (patientError) {
        console.log('ℹ️ Patients table check:', patientError.message);
    } else if (patients && patients.length > 0) {
        console.log('\n📋 Patients Table Columns:');
        console.log(Object.keys(patients[0]).join(', '));
    }
}

inspectSchema();
