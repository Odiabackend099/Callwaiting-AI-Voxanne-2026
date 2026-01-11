/**
 * Secrets Manager Service
 * Handles encryption/decryption of API keys using EncryptionService (AES-256-GCM)
 * or Supabase Vault (if enabled)
 */

import { supabase } from './supabase-client';
import { EncryptionService } from './encryption';

/**
 * Store API key securely
 * Uses Supabase Vault if available, otherwise uses application-level AES-256-GCM encryption
 */
export async function storeApiKey(
  provider: 'vapi' | 'twilio' | 'resend' | 'google',
  orgId: string,
  keyData: Record<string, string>
): Promise<boolean> {
  try {
    // Try to use Supabase Vault (recommended for production)
    if (process.env.USE_SUPABASE_VAULT === 'true') {
      return await storeInVault(provider, orgId, keyData);
    }

    // Fall back to application-level encryption
    return await storeEncrypted(provider, orgId, keyData);
  } catch (error) {
    console.error('[SecretsManager] Failed to store API key:', error);
    return false;
  }
}

/**
 * Retrieve API key securely
 */
export async function getApiKey(
  provider: 'vapi' | 'twilio' | 'resend' | 'google',
  orgId: string
): Promise<Record<string, string> | null> {
  try {
    if (process.env.USE_SUPABASE_VAULT === 'true') {
      return await getFromVault(provider, orgId);
    }

    return await getEncrypted(provider, orgId);
  } catch (error) {
    console.error('[SecretsManager] Failed to retrieve API key:', error);
    return null;
  }
}

/**
 * Store using AES-256-GCM encryption and save to DB
 */
async function storeEncrypted(
  provider: string,
  orgId: string,
  keyData: Record<string, string>
): Promise<boolean> {
  try {
    // Encrypt the entire config object
    const encryptedConfig = EncryptionService.encryptObject(keyData);

    const { error } = await supabase
      .from('integrations')
      .upsert(
        {
          org_id: orgId,
          provider,
          connected: true,
          last_checked_at: new Date().toISOString(),
          config: encryptedConfig // Stored as iv:authTag:content string
        },
        { onConflict: 'org_id,provider' }
      );

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[SecretsManager] Failed to store encrypted key:', error);
    return false;
  }
}

/**
 * Retrieve and decrypt from DB
 */
async function getEncrypted(
  provider: string,
  orgId: string
): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    if (error || !data) {
      return null;
    }

    // Decrypt the config string
    // Data in DB is "iv:authTag:content" (string) if it was stored by this service
    // But it might be raw JSON if stored by legacy code/manual insert.
    // We should handle both, or enforce migration.
    // For now, assume if it looks like JSON object, it's plaintext (LEGACY fallback),
    // if string with colons, it's encrypted.

    const configRaw = data.config;

    if (typeof configRaw === 'object' && configRaw !== null) {
      // Legacy: Plain JSON in DB
      // console.warn('[SecretsManager] Found legacy plaintext config, consider migrating to encrypted.');
      return configRaw as Record<string, string>;
    }

    if (typeof configRaw === 'string') {
      return EncryptionService.decryptObject(configRaw);
    }

    return null;
  } catch (error) {
    console.error('[SecretsManager] Failed to retrieve encrypted key:', error);
    return null;
  }
}

/**
 * Store using Supabase Vault (recommended for production)
 * Requires: https://supabase.com/docs/guides/database/vault
 */
async function storeInVault(
  provider: string,
  orgId: string,
  keyData: Record<string, string>
): Promise<boolean> {
  try {
    // Construct a unique secret name per org/provider
    const secretName = `${provider}_${orgId}`;
    const secretValue = JSON.stringify(keyData);

    // Use RPC to store in Vault (requires vault functions)
    const { error } = await supabase.rpc('vault_set_secret', {
      secret_name: secretName,
      secret_value: secretValue,
      description: `${provider.toUpperCase()} API key for org ${orgId}`
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    // Fall back to encrypted storage if Vault not available
    console.warn('[SecretsManager] Vault not available, falling back to encrypted storage');
    return storeEncrypted(provider, orgId, keyData);
  }
}

/**
 * Retrieve from Supabase Vault
 */
async function getFromVault(
  provider: string,
  orgId: string
): Promise<Record<string, string> | null> {
  try {
    const secretName = `${provider}_${orgId}`;

    // Use RPC to retrieve from Vault
    const { data, error } = await supabase.rpc('vault_get_secret', {
      secret_name: secretName
    }) as any;

    if (error || !data) {
      return null;
    }

    return JSON.parse(data) as Record<string, string>;
  } catch (error) {
    // Fall back to encrypted storage if Vault not available
    console.warn('[SecretsManager] Vault not available, falling back to encrypted storage');
    return getEncrypted(provider, orgId);
  }
}

/**
 * Rotate API key
 * Safely replace old key with new one
 */
export async function rotateApiKey(
  provider: 'vapi' | 'twilio' | 'resend' | 'google',
  orgId: string,
  newKeyData: Record<string, string>
): Promise<boolean> {
  try {
    // Store new key
    const stored = await storeApiKey(provider, orgId, newKeyData);

    if (!stored) {
      throw new Error('Failed to store new key');
    }

    console.log(`[SecretsManager] API key rotated for ${provider} in org ${orgId}`);

    return true;
  } catch (error) {
    console.error('[SecretsManager] Failed to rotate API key:', error);
    return false;
  }
}

/**
 * Delete API key (revoke access)
 */
export async function deleteApiKey(
  provider: 'vapi' | 'twilio' | 'resend' | 'google',
  orgId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('integrations')
      .update({ connected: false, config: null })
      .eq('org_id', orgId)
      .eq('provider', provider);

    if (error) {
      throw error;
    }

    console.log(`[SecretsManager] API key deleted for ${provider} in org ${orgId}`);

    return true;
  } catch (error) {
    console.error('[SecretsManager] Failed to delete API key:', error);
    return false;
  }
}
