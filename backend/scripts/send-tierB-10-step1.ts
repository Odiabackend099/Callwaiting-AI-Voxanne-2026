/**
 * Send step 1 campaign emails for first 10 Tier B leads.
 *
 * Usage (from backend folder):
 *   BACKEND_URL=http://localhost:3000 npm run send:tierB-10-step1
 */

import 'dotenv/config';
import axios from 'axios';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

async function main() {
  console.log('▶ Fetching Tier B leads...');

  const leadsRes = await axios.get(`${backendUrl}/api/campaigns/leads/B`);
  const leadsData = leadsRes.data;

  if (!leadsData.success || !Array.isArray(leadsData.leads) || leadsData.leads.length === 0) {
    console.log('No Tier B leads available.');
    return;
  }

  const selected = leadsData.leads.slice(0, 10);
  const leadIds = selected.map((l: any) => l.id);

  console.log(`✔ Sending step 1 emails for ${leadIds.length} Tier B leads via ${backendUrl}`);

  let sent = 0;
  let failed = 0;

  for (const leadId of leadIds) {
    try {
      const res = await axios.post(`${backendUrl}/api/campaigns/send-email`, {
        leadId,
        templateStep: 1
      });

      if (res.data?.success) {
        sent++;
        console.log(`  ✅ Sent to lead ${leadId}`);
      } else {
        failed++;
        console.log(`  ❌ Failed to send to lead ${leadId}:`, res.data);
      }
    } catch (err: any) {
      failed++;
      console.error(`  ❌ Error sending to lead ${leadId}:`, err.response?.data || err.message);
    }
  }

  console.log(`Done. Sent: ${sent}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Error in send-tierB-10-step1:', err.response?.data || err.message);
  process.exit(1);
});
