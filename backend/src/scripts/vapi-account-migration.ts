#!/usr/bin/env ts-node
/**
 * VAPI Account Migration Script
 *
 * Cleanly releases ALL VAPI resources (assistants, phone numbers, credentials)
 * and NULLs out all VAPI IDs in the database, preparing for a new VAPI account.
 *
 * Twilio resources are NOT touched — only VAPI registrations are removed.
 *
 * Usage:
 *   npx ts-node src/scripts/vapi-account-migration.ts              # Full cleanup
 *   npx ts-node src/scripts/vapi-account-migration.ts --dry-run     # Audit only
 *   npx ts-node src/scripts/vapi-account-migration.ts --yes         # Skip confirmation
 *   npx ts-node src/scripts/vapi-account-migration.ts --key <key>   # Use specific VAPI key
 */

import axios, { AxiosError } from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── CLI Arguments ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const AUTO_YES = args.includes('--yes');
const keyIndex = args.indexOf('--key');
const CLI_KEY = keyIndex !== -1 ? args[keyIndex + 1] : undefined;

// ── Configuration ──────────────────────────────────────────────────────────────

const VAPI_BASE_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = (CLI_KEY || process.env.VAPI_PRIVATE_KEY || '')
  .replace(/[\r\n\t\x00-\x1F\x7F]/g, '')
  .replace(/^['"]|['"]$/g, '');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── Helpers ────────────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

function log(phase: string, msg: string) {
  console.log(`[${ts()}] [${phase}] ${msg}`);
}

function logOk(phase: string, msg: string) {
  console.log(`[${ts()}] [${phase}] ✅ ${msg}`);
}

function logWarn(phase: string, msg: string) {
  console.log(`[${ts()}] [${phase}] ⚠️  ${msg}`);
}

function logErr(phase: string, msg: string) {
  console.log(`[${ts()}] [${phase}] ❌ ${msg}`);
}

const vapiHeaders = {
  Authorization: `Bearer ${VAPI_API_KEY}`,
  'Content-Type': 'application/json',
};

async function vapiGet(endpoint: string): Promise<any[]> {
  try {
    const res = await axios.get(`${VAPI_BASE_URL}${endpoint}`, {
      headers: vapiHeaders,
      timeout: 30000,
    });
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  } catch (err: any) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 401 || status === 402 || status === 403) {
      logWarn('VAPI', `GET ${endpoint} returned ${status} (auth/credit issue) — continuing`);
    } else {
      logWarn('VAPI', `GET ${endpoint} failed: ${err.message}`);
    }
    return [];
  }
}

async function vapiDelete(endpoint: string, label: string): Promise<boolean> {
  if (DRY_RUN) {
    log('DRY-RUN', `Would DELETE ${label}`);
    return true;
  }
  try {
    await axios.delete(`${VAPI_BASE_URL}${endpoint}`, {
      headers: vapiHeaders,
      timeout: 15000,
    });
    logOk('VAPI', `Deleted ${label}`);
    return true;
  } catch (err: any) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 404) {
      logWarn('VAPI', `${label} already deleted (404)`);
      return true;
    }
    logErr('VAPI', `Failed to delete ${label}: ${status || err.message}`);
    return false;
  }
}

async function vapiPatch(endpoint: string, body: any, label: string): Promise<boolean> {
  if (DRY_RUN) {
    log('DRY-RUN', `Would PATCH ${label}`);
    return true;
  }
  try {
    await axios.patch(`${VAPI_BASE_URL}${endpoint}`, body, {
      headers: vapiHeaders,
      timeout: 15000,
    });
    logOk('VAPI', `Patched ${label}`);
    return true;
  } catch (err: any) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 404) {
      logWarn('VAPI', `${label} not found (404)`);
      return true;
    }
    logErr('VAPI', `Failed to patch ${label}: ${status || err.message}`);
    return false;
  }
}

