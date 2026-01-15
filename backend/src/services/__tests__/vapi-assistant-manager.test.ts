/**
 * Unit Tests for VapiAssistantManager Service
 *
 * Test Coverage:
 * - ensureAssistant() - Create, update, and recreate assistants
 * - getAssistantConfig() - Retrieve configuration from database
 * - updateAssistantConfig() - Merge and sync configuration changes
 * - deleteAssistant() - Soft delete assistants
 * - Error handling and edge cases
 * - Multi-tenant isolation
 */

import { VapiAssistantManager, AssistantConfig } from '../vapi-assistant-manager';
import {
  createMockSupabaseClient,
  createMockVapiClient,
  createMockIntegrationDecryptor,
  createMockVapiCredentials,
  clearAllMocks,
} from '../../tests/utils/test-helpers';
import {
  MOCK_ORGANIZATIONS,
  MOCK_ASSISTANT_CONFIGS,
  MOCK_VAPI_CREDENTIALS,
} from '../../tests/utils/mock-data';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../integration-decryptor');
jest.mock('../vapi-client');
jest.mock('../logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('VapiAssistantManager', () => {
  let mockSupabaseClient: any;
  let mockVapiClient: any;
  let mockIntegrationDecryptor: any;

  beforeEach(() => {
    clearAllMocks();

    // Setup mock clients
    mockSupabaseClient = createMockSupabaseClient();
    mockVapiClient = createMockVapiClient();
    mockIntegrationDecryptor = createMockIntegrationDecryptor();

    // Mock module dependencies
    jest.mocked(require('@supabase/supabase-js')).createClient.mockReturnValue(mockSupabaseClient);
    jest.mocked(require('../integration-decryptor')).IntegrationDecryptor = mockIntegrationDecryptor;
    jest.mocked(require('../vapi-client')).VapiClient = jest.fn(() => mockVapiClient);
  });

  describe('ensureAssistant()', () => {
    const orgId = MOCK_ORGANIZATIONS.clinic1.id;
    const role = 'inbound' as const;
    const config: AssistantConfig = {
      name: 'Clinic 1 Inbound Assistant',
      systemPrompt: 'You are a helpful receptionist...',
      firstMessage: 'Hello, welcome!',
      voiceId: 'Paige',
      modelName: 'gpt-4',
    };

    it('should create a new assistant when none exists', async () => {
      // Setup mocks
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockVapiClient.createAssistant.mockResolvedValue({
        id: 'asst_new_123',
        name: config.name,
        model: 'gpt-4',
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: { id: 'agent_123' },
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute
      const result = await VapiAssistantManager.ensureAssistant(orgId, role, config);

      // Verify
      expect(result).toEqual({
        assistantId: 'asst_new_123',
        isNew: true,
        wasDeleted: false,
      });

      expect(mockVapiClient.createAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: config.name,
          systemPrompt: config.systemPrompt,
        })
      );

      expect(mockIntegrationDecryptor.registerAssistantMapping).toHaveBeenCalledWith(
        'asst_new_123',
        orgId,
        role,
        config.name
      );
    });

    it('should update existing assistant in Vapi', async () => {
      // Setup mocks
      const existingAssistantId = 'asst_existing_456';
      const existingAgent = {
        id: 'agent_existing_123',
        vapi_assistant_id: existingAssistantId,
      };

      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: existingAgent,
        error: null,
      });

      mockVapiClient.getAssistant.mockResolvedValue({
        id: existingAssistantId,
        name: 'Old Name',
      });

      mockVapiClient.updateAssistant.mockResolvedValue({
        id: existingAssistantId,
        name: config.name,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute
      const result = await VapiAssistantManager.ensureAssistant(orgId, role, config);

      // Verify
      expect(result).toEqual({
        assistantId: existingAssistantId,
        isNew: false,
        wasDeleted: false,
      });

      expect(mockVapiClient.updateAssistant).toHaveBeenCalledWith(
        existingAssistantId,
        expect.objectContaining({
          name: config.name,
        })
      );

      expect(mockVapiClient.createAssistant).not.toHaveBeenCalled();
    });

    it('should recreate assistant when deleted from Vapi (404 handling)', async () => {
      // Setup mocks
      const deletedAssistantId = 'asst_deleted_789';
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: {
          id: 'agent_456',
          vapi_assistant_id: deletedAssistantId,
        },
        error: null,
      });

      // First call to getAssistant returns 404
      mockVapiClient.getAssistant.mockRejectedValueOnce({
        response: { status: 404 },
      });

      // Second call to createAssistant (recreating)
      mockVapiClient.createAssistant.mockResolvedValueOnce({
        id: 'asst_new_recreated_999',
        name: config.name,
      });

      mockSupabaseClient.from().update.mockResolvedValue({
        data: {},
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute
      const result = await VapiAssistantManager.ensureAssistant(orgId, role, config);

      // Verify
      expect(result.wasDeleted).toBe(true);
      expect(result.assistantId).toBe('asst_new_recreated_999');

      expect(mockVapiClient.createAssistant).toHaveBeenCalled();
    });

    it('should handle VAPI API errors gracefully', async () => {
      // Setup mocks
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockVapiClient.createAssistant.mockRejectedValue(
        new Error('VAPI API Error: Rate limit exceeded')
      );

      // Execute & Verify
      await expect(
        VapiAssistantManager.ensureAssistant(orgId, role, config)
      ).rejects.toThrow('VAPI API Error');
    });

    it('should save assistant_id to database after creation', async () => {
      // Setup mocks
      const newAgent = { id: 'agent_new_123' };
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: newAgent,
        error: null,
      });

      mockVapiClient.createAssistant.mockResolvedValue({
        id: 'asst_saved_123',
        name: config.name,
      });

      mockSupabaseClient.from().update.mockResolvedValue({
        data: {},
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute
      await VapiAssistantManager.ensureAssistant(orgId, role, config);

      // Verify database update was called
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          vapi_assistant_id: 'asst_saved_123',
        })
      );
    });

    it('should register assistant-to-org mapping', async () => {
      // Setup mocks
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockVapiClient.createAssistant.mockResolvedValue({
        id: 'asst_mapped_123',
        name: config.name,
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: {},
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute
      const result = await VapiAssistantManager.ensureAssistant(orgId, role, config);

      // Verify mapping registration
      expect(mockIntegrationDecryptor.registerAssistantMapping).toHaveBeenCalledWith(
        result.assistantId,
        orgId,
        role,
        config.name
      );
    });

    it('should enforce multi-tenant isolation - different orgs, same role', async () => {
      const orgId1 = MOCK_ORGANIZATIONS.clinic1.id;
      const orgId2 = MOCK_ORGANIZATIONS.clinic2.id;

      // First call for org1
      mockSupabaseClient.from().select().eq().eq().maybeSingle
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      mockVapiClient.createAssistant
        .mockResolvedValueOnce({ id: 'asst_org1_123', name: config.name })
        .mockResolvedValueOnce({ id: 'asst_org2_123', name: config.name });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: {},
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials
        .mockResolvedValueOnce(createMockVapiCredentials())
        .mockResolvedValueOnce(createMockVapiCredentials());

      mockIntegrationDecryptor.registerAssistantMapping
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      // Execute for both orgs
      const result1 = await VapiAssistantManager.ensureAssistant(orgId1, role, config);
      const result2 = await VapiAssistantManager.ensureAssistant(orgId2, role, config);

      // Verify - different assistants for different orgs
      expect(result1.assistantId).toBe('asst_org1_123');
      expect(result2.assistantId).toBe('asst_org2_123');
      expect(result1.assistantId).not.toBe(result2.assistantId);
    });
  });

  describe('getAssistantConfig()', () => {
    const orgId = MOCK_ORGANIZATIONS.clinic1.id;
    const role = 'inbound' as const;

    it('should return config for existing agent', async () => {
      const mockConfig = {
        id: 'agent_123',
        vapi_assistant_id: 'asst_123',
        system_prompt: 'You are helpful',
        name: 'Test Assistant',
        voice: 'Paige',
      };

      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: mockConfig,
        error: null,
      });

      // Execute
      const result = await VapiAssistantManager.getAssistantConfig(orgId, role);

      // Verify
      expect(result).toEqual(mockConfig);
    });

    it('should return null for non-existent agent', async () => {
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      // Execute
      const result = await VapiAssistantManager.getAssistantConfig(orgId, role);

      // Verify
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Execute & Verify
      await expect(
        VapiAssistantManager.getAssistantConfig(orgId, role)
      ).rejects.toThrow();
    });
  });

  describe('updateAssistantConfig()', () => {
    const orgId = MOCK_ORGANIZATIONS.clinic1.id;
    const role = 'inbound' as const;
    const updatedConfig: Partial<AssistantConfig> = {
      systemPrompt: 'Updated system prompt',
      firstMessage: 'Updated first message',
    };

    it('should merge partial updates with existing config', async () => {
      const existingConfig = {
        id: 'agent_123',
        vapi_assistant_id: 'asst_123',
        system_prompt: 'Old prompt',
        name: 'Test Assistant',
        first_message: 'Old message',
      };

      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: existingConfig,
        error: null,
      });

      mockSupabaseClient.from().update.mockResolvedValue({
        data: {},
        error: null,
      });

      // Execute
      const result = await VapiAssistantManager.updateAssistantConfig(
        orgId,
        role,
        updatedConfig
      );

      // Verify - merged config returned
      expect(result).toEqual(
        expect.objectContaining({
          system_prompt: updatedConfig.systemPrompt,
          first_message: updatedConfig.firstMessage,
        })
      );
    });

    it('should sync changes to VAPI', async () => {
      const existingConfig = {
        id: 'agent_123',
        vapi_assistant_id: 'asst_123',
        system_prompt: 'Old prompt',
      };

      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: existingConfig,
        error: null,
      });

      mockSupabaseClient.from().update.mockResolvedValue({
        data: {},
        error: null,
      });

      mockVapiClient.updateAssistant.mockResolvedValue({
        id: 'asst_123',
      });

      // Execute
      await VapiAssistantManager.updateAssistantConfig(orgId, role, updatedConfig);

      // Verify - VAPI update was called
      expect(mockVapiClient.updateAssistant).toHaveBeenCalledWith(
        'asst_123',
        expect.any(Object)
      );
    });
  });

  describe('deleteAssistant()', () => {
    const orgId = MOCK_ORGANIZATIONS.clinic1.id;
    const role = 'inbound' as const;

    it('should soft delete assistant', async () => {
      const agent = {
        id: 'agent_123',
        vapi_assistant_id: 'asst_123',
      };

      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: agent,
        error: null,
      });

      mockSupabaseClient.from().update.mockResolvedValue({
        data: { id: agent.id },
        error: null,
      });

      // Execute
      const result = await VapiAssistantManager.deleteAssistant(orgId, role);

      // Verify - soft delete (sets active=false)
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
        })
      );

      expect(result).toBe(true);
    });

    it('should handle non-existent agents gracefully', async () => {
      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      // Execute
      const result = await VapiAssistantManager.deleteAssistant(orgId, role);

      // Verify - returns false for non-existent
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    const orgId = MOCK_ORGANIZATIONS.clinic1.id;
    const role = 'inbound' as const;
    const config: AssistantConfig = {
      name: 'Test Assistant',
      systemPrompt: 'Test prompt',
    };

    it('should handle empty config fields gracefully', async () => {
      const minimalConfig: AssistantConfig = {
        name: 'Minimal',
        systemPrompt: 'Minimal prompt',
        // All optional fields omitted
      };

      mockSupabaseClient.from().select().eq().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockVapiClient.createAssistant.mockResolvedValue({
        id: 'asst_minimal_123',
        name: minimalConfig.name,
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: {},
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute
      const result = await VapiAssistantManager.ensureAssistant(
        orgId,
        role,
        minimalConfig
      );

      // Verify - creates with defaults
      expect(result.assistantId).toBe('asst_minimal_123');
      expect(mockVapiClient.createAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: minimalConfig.name,
          voiceId: 'Paige', // default
          modelName: 'gpt-4', // default
        })
      );
    });

    it('should handle concurrent requests safely', async () => {
      mockSupabaseClient.from().select().eq().eq().maybeSingle
        .mockResolvedValue({
          data: null,
          error: null,
        });

      mockVapiClient.createAssistant.mockResolvedValue({
        id: 'asst_concurrent_123',
        name: config.name,
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: {},
        error: null,
      });

      mockIntegrationDecryptor.getVapiCredentials.mockResolvedValue(
        createMockVapiCredentials()
      );

      mockIntegrationDecryptor.registerAssistantMapping.mockResolvedValue(true);

      // Execute concurrent calls
      const results = await Promise.all([
        VapiAssistantManager.ensureAssistant(orgId, role, config),
        VapiAssistantManager.ensureAssistant(orgId, role, config),
        VapiAssistantManager.ensureAssistant(orgId, role, config),
      ]);

      // Verify - all calls completed
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.assistantId).toBeDefined();
      });
    });
  });
});
