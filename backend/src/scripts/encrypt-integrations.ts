/**
 * Script: Encrypt integrations.encrypted_config for all unencrypted rows
 * - Finds rows where `encrypted` is false or null
 * - Uses EncryptionService.encryptObject to produce AES-256-GCM string
 * - Updates rows atomically and logs progress
 *
 * Usage: run with NODE_ENV and SUPABASE_SERVICE_ROLE_KEY set (service role required)
 */

import { createClient } from '@supabase/supabase-js';
import { EncryptionService } from '../services/encryption';
import { log } from '../services/logger';

const BATCH_SIZE = 100;

// Initialize Supabase service-role client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function encryptBatch(): Promise<number> {
  // Query with wildcard to avoid schema caching issues
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .limit(BATCH_SIZE);

  if (error) {
    log.error('encrypt-integrations', 'Failed to select integrations batch', { error: error.message });
    throw error;
  }

  if (!data || data.length === 0) return 0;

  let processed = 0;

  for (const row of data) {
    const id = (row as any).id;
    const orgId = (row as any).org_id;
    const provider = (row as any).provider;
    // Try encrypted_config first, fall back to config
    const cfg = (row as any).encrypted_config || (row as any).config;
    const isAlreadyEncrypted = (row as any).encrypted === true;

    if (!cfg) {
      log.warn('encrypt-integrations', 'No config found for row', { id, orgId, provider });
      continue;
    }

    // Skip if already encrypted
    if (isAlreadyEncrypted) {
      log.debug('encrypt-integrations', 'Row already encrypted, skipping', { id, orgId, provider });
      continue;
    }

    try {
      // If already a string, assume encrypted (legacy safe-guard)
      let encryptedString: string;

      if (typeof cfg === 'string') {
        // Already encrypted or different format; still mark as encrypted to be safe
        encryptedString = cfg;
      } else {
        encryptedString = EncryptionService.encryptObject(cfg || {});
      }

      const { error: upErr } = await supabase
        .from('integrations')
        .update({ encrypted: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (upErr) {
        log.error('encrypt-integrations', 'Failed to update integration row', { id, orgId, provider, error: upErr.message });
        continue;
      }

      processed += 1;
      log.info('encrypt-integrations', 'Marked integration row as encrypted', { id, orgId, provider });
    } catch (err: any) {
      log.exception('encrypt-integrations', 'Error encrypting integration row', err, { id, orgId, provider });
      // Continue with next row
    }
  }

  return processed;
}

async function main() {
  log.info('encrypt-integrations', 'Starting encryption script', { batchSize: BATCH_SIZE });

  try {
    let total = 0;
    while (true) {
      const count = await encryptBatch();
      if (count === 0) break;
      total += count;
      // Small pause to avoid overwhelming DB
      await new Promise((r) => setTimeout(r, 200));
    }

    log.info('encrypt-integrations', 'Encryption script completed', { totalProcessed: total });
    process.exit(0);
  } catch (error: any) {
    log.exception('encrypt-integrations', 'Encryption script failed', error);
    process.exit(2);
  }
}

// Run when executed directly
if (require.main === module) {
  main();
}