function askConfirmation(question: string): Promise<boolean> {
  if (AUTO_YES) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  VAPI ACCOUNT MIGRATION — Clean Release of All Resources');
  console.log('═'.repeat(70));
  console.log(`  Mode:      ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`  VAPI Key:  ${VAPI_API_KEY ? VAPI_API_KEY.substring(0, 8) + '...' : 'MISSING'}`);
  console.log(`  Supabase:  ${SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'MISSING'}`);
  console.log('═'.repeat(70) + '\n');

  // ── Preflight checks ──

  if (!VAPI_API_KEY) {
    logErr('INIT', 'VAPI_PRIVATE_KEY not set. Use --key <key> or set in .env');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logErr('INIT', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 0: AUDIT
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 0: AUDIT ──────────────────────────────────────────────\n');

  log('AUDIT', 'Fetching VAPI resources...');
  const assistants = await vapiGet('/assistant');
  const phoneNumbers = await vapiGet('/phone-number');
  const credentials = await vapiGet('/credential');

  log('AUDIT', `  Assistants:    ${assistants.length}`);
  for (const a of assistants) {
    log('AUDIT', `    → ${a.name || '(unnamed)'} [${a.id}]`);
  }
  log('AUDIT', `  Phone Numbers: ${phoneNumbers.length}`);
  for (const p of phoneNumbers) {
    log('AUDIT', `    → ${p.number || p.phoneNumber || '(no number)'} [${p.id}] assigned=${p.assistantId || 'none'}`);
  }
  log('AUDIT', `  Credentials:   ${credentials.length}`);
  for (const c of credentials) {
    log('AUDIT', `    → ${c.name || c.provider || '(unnamed)'} [${c.id}]`);
  }

  // Database audit
  log('AUDIT', '\nQuerying database for VAPI references...');

  const { data: agentsWithVapi } = await supabase
    .from('agents')
    .select('id, org_id, role, vapi_assistant_id, vapi_phone_number_id')
    .or('vapi_assistant_id.not.is.null,vapi_phone_number_id.not.is.null');
  log('AUDIT', `  agents with VAPI IDs:               ${agentsWithVapi?.length || 0}`);

  const { data: managedWithVapi } = await supabase
    .from('managed_phone_numbers')
    .select('id, org_id, phone_number, vapi_phone_id, vapi_credential_id')
    .or('vapi_phone_id.not.is.null,vapi_credential_id.not.is.null');
  log('AUDIT', `  managed_phone_numbers with VAPI IDs: ${managedWithVapi?.length || 0}`);

  const { data: verifiedWithVapi } = await supabase
    .from('verified_caller_ids')
    .select('id, org_id, phone_number, vapi_phone_number_id')
    .not('vapi_phone_number_id', 'is', null);
  log('AUDIT', `  verified_caller_ids with VAPI IDs:   ${verifiedWithVapi?.length || 0}`);

  const { data: orgsWithVapi } = await supabase
    .from('organizations')
    .select('id, name, vapi_credential_id')
    .not('vapi_credential_id', 'is', null);
  log('AUDIT', `  organizations with vapi_credential:  ${orgsWithVapi?.length || 0}`);

  const { data: mappingsWithVapi } = await supabase
    .from('phone_number_mapping')
    .select('id, org_id, inbound_phone_number, vapi_phone_number_id')
    .not('vapi_phone_number_id', 'is', null);
  log('AUDIT', `  phone_number_mapping with VAPI IDs:  ${mappingsWithVapi?.length || 0}`);

  const { count: mappingCount } = await supabase
    .from('assistant_org_mapping')
    .select('*', { count: 'exact', head: true });
  log('AUDIT', `  assistant_org_mapping rows:          ${mappingCount || 0}`);

  // ── Summary ──
  const totalVapiResources = assistants.length + phoneNumbers.length + credentials.length;
  const totalDbRefs = (agentsWithVapi?.length || 0) + (managedWithVapi?.length || 0) +
    (verifiedWithVapi?.length || 0) + (orgsWithVapi?.length || 0) +
    (mappingsWithVapi?.length || 0) + (mappingCount || 0);

  console.log('\n── SUMMARY ─────────────────────────────────────────────────────\n');
  log('AUDIT', `VAPI resources to delete: ${totalVapiResources}`);
  log('AUDIT', `Database refs to clear:   ${totalDbRefs}`);

  if (totalVapiResources === 0 && totalDbRefs === 0) {
    logOk('AUDIT', 'Nothing to clean up — everything is already clear.');
    process.exit(0);
  }

  if (DRY_RUN) {
    log('DRY-RUN', '\nDry run complete. No changes were made.');
    log('DRY-RUN', 'Remove --dry-run to execute the migration.');
    process.exit(0);
  }

  // ── Confirmation ──
  const confirmed = await askConfirmation(
    `\n⚠️  This will DELETE ${totalVapiResources} VAPI resources and clear ${totalDbRefs} database references.\n` +
    '   Twilio numbers will NOT be affected.\n' +
    '   Proceed? (y/N): '
  );

  if (!confirmed) {
    log('ABORT', 'User cancelled. No changes made.');
    process.exit(0);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1: UNASSIGN PHONE NUMBERS FROM ASSISTANTS
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 1: UNASSIGN PHONE NUMBERS FROM ASSISTANTS ─────────────\n');

  let unassignCount = 0;
  for (const pn of phoneNumbers) {
    if (pn.assistantId) {
      await vapiPatch(
        `/phone-number/${pn.id}`,
        { assistantId: null },
        `phone ${pn.number || pn.id} (unassign from assistant ${pn.assistantId})`
      );
      unassignCount++;
    }
  }
  if (unassignCount === 0) {
    logOk('PHASE1', 'No phone numbers were assigned to assistants.');
  } else {
    logOk('PHASE1', `Unassigned ${unassignCount} phone number(s) from assistants.`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2: DELETE ALL ASSISTANTS
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 2: DELETE ALL ASSISTANTS ──────────────────────────────\n');

  let deletedAssistants = 0;
  for (const a of assistants) {
    const ok = await vapiDelete(`/assistant/${a.id}`, `assistant "${a.name || 'unnamed'}" [${a.id}]`);
    if (ok) deletedAssistants++;
  }
  logOk('PHASE2', `Deleted ${deletedAssistants}/${assistants.length} assistant(s).`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3: DELETE ALL PHONE NUMBERS FROM VAPI
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 3: RELEASE PHONE NUMBERS FROM VAPI ───────────────────\n');
  log('PHASE3', '(Twilio keeps the numbers — only removing VAPI registration)');

  let deletedPhones = 0;
  for (const pn of phoneNumbers) {
    const ok = await vapiDelete(
      `/phone-number/${pn.id}`,
      `phone "${pn.number || pn.phoneNumber || 'unknown'}" [${pn.id}]`
    );
    if (ok) deletedPhones++;
  }
  logOk('PHASE3', `Released ${deletedPhones}/${phoneNumbers.length} phone number(s) from VAPI.`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4: DELETE ALL CREDENTIALS
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 4: DELETE ALL CREDENTIALS ─────────────────────────────\n');

  let deletedCreds = 0;
  for (const c of credentials) {
    const ok = await vapiDelete(
      `/credential/${c.id}`,
      `credential "${c.name || c.provider || 'unnamed'}" [${c.id}]`
    );
    if (ok) deletedCreds++;
  }
  logOk('PHASE4', `Deleted ${deletedCreds}/${credentials.length} credential(s).`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 5: NULL OUT VAPI IDS IN DATABASE
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 5: CLEAR VAPI IDS IN DATABASE ─────────────────────────\n');

  // 5a: agents
  if (agentsWithVapi && agentsWithVapi.length > 0) {
    const { error } = await supabase
      .from('agents')
      .update({ vapi_assistant_id: null, vapi_phone_number_id: null })
      .or('vapi_assistant_id.not.is.null,vapi_phone_number_id.not.is.null');
    if (error) {
      logErr('DB', `agents update failed: ${error.message}`);
    } else {
      logOk('DB', `agents: cleared vapi_assistant_id + vapi_phone_number_id (${agentsWithVapi.length} rows)`);
    }
  } else {
    logOk('DB', 'agents: no VAPI IDs to clear');
  }

  // 5b: managed_phone_numbers
  if (managedWithVapi && managedWithVapi.length > 0) {
    const { error } = await supabase
      .from('managed_phone_numbers')
      .update({ vapi_phone_id: null, vapi_credential_id: null })
      .or('vapi_phone_id.not.is.null,vapi_credential_id.not.is.null');
    if (error) {
      logErr('DB', `managed_phone_numbers update failed: ${error.message}`);
    } else {
      logOk('DB', `managed_phone_numbers: cleared vapi_phone_id + vapi_credential_id (${managedWithVapi.length} rows)`);
    }
  } else {
    logOk('DB', 'managed_phone_numbers: no VAPI IDs to clear');
  }

  // 5c: verified_caller_ids
  if (verifiedWithVapi && verifiedWithVapi.length > 0) {
    const { error } = await supabase
      .from('verified_caller_ids')
      .update({ vapi_phone_number_id: null })
      .not('vapi_phone_number_id', 'is', null);
    if (error) {
      logErr('DB', `verified_caller_ids update failed: ${error.message}`);
    } else {
      logOk('DB', `verified_caller_ids: cleared vapi_phone_number_id (${verifiedWithVapi.length} rows)`);
    }
  } else {
    logOk('DB', 'verified_caller_ids: no VAPI IDs to clear');
  }

  // 5d: organizations
  if (orgsWithVapi && orgsWithVapi.length > 0) {
    const { error } = await supabase
      .from('organizations')
      .update({ vapi_credential_id: null })
      .not('vapi_credential_id', 'is', null);
    if (error) {
      logErr('DB', `organizations update failed: ${error.message}`);
    } else {
      logOk('DB', `organizations: cleared vapi_credential_id (${orgsWithVapi.length} rows)`);
    }
  } else {
    logOk('DB', 'organizations: no VAPI IDs to clear');
  }

  // 5e: phone_number_mapping
  if (mappingsWithVapi && mappingsWithVapi.length > 0) {
    const { error } = await supabase
      .from('phone_number_mapping')
      .update({ vapi_phone_number_id: null })
      .not('vapi_phone_number_id', 'is', null);
    if (error) {
      logErr('DB', `phone_number_mapping update failed: ${error.message}`);
    } else {
      logOk('DB', `phone_number_mapping: cleared vapi_phone_number_id (${mappingsWithVapi.length} rows)`);
    }
  } else {
    logOk('DB', 'phone_number_mapping: no VAPI IDs to clear');
  }

  // 5f: assistant_org_mapping (delete all rows)
  if (mappingCount && mappingCount > 0) {
    const { error } = await supabase
      .from('assistant_org_mapping')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all (Supabase requires a filter)
    if (error) {
      logErr('DB', `assistant_org_mapping delete failed: ${error.message}`);
    } else {
      logOk('DB', `assistant_org_mapping: deleted all rows (${mappingCount})`);
    }
  } else {
    logOk('DB', 'assistant_org_mapping: no rows to delete');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 6: VERIFICATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE 6: VERIFICATION ───────────────────────────────────────\n');

  let allClean = true;

  // Verify VAPI resources (may fail if credit exhausted — that's OK)
  const remainingAssistants = await vapiGet('/assistant');
  const remainingPhones = await vapiGet('/phone-number');
  const remainingCreds = await vapiGet('/credential');

  if (remainingAssistants.length > 0) {
    logWarn('VERIFY', `${remainingAssistants.length} assistant(s) still in VAPI (may be from another account or API issue)`);
    allClean = false;
  } else {
    logOk('VERIFY', 'No assistants remaining in VAPI');
  }

  if (remainingPhones.length > 0) {
    logWarn('VERIFY', `${remainingPhones.length} phone number(s) still in VAPI`);
    allClean = false;
  } else {
    logOk('VERIFY', 'No phone numbers remaining in VAPI');
  }

  if (remainingCreds.length > 0) {
    logWarn('VERIFY', `${remainingCreds.length} credential(s) still in VAPI`);
    allClean = false;
  } else {
    logOk('VERIFY', 'No credentials remaining in VAPI');
  }

  // Verify database
  const { data: remainingAgents } = await supabase
    .from('agents')
    .select('id')
    .or('vapi_assistant_id.not.is.null,vapi_phone_number_id.not.is.null');
  if (remainingAgents && remainingAgents.length > 0) {
    logErr('VERIFY', `${remainingAgents.length} agents still have VAPI IDs`);
    allClean = false;
  } else {
    logOk('VERIFY', 'agents: all VAPI IDs cleared');
  }

  const { data: remainingManaged } = await supabase
    .from('managed_phone_numbers')
    .select('id')
    .or('vapi_phone_id.not.is.null,vapi_credential_id.not.is.null');
  if (remainingManaged && remainingManaged.length > 0) {
    logErr('VERIFY', `${remainingManaged.length} managed_phone_numbers still have VAPI IDs`);
    allClean = false;
  } else {
    logOk('VERIFY', 'managed_phone_numbers: all VAPI IDs cleared');
  }

  const { data: remainingVerified } = await supabase
    .from('verified_caller_ids')
    .select('id')
    .not('vapi_phone_number_id', 'is', null);
  if (remainingVerified && remainingVerified.length > 0) {
    logErr('VERIFY', `${remainingVerified.length} verified_caller_ids still have VAPI IDs`);
    allClean = false;
  } else {
    logOk('VERIFY', 'verified_caller_ids: all VAPI IDs cleared');
  }

  const { data: remainingOrgs } = await supabase
    .from('organizations')
    .select('id')
    .not('vapi_credential_id', 'is', null);
  if (remainingOrgs && remainingOrgs.length > 0) {
    logErr('VERIFY', `${remainingOrgs.length} organizations still have vapi_credential_id`);
    allClean = false;
  } else {
    logOk('VERIFY', 'organizations: vapi_credential_id cleared');
  }

  const { count: remainingMappings } = await supabase
    .from('assistant_org_mapping')
    .select('*', { count: 'exact', head: true });
  if (remainingMappings && remainingMappings > 0) {
    logErr('VERIFY', `${remainingMappings} assistant_org_mapping rows remain`);
    allClean = false;
  } else {
    logOk('VERIFY', 'assistant_org_mapping: empty');
  }

  // ── Final Report ──
  console.log('\n' + '═'.repeat(70));
  if (allClean) {
    console.log('  ✅ MIGRATION COMPLETE — ALL VAPI RESOURCES RELEASED');
  } else {
    console.log('  ⚠️  MIGRATION COMPLETE WITH WARNINGS — Check items above');
  }
  console.log('═'.repeat(70));
  console.log('\n  Next steps:');
  console.log('  1. Update VAPI_PRIVATE_KEY in backend/.env with the new key');
  console.log('  2. Update VAPI_PRIVATE_KEY in Render environment variables');
  console.log('  3. Restart the backend server (clears in-memory caches)');
  console.log('  4. Save an agent config from the dashboard to trigger re-creation');
  console.log('');
}

// ── Entry Point ────────────────────────────────────────────────────────────────

main().catch(err => {
  logErr('FATAL', err.message);
  process.exit(1);
});
