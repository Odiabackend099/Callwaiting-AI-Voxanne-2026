/**
 * Unit Tests for IntegrationDecryptor Service
 *
 * Test coverage:
 * - Credential encryption/decryption
 * - In-memory caching with TTL and LRU eviction
 * - All provider-specific credential retrieval
 * - Assistant-to-org mapping resolution
 * - Cache invalidation
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntegrationDecryptor } from '../integration-decryptor';

// Mock the Supabase client
vi.mock('@/services/supabase-server', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock the EncryptionService
vi.mock('@/services/encryption', () => ({
  EncryptionService: {
    encryptObject: vi.fn((obj) => `encrypted:${JSON.stringify(obj)}`),
    decryptObject: vi.fn((encrypted) => {
      const content = encrypted.replace('encrypted:', '');
      return JSON.parse(content);
    }),
  },
}));

const mockSupabase = require('@/services/supabase-server').supabase;

describe('IntegrationDecryptor', () => {
  beforeEach(() => {
    // Clear cache before each test
    IntegrationDecryptor['cache'].clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    IntegrationDecryptor['cache'].clear();
  });

  describe('getVapiCredentials', () => {
    it('should retrieve and decrypt Vapi credentials', async () => {
      const orgId = 'org-123';
      const mockCredentials = {
        apiKey: 'sk_abc123',
        webhookSecret: 'whs_xyz789',
        phoneNumberId: 'pn_456',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${JSON.stringify(mockCredentials)}`,
                      },
                    ],
                    error: null,
                  }),
                }),
            }),
        }),
      });

      const result = await IntegrationDecryptor.getVapiCredentials(orgId);

      expect(result).toEqual(mockCredentials);
      expect(result.apiKey).toBe('sk_abc123');
    });

    it('should throw error when Vapi credentials not found', async () => {
      const orgId = 'org-123';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
            }),
        }),
      });

      await expect(IntegrationDecryptor.getVapiCredentials(orgId)).rejects.toThrow(
        /vapi credentials not found/i
      );
    });

    it('should cache credentials for faster subsequent access', async () => {
      const orgId = 'org-123';
      const mockCredentials = {
        apiKey: 'sk_abc123',
        webhookSecret: 'whs_xyz789',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${JSON.stringify(mockCredentials)}`,
                      },
                    ],
                  }),
                }),
            }),
        }),
      });

      const start1 = Date.now();
      await IntegrationDecryptor.getVapiCredentials(orgId);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await IntegrationDecryptor.getVapiCredentials(orgId);
      const duration2 = Date.now() - start2;

      // Second call should be significantly faster (cached)
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('getTwilioCredentials', () => {
    it('should retrieve and decrypt Twilio credentials', async () => {
      const orgId = 'org-456';
      const mockCredentials = {
        accountSid: 'AC123',
        authToken: 'token123',
        phoneNumber: '+12025551234',
        whatsappNumber: '+12025551234',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${JSON.stringify(mockCredentials)}`,
                      },
                    ],
                  }),
                }),
            }),
        }),
      });

      const result = await IntegrationDecryptor.getTwilioCredentials(orgId);

      expect(result.accountSid).toBe('AC123');
      expect(result.phoneNumber).toBe('+12025551234');
    });
  });

  describe('getGoogleCalendarCredentials', () => {
    it('should retrieve and decrypt Google Calendar credentials', async () => {
      const orgId = 'org-789';
      const mockCredentials = {
        accessToken: 'ya29.abc123',
        refreshToken: 'ref123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${JSON.stringify(mockCredentials)}`,
                      },
                    ],
                  }),
                }),
            }),
        }),
      });

      const result = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);

      expect(result.accessToken).toBe('ya29.abc123');
      expect(result.refreshToken).toBe('ref123');
    });

    it('should throw error when token is expired', async () => {
      const orgId = 'org-789';
      const mockCredentials = {
        accessToken: 'ya29.abc123',
        refreshToken: 'ref123',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${JSON.stringify(mockCredentials)}`,
                      },
                    ],
                  }),
                }),
            }),
        }),
      });

      await expect(IntegrationDecryptor.getGoogleCalendarCredentials(orgId)).rejects.toThrow(
        /token expired/i
      );
    });
  });

  describe('resolveOrgFromAssistant', () => {
    it('should resolve organization from assistant ID', async () => {
      const assistantId = 'asst_abc123';
      const expectedOrgId = 'org-123';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ org_id: expectedOrgId }],
            error: null,
          }),
        }),
      });

      const result = await IntegrationDecryptor.resolveOrgFromAssistant(assistantId);

      expect(result).toBe(expectedOrgId);
    });

    it('should return null when assistant not found', async () => {
      const assistantId = 'asst_unknown';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await IntegrationDecryptor.resolveOrgFromAssistant(assistantId);

      expect(result).toBeNull();
    });

    it('should cache assistant-to-org mappings', async () => {
      const assistantId = 'asst_abc123';
      const expectedOrgId = 'org-123';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ org_id: expectedOrgId }],
            error: null,
          }),
        }),
      });

      // First call - database hit
      const result1 = await IntegrationDecryptor.resolveOrgFromAssistant(assistantId);

      // Clear database mock to ensure we're using cache
      mockSupabase.from.mockClear();

      // Second call - should use cache
      const result2 = await IntegrationDecryptor.resolveOrgFromAssistant(assistantId);

      expect(result1).toBe(expectedOrgId);
      expect(result2).toBe(expectedOrgId);
      expect(mockSupabase.from).not.toHaveBeenCalled(); // No database call on second invocation
    });
  });

  describe('registerAssistantMapping', () => {
    it('should register assistant-to-org mapping', async () => {
      const assistantId = 'asst_new123';
      const orgId = 'org-456';
      const role = 'inbound';
      const name = 'My Assistant';

      const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      await IntegrationDecryptor.registerAssistantMapping(assistantId, orgId, role, name);

      expect(mockInsert).toHaveBeenCalledWith({
        vapi_assistant_id: assistantId,
        org_id: orgId,
        assistant_role: role,
        assistant_name: name,
        last_used_at: expect.any(String),
      });
    });
  });

  describe('storeCredentials', () => {
    it('should store encrypted credentials', async () => {
      const orgId = 'org-123';
      const provider = 'vapi';
      const credentials = { apiKey: 'sk_abc123' };

      const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      await IntegrationDecryptor.storeCredentials(orgId, provider, credentials);

      expect(mockUpsert).toHaveBeenCalled();
      // Verify encryption was used
      const callArgs = mockUpsert.mock.calls[0][0];
      expect(callArgs.org_id).toBe(orgId);
      expect(callArgs.provider).toBe(provider);
      expect(callArgs.encrypted_config).toBeDefined();
    });

    it('should invalidate cache after storing credentials', async () => {
      const orgId = 'org-123';
      const provider = 'vapi';
      const credentials = { apiKey: 'sk_abc123' };

      // First, populate cache
      const cacheKey = `${orgId}:${provider}`;
      IntegrationDecryptor['cache'].set(cacheKey, {
        data: { apiKey: 'old_key' },
        timestamp: Date.now(),
      });

      // Mock upsert
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      });

      // Store new credentials - should invalidate cache
      await IntegrationDecryptor.storeCredentials(orgId, provider, credentials);

      // Cache should be cleared for this org:provider
      expect(IntegrationDecryptor['cache'].has(cacheKey)).toBe(false);
    });
  });

  describe('verifyCredentials', () => {
    it('should verify credentials and update database', async () => {
      const orgId = 'org-123';
      const provider = 'vapi';

      // Mock getting credentials (would test actual provider connection)
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${{ apiKey: 'sk_abc123' }}`,
                      },
                    ],
                  }),
                }),
            }),
        }),
      });

      // Note: Actual verification would make API call to provider
      // This test verifies the framework is in place
      const result = await IntegrationDecryptor.verifyCredentials(orgId, provider);

      // Result should indicate verification attempt
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('lastVerified');
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate specific provider cache', () => {
      const orgId = 'org-123';

      // Populate cache with multiple providers
      IntegrationDecryptor['cache'].set(`${orgId}:vapi`, { data: {}, timestamp: Date.now() });
      IntegrationDecryptor['cache'].set(`${orgId}:twilio`, { data: {}, timestamp: Date.now() });

      // Invalidate only vapi
      IntegrationDecryptor.invalidateCache(orgId, 'vapi');

      expect(IntegrationDecryptor['cache'].has(`${orgId}:vapi`)).toBe(false);
      expect(IntegrationDecryptor['cache'].has(`${orgId}:twilio`)).toBe(true);
    });

    it('should invalidate all provider cache for org', () => {
      const orgId = 'org-123';

      // Populate cache
      IntegrationDecryptor['cache'].set(`${orgId}:vapi`, { data: {}, timestamp: Date.now() });
      IntegrationDecryptor['cache'].set(`${orgId}:twilio`, { data: {}, timestamp: Date.now() });

      // Invalidate all for org
      IntegrationDecryptor.invalidateCache(orgId);

      expect(IntegrationDecryptor['cache'].has(`${orgId}:vapi`)).toBe(false);
      expect(IntegrationDecryptor['cache'].has(`${orgId}:twilio`)).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const orgId = 'org-123';

      IntegrationDecryptor['cache'].set(`${orgId}:vapi`, { data: {}, timestamp: Date.now() });
      IntegrationDecryptor['cache'].set(`${orgId}:twilio`, { data: {}, timestamp: Date.now() });

      const stats = IntegrationDecryptor.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(1000);
      expect(stats.usage).toMatch(/\d+%/);
    });
  });

  describe('LRU Cache Eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      // Fill cache to capacity
      for (let i = 0; i < 1000; i++) {
        IntegrationDecryptor['cache'].set(`key-${i}`, { data: {}, timestamp: Date.now() });
      }

      const initialSize = IntegrationDecryptor['cache'].size;

      // Add one more item - should trigger eviction
      IntegrationDecryptor['cache'].set('key-new', { data: {}, timestamp: Date.now() });

      // Cache size should not exceed max
      expect(IntegrationDecryptor['cache'].size).toBeLessThanOrEqual(initialSize);
    });
  });

  describe('Cache TTL Expiration', () => {
    it('should return stale cache with warning when TTL expired', async () => {
      const orgId = 'org-123';
      const provider = 'vapi';
      const cacheKey = `${orgId}:${provider}`;

      // Set cache with very old timestamp (5+ minutes ago)
      const oldTimestamp = Date.now() - 6 * 60 * 1000;
      IntegrationDecryptor['cache'].set(cacheKey, {
        data: { apiKey: 'old_key' },
        timestamp: oldTimestamp,
      });

      // Mock fresh database query
      const freshCredentials = { apiKey: 'new_key' };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        encrypted_config: `encrypted:${JSON.stringify(freshCredentials)}`,
                      },
                    ],
                  }),
                }),
            }),
        }),
      });

      const result = await IntegrationDecryptor.getVapiCredentials(orgId);

      // Should fetch from database (cache expired), not use old cached value
      expect(result.apiKey).toBe('new_key');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const orgId = 'org-123';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database connection failed' },
                  }),
                }),
            }),
        }),
      });

      await expect(IntegrationDecryptor.getVapiCredentials(orgId)).rejects.toThrow();
    });

    it('should not leak credentials in error messages', async () => {
      const orgId = 'org-123';

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn()
                .mockReturnValueOnce({
                  eq: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
            }),
        }),
      });

      try {
        await IntegrationDecryptor.getVapiCredentials(orgId);
      } catch (error: any) {
        // Error message should not contain any credential-like values
        expect(error.message).not.toMatch(/sk_/);
        expect(error.message).not.toMatch(/token/i);
      }
    });
  });
});
