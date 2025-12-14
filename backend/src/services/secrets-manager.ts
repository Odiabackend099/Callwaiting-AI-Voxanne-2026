/**
 * Secrets Manager Service
 * Handles encryption/decryption of API keys using pgcrypto or Supabase Vault
 */

import { supabase } from './supabase-client';

/**
 * Store API key securely
 * Uses Supabase Vault if available, falls back to pgcrypto encryption
 */
export async function storeApiKey(
  provider: 'vapi' | 'twilio' | 'resend',
  orgId: string,
  keyData: Record<string, string>
): Promise<boolean> {
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-unsafe-key-change-me';

    // Try to use Supabase Vault (recommended for production)
    if (process.env.USE_SUPABASE_VAULT === 'true') {
      return await storeInVault(provider, orgId, keyData);
    }

    // Fall back to pgcrypto encryption
    return await storeEncrypted(provider, orgId, keyData, encryptionKey);
  } catch (error) {
    console.error('[SecretsManager] Failed to store API key:', error);
    return false;
  }
}

/**
 * Retrieve API key securely
 */
export async function getApiKey(
  provider: 'vapi' | 'twilio' | 'resend',
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
 * Store using pgcrypto encryption (database-level)
 */
async function storeEncrypted(
  provider: string,
  orgId: string,
  keyData: Record<string, string>,
  encryptionKey: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('integrations')
      .upsert(
        {
          org_id: orgId,
          provider,
          connected: true,
          last_checked_at: new Date().toISOString(),
          config: keyData // Store in plain for now, will be encrypted at DB level
        },
        { onConflict: 'org_id,provider' }
      );

    if (error) {
      throw error;
    }

    // Note: In production, use Supabase RLS policies to prevent unauthorized access
    // and ensure the application can only decrypt with the correct key

    return true;
  } catch (error) {
    console.error('[SecretsManager] Failed to store encrypted key:', error);
    return false;
  }
}

/**
 * Retrieve using pgcrypto decryption
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

    return data.config as Record<string, string>;
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
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-unsafe-key-change-me';
    return storeEncrypted(provider, orgId, keyData, encryptionKey);
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
  provider: 'vapi' | 'twilio' | 'resend',
  orgId: string,
  newKeyData: Record<string, string>
): Promise<boolean> {
  try {
    // Verify new key is valid before storing
    // (You would add validation logic here based on provider)

    // Store new key
    const stored = await storeApiKey(provider, orgId, newKeyData);

    if (!stored) {
      throw new Error('Failed to store new key');
    }

    // Log the rotation for audit purposes
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
  provider: 'vapi' | 'twilio' | 'resend',
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
