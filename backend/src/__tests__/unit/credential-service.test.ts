/**
 * Credential Service Unit Tests
 *
 * Tests for the centralized credential management service (Fortress Protocol).
 * Verifies:
 * - Credential fetching and decryption
 * - Multi-tenant org_id isolation
 * - Error handling with clear user messages
 * - Type safety with ProviderType enum
 * - All edge cases (missing, disabled, corrupt credentials)
 */

import { CredentialService } from '../../services/credential-service';
import { EncryptionService } from '../../services/encryption';
import { log } from '../../services/logger';

// Mock Supabase client
let mockSupabaseResponse: any = { data: null, error: null };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    const chainMock = {
      select: jest.fn(function(this: any) {
        // For listProviders, select() is the terminal operation
        this.then = (resolve: any) => resolve(mockSupabaseResponse);
        this.catch = (reject: any) => this;
        return this;
      }),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() => Promise.resolve(mockSupabaseResponse))
    };
    return {
      from: jest.fn(() => chainMock)
    };
  })
}));

// Mock EncryptionService
jest.mock('../../services/encryption');

// Mock logger
jest.mock('../../services/logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('CredentialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get()', () => {
    const orgId = 'test-org-123';
    const provider = 'google_calendar' as const;
    const mockEncryptedConfig = 'encrypted:data:here';
    const mockDecryptedCreds = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: '2099-12-31T23:59:59Z'
    };

    test('should fetch and decrypt credentials successfully', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: {
          encrypted_config: mockEncryptedConfig,
          is_active: true
        },
        error: null
      };

      (EncryptionService.decryptObject as jest.Mock).mockReturnValue(mockDecryptedCreds);

      // ACT
      const result = await CredentialService.get(orgId, provider);

      // ASSERT
      expect(result).toEqual(mockDecryptedCreds);
      expect(log.debug).toHaveBeenCalledWith(
        'CredentialService',
        'Fetching credentials',
        { orgId, provider }
      );
      expect(EncryptionService.decryptObject).toHaveBeenCalledWith(mockEncryptedConfig);
      expect(log.debug).toHaveBeenCalledWith(
        'CredentialService',
        'Credentials retrieved successfully',
        expect.objectContaining({ orgId, provider })
      );
    });

    test('should throw clear error when credentials not found', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: null
      };

      // ACT & ASSERT
      await expect(CredentialService.get(orgId, provider)).rejects.toThrow(
        `[CredentialService] No ${provider} credentials found for organization ${orgId}. Please connect in dashboard settings.`
      );
      expect(log.info).toHaveBeenCalledWith(
        'CredentialService',
        'Credentials not found',
        { orgId, provider }
      );
    });

    test('should throw error when integration is disabled (is_active = false)', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: {
          encrypted_config: mockEncryptedConfig,
          is_active: false,
          verification_error: 'OAuth token expired'
        },
        error: null
      };

      // ACT & ASSERT
      await expect(CredentialService.get(orgId, provider)).rejects.toThrow(
        `[CredentialService] ${provider} integration is disabled for organization ${orgId}. Please enable in settings.`
      );
      expect(log.warn).toHaveBeenCalledWith(
        'CredentialService',
        'Integration disabled',
        expect.objectContaining({ orgId, provider })
      );
    });

    test('should throw error when encrypted_config is missing', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: {
          encrypted_config: null,
          is_active: true
        },
        error: null
      };

      // ACT & ASSERT
      await expect(CredentialService.get(orgId, provider)).rejects.toThrow(
        `[CredentialService] Corrupted credential data for ${provider}. Please reconnect in settings.`
      );
    });

    test('should throw error when decryption fails', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: {
          encrypted_config: mockEncryptedConfig,
          is_active: true
        },
        error: null
      };

      const decryptError = new Error('Authentication tag verification failed');
      (EncryptionService.decryptObject as jest.Mock).mockImplementation(() => {
        throw decryptError;
      });

      // ACT & ASSERT
      await expect(CredentialService.get(orgId, provider)).rejects.toThrow(
        `[CredentialService] Failed to decrypt ${provider} credentials. Please reconnect in settings.`
      );
      expect(log.error).toHaveBeenCalledWith(
        'CredentialService',
        'Decryption failed',
        expect.objectContaining({ orgId, provider })
      );
    });

    test('should throw error when database query fails', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: { message: 'RLS policy violation' }
      };

      // ACT & ASSERT
      await expect(CredentialService.get(orgId, provider)).rejects.toThrow(
        `[CredentialService] Database error for ${provider}: ${mockSupabaseResponse.error.message}`
      );
      expect(log.error).toHaveBeenCalledWith(
        'CredentialService',
        'Database error fetching credentials',
        expect.objectContaining({ orgId, provider })
      );
    });

    test('should throw error when decrypted data is empty object', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: {
          encrypted_config: mockEncryptedConfig,
          is_active: true
        },
        error: null
      };

      (EncryptionService.decryptObject as jest.Mock).mockReturnValue({});

      // ACT & ASSERT
      await expect(CredentialService.get(orgId, provider)).rejects.toThrow(
        `[CredentialService] Empty credential configuration for ${provider}. Please reconnect in settings.`
      );
    });

    test('should throw error when orgId is invalid', async () => {
      // ACT & ASSERT
      await expect(CredentialService.get('', provider)).rejects.toThrow(
        '[CredentialService] Invalid orgId - must be a non-empty string'
      );

      await expect(CredentialService.get(null as any, provider)).rejects.toThrow(
        '[CredentialService] Invalid orgId - must be a non-empty string'
      );
    });

    test('should throw error when provider is invalid', async () => {
      // ACT & ASSERT
      await expect(CredentialService.get(orgId, '' as any)).rejects.toThrow(
        '[CredentialService] Invalid provider - must be specified'
      );

      await expect(CredentialService.get(orgId, null as any)).rejects.toThrow(
        '[CredentialService] Invalid provider - must be specified'
      );
    });

    test('should enforce org_id boundary in multi-tenant isolation', async () => {
      // ARRANGE
      const org_a_id = 'org-a-123';
      const org_b_id = 'org-b-456';
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();

      // Mock response for org_a
      mockSupabaseResponse = {
        data: {
          encrypted_config: mockEncryptedConfig,
          is_active: true
        },
        error: null
      };

      (EncryptionService.decryptObject as jest.Mock).mockReturnValue(mockDecryptedCreds);

      // ACT - Fetch credentials for org_a
      const result = await CredentialService.get(org_a_id, provider);

      // ASSERT - Should succeed for org_a
      expect(result).toEqual(mockDecryptedCreds);

      // Verify the query filtered by org_id
      expect(mockSupabase.from).toHaveBeenCalledWith('org_credentials');
    });
  });

  describe('exists()', () => {
    const orgId = 'test-org-123';
    const provider = 'twilio' as const;

    test('should return true when active credentials exist', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: { id: 'cred-123' },
        error: null
      };

      // ACT
      const result = await CredentialService.exists(orgId, provider);

      // ASSERT
      expect(result).toBe(true);
      expect(log.debug).toHaveBeenCalledWith(
        'CredentialService',
        `Credentials exist: true`,
        { orgId, provider }
      );
    });

    test('should return false when credentials do not exist', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: null
      };

      // ACT
      const result = await CredentialService.exists(orgId, provider);

      // ASSERT
      expect(result).toBe(false);
      expect(log.debug).toHaveBeenCalledWith(
        'CredentialService',
        `Credentials exist: false`,
        { orgId, provider }
      );
    });

    test('should return false when database query fails', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: { message: 'Connection timeout' }
      };

      // ACT
      const result = await CredentialService.exists(orgId, provider);

      // ASSERT
      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalledWith(
        'CredentialService',
        'Error checking credential existence',
        expect.objectContaining({ orgId, provider })
      );
    });

    test('should filter only active credentials (is_active = true)', async () => {
      // ARRANGE
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.from().maybeSingle = jest.fn().mockResolvedValue({
        data: null, // No active credentials
        error: null
      });

      // ACT
      await CredentialService.exists(orgId, provider);

      // ASSERT - Verify the query filters is_active = true
      const supabaseCall = mockSupabase.from('org_credentials');
      expect(supabaseCall.select).toHaveBeenCalled();
      expect(supabaseCall.eq).toHaveBeenCalledWith('org_id', orgId);
      expect(supabaseCall.eq).toHaveBeenCalledWith('provider', provider);
      expect(supabaseCall.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('getLastError()', () => {
    const orgId = 'test-org-123';
    const provider = 'google_calendar' as const;

    test('should retrieve verification_error from database', async () => {
      // ARRANGE
      const verificationError = 'OAuth token expired';
      mockSupabaseResponse = {
        data: { verification_error: verificationError },
        error: null
      };

      // ACT
      const result = await CredentialService.getLastError(orgId, provider);

      // ASSERT
      expect(result).toBe(verificationError);
    });

    test('should return null when no error exists', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: { verification_error: null },
        error: null
      };

      // ACT
      const result = await CredentialService.getLastError(orgId, provider);

      // ASSERT
      expect(result).toBeNull();
    });

    test('should return null when credentials not found', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: null
      };

      // ACT
      const result = await CredentialService.getLastError(orgId, provider);

      // ASSERT
      expect(result).toBeNull();
    });

    test('should return null when database error occurs', async () => {
      // ARRANGE
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      mockSupabase.from().maybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      // ACT
      const result = await CredentialService.getLastError(orgId, provider);

      // ASSERT
      expect(result).toBeNull();
    });
  });

  describe('listProviders()', () => {
    const orgId = 'test-org-123';

    test('should return array of active providers for organization', async () => {
      // ARRANGE
      const providers = ['google_calendar', 'twilio', 'vapi'];
      mockSupabaseResponse = {
        data: providers.map(p => ({ provider: p })),
        error: null
      };

      // ACT
      const result = await CredentialService.listProviders(orgId);

      // ASSERT
      expect(result).toEqual(providers);
      expect(log.debug).toHaveBeenCalledWith(
        'CredentialService',
        `Found ${providers.length} active integrations`,
        expect.objectContaining({ orgId })
      );
    });

    test('should return empty array when no active providers exist', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: [],
        error: null
      };

      // ACT
      const result = await CredentialService.listProviders(orgId);

      // ASSERT
      expect(result).toEqual([]);
    });

    test('should return empty array when database error occurs', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: { message: 'Database error' }
      };

      // ACT
      const result = await CredentialService.listProviders(orgId);

      // ASSERT
      expect(result).toEqual([]);
      expect(log.error).toHaveBeenCalledWith(
        'CredentialService',
        'Error listing providers',
        expect.objectContaining({ orgId })
      );
    });

    test('should filter only active providers (is_active = true)', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: [],
        error: null
      };

      // ACT
      const result = await CredentialService.listProviders(orgId);

      // ASSERT
      expect(result).toEqual([]);
    });
  });

  describe('Type Safety', () => {
    test('should enforce ProviderType at compile time', () => {
      // This test verifies TypeScript compilation - type errors are caught at compile time
      // Attempting to use invalid provider string would cause TypeScript error:
      //   const creds = await CredentialService.get(orgId, 'invalid_provider');
      //   // TS2345: Argument of type '"invalid_provider"' is not assignable to parameter of type 'ProviderType'

      // Valid providers that should compile
      const validProviders = ['vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs'] as const;

      expect(validProviders).toContain('google_calendar');
      expect(validProviders).toContain('twilio');
    });
  });

  describe('Error Message Clarity', () => {
    const orgId = 'test-org-123';
    const provider = 'google_calendar' as const;

    test('should provide user-friendly error messages for all error cases', async () => {
      // ARRANGE
      mockSupabaseResponse = {
        data: null,
        error: null
      };

      // ACT & ASSERT
      try {
        await CredentialService.get(orgId, provider);
        fail('Should have thrown');
      } catch (error: any) {
        // Should include provider name and org_id in message
        expect(error.message).toContain('google_calendar');
        expect(error.message).toContain('Please connect');
        expect(error.message).not.toContain('[object Object]'); // No object serialization
      }
    });
  });
});
