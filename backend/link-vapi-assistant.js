require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async function(){
  try {
    const agentId = '1823e3e5-ccde-44ec-a49d-794917463c49';
    const vapiId = '29aff438-c067-4def-8188-62aba91ca3b2';

    console.log('Updating agent', agentId, 'with vapi id', vapiId);
    const { data, error } = await supabase.from('agents').update({ vapi_assistant_id: vapiId }).eq('id', agentId);
    if (error) {
      console.error('Update failed:', error.message);
      process.exit(1);
    }
    console.log('Update result:', JSON.stringify(data, null, 2));

    const { data: row, error: e2 } = await supabase.from('agents').select('id,role,name,vapi_assistant_id').eq('id', agentId).single();
    if (e2) { console.error('Select failed:', e2.message); process.exit(1); }
    console.log('Row after update:', JSON.stringify(row, null, 2));
  } catch (e) {
    console.error('Unexpected error:', e.message);
    process.exit(1);
  }
})();
