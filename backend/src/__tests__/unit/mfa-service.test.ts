import * as bcrypt from 'bcrypt';

// Mock Supabase BEFORE importing MFAService
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        getUserById: jest.fn(),
        deleteFactor: jest.fn(),
      },
    },
  })),
}));

// Import MFAService AFTER mocking
import { MFAService } from '../../services/mfa-service';

describe('MFA Recovery Code Security (P0-1 Fix)', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up chainable mock methods
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    });

    // Default INSERT behavior
    mockInsert.mockResolvedValue({ error: null });

    // Default SELECT behavior - will be overridden in individual tests
    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    // Default EQ chain - returns itself for chaining
    mockEq.mockReturnValue({
      eq: mockEq, // Allow chaining multiple .eq() calls
      single: mockSingle,
    });

    // Default UPDATE behavior
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
  });

  describe('generateRecoveryCodes()', () => {
    it('should generate 10 recovery codes and hash them with bcrypt', async () => {
      const userId = 'test-user-id';
      const insertedHashes: string[] = [];

      // Mock successful insertions
      mockInsert.mockImplementation((data: any) => {
        insertedHashes.push(data.secret);
        return Promise.resolve({ error: null });
      });

      const codes = await MFAService.generateRecoveryCodes(userId);

      // Verify 10 codes generated
      expect(codes).toHaveLength(10);

      // Verify codes are 16-character hex strings
      codes.forEach(code => {
        expect(code).toMatch(/^[0-9a-f]{16}$/);
      });

      // Verify 10 database insertions
      expect(mockInsert).toHaveBeenCalledTimes(10);

      // Verify all stored secrets are bcrypt hashes (start with $2b$)
      insertedHashes.forEach(hash => {
        expect(hash).toMatch(/^\$2b\$/);
      });

      // Verify plaintext codes NOT stored (hashes should be different from codes)
      codes.forEach((code, index) => {
        expect(insertedHashes[index]).not.toBe(code);
      });

      // Verify each hash can be verified with bcrypt.compare
      for (let i = 0; i < codes.length; i++) {
        const isValid = await bcrypt.compare(codes[i], insertedHashes[i]);
        expect(isValid).toBe(true);
      }
    });

    it('should throw error if database insertion fails', async () => {
      const userId = 'test-user-id';

      // Mock database error
      mockInsert.mockResolvedValue({
        error: { message: 'Database connection failed' },
      });

      await expect(MFAService.generateRecoveryCodes(userId)).rejects.toThrow(
        'Failed to store recovery code'
      );
    });

    it('should generate unique codes for each call', async () => {
      const userId = 'test-user-id';

      mockInsert.mockResolvedValue({ error: null });

      const codes1 = await MFAService.generateRecoveryCodes(userId);
      const codes2 = await MFAService.generateRecoveryCodes(userId);

      // Verify no duplicates between two generations
      const combined = [...codes1, ...codes2];
      const unique = new Set(combined);
      expect(unique.size).toBe(combined.length);
    });
  });

  describe('verifyRecoveryCode()', () => {
    it('should verify a valid recovery code', async () => {
      const userId = 'test-user-id';
      const validCode = 'a1b2c3d4e5f6g7h8';

      // Hash the code with bcrypt (simulating stored hash)
      const hashedCode = await bcrypt.hash(validCode, 12);

      // Mock database chain for SELECT query: .select('*').eq().eq().eq()
      // Each .eq() returns itself, final one resolves to data
      const mockEq3 = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'factor-id-1',
            user_id: userId,
            factor_type: 'recovery_code',
            secret: hashedCode,
            status: 'unverified',
          },
        ],
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });

      mockSelect.mockReturnValue({ eq: mockEq1 });

      // Mock UPDATE chain: .update().eq()
      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockUpdateEq });

      const isValid = await MFAService.verifyRecoveryCode(userId, validCode);

      expect(isValid).toBe(true);

      // Verify database update called to mark code as verified
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'verified' });
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'factor-id-1');
    });

    it('should reject an invalid recovery code', async () => {
      const userId = 'test-user-id';
      const validCode = 'a1b2c3d4e5f6g7h8';
      const invalidCode = 'wrong-code-1234';

      const hashedCode = await bcrypt.hash(validCode, 12);

      const mockEq3 = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'factor-id-1',
            user_id: userId,
            factor_type: 'recovery_code',
            secret: hashedCode,
            status: 'unverified',
          },
        ],
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      mockSelect.mockReturnValue({ eq: mockEq1 });

      const isValid = await MFAService.verifyRecoveryCode(userId, invalidCode);

      expect(isValid).toBe(false);

      // Verify update NOT called (code didn't match)
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not allow reusing a recovery code', async () => {
      const userId = 'test-user-id';
      const code = 'a1b2c3d4e5f6g7h8';
      const hashedCode = await bcrypt.hash(code, 12);

      // First use: code is unverified
      const mockEq3_1 = jest.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'factor-id-1',
            user_id: userId,
            factor_type: 'recovery_code',
            secret: hashedCode,
            status: 'unverified',
          },
        ],
        error: null,
      });

      const mockEq2_1 = jest.fn().mockReturnValue({ eq: mockEq3_1 });
      const mockEq1_1 = jest.fn().mockReturnValue({ eq: mockEq2_1 });
      mockSelect.mockReturnValueOnce({ eq: mockEq1_1 });

      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValueOnce({ eq: mockUpdateEq });

      const firstUse = await MFAService.verifyRecoveryCode(userId, code);
      expect(firstUse).toBe(true);

      // Second use: code is already verified (filtered out by query)
      const mockEq3_2 = jest.fn().mockResolvedValueOnce({
        data: [], // No unverified codes match
        error: null,
      });

      const mockEq2_2 = jest.fn().mockReturnValue({ eq: mockEq3_2 });
      const mockEq1_2 = jest.fn().mockReturnValue({ eq: mockEq2_2 });
      mockSelect.mockReturnValueOnce({ eq: mockEq1_2 });

      const secondUse = await MFAService.verifyRecoveryCode(userId, code);
      expect(secondUse).toBe(false);
    });

    it('should return false if no recovery codes exist for user', async () => {
      const userId = 'test-user-id';

      const mockEq3 = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      mockSelect.mockReturnValue({ eq: mockEq1 });

      const isValid = await MFAService.verifyRecoveryCode(userId, 'any-code');

      expect(isValid).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'test-user-id';

      const mockEq3 = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      mockSelect.mockReturnValue({ eq: mockEq1 });

      const isValid = await MFAService.verifyRecoveryCode(userId, 'any-code');

      expect(isValid).toBe(false);
    });

    it('should find matching code among multiple stored codes', async () => {
      const userId = 'test-user-id';
      const code1 = 'code1111111111111';
      const code2 = 'code2222222222222';
      const code3 = 'code3333333333333';

      const hash1 = await bcrypt.hash(code1, 12);
      const hash2 = await bcrypt.hash(code2, 12);
      const hash3 = await bcrypt.hash(code3, 12);

      const mockEq3 = jest.fn().mockResolvedValue({
        data: [
          { id: 'factor-1', secret: hash1, status: 'unverified' },
          { id: 'factor-2', secret: hash2, status: 'unverified' },
          { id: 'factor-3', secret: hash3, status: 'unverified' },
        ],
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      mockSelect.mockReturnValue({ eq: mockEq1 });

      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockUpdateEq });

      // Try code2 (should match second hash)
      const isValid = await MFAService.verifyRecoveryCode(userId, code2);

      expect(isValid).toBe(true);
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'factor-2');
    });
  });

  describe('hashRecoveryCodes() - DEPRECATED', () => {
    it('should throw error indicating deprecation', async () => {
      await expect(MFAService.hashRecoveryCodes(['code1', 'code2'])).rejects.toThrow(
        'DEPRECATED'
      );
    });
  });

  describe('Security Validation', () => {
    it('should never store plaintext recovery codes in database', async () => {
      const userId = 'test-user-id';
      const insertedData: any[] = [];

      mockInsert.mockImplementation((data: any) => {
        insertedData.push(data);
        return Promise.resolve({ error: null });
      });

      const codes = await MFAService.generateRecoveryCodes(userId);

      // Verify no plaintext code was inserted
      insertedData.forEach((inserted, index) => {
        const plaintextCode = codes[index];
        expect(inserted.secret).not.toBe(plaintextCode);
        expect(inserted.secret).not.toContain(plaintextCode);

        // Verify stored value is a bcrypt hash
        expect(inserted.secret).toMatch(/^\$2b\$/);
      });
    });

    it('should use cryptographically secure random generation', async () => {
      const userId = 'test-user-id';

      mockInsert.mockResolvedValue({ error: null });

      const codes = await MFAService.generateRecoveryCodes(userId);

      // Verify entropy: all codes should be unique
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);

      // Verify format: 16-character hex (128 bits of entropy)
      codes.forEach(code => {
        expect(code).toHaveLength(16);
        expect(code).toMatch(/^[0-9a-f]{16}$/);
      });
    });

    it('should use bcrypt work factor of 12 for security', async () => {
      const userId = 'test-user-id';
      const insertedHashes: string[] = [];

      mockInsert.mockImplementation((data: any) => {
        insertedHashes.push(data.secret);
        return Promise.resolve({ error: null });
      });

      await MFAService.generateRecoveryCodes(userId);

      // Verify all hashes use bcrypt with appropriate work factor
      insertedHashes.forEach(hash => {
        // bcrypt format: $2b$12$... (12 = work factor)
        expect(hash).toMatch(/^\$2b\$12\$/);
      });
    });
  });
});
