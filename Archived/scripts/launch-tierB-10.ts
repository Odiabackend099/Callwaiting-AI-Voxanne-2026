/**
 * Launch campaign for first 10 Tier B leads (safe warm-up).
 *
 * Usage (from backend folder):
 *   npx ts-node scripts/launch-tierB-10.ts
 */

import 'dotenv/config';
import axios from 'axios';

const backendUrl = process.env.BACKEND_URL || 'https://roxanne-vapi.onrender.com';

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

  console.log(`✔ Launching campaign for ${leadIds.length} Tier B leads`);

  const launchRes = await axios.post(`${backendUrl}/api/campaigns/launch`, {
    leadIds,
    sequenceName: 'tier_b_initial_10'
  });

  console.log('API response:', launchRes.data);
  console.log('✅ Done. Monitor metrics in /#/outreach and Resend dashboard.');
}

main().catch((err) => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
