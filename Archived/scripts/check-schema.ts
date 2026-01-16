import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSchema() {
    // We can't query information_schema easily with JS client without knowing if it's exposed
    // But we can insert a dummy record to fail and see valid columns in error or try to select 1 row
    const { data, error } = await supabase.from('knowledge_base_chunks').select('*').limit(1);

    if (error) {
        console.log("Error selecting:", error.message);
    } else {
        if (data && data.length > 0) {
            console.log("Existing columns:", Object.keys(data[0]));
        } else {
            console.log("Table empty, can't infer columns easily via select *");
            // Try to insert with invalid column to provoke strict error if possible or just guess
        }
    }
}
checkSchema();
