/**
 * Onboarding Routes Unit Tests
 *
 * Tests for the 4 onboarding wizard API endpoints:
 *   - POST /api/onboarding/event    — Record telemetry (fire-and-forget)
 *   - GET  /api/onboarding/status   — Check if user needs onboarding
 *   - POST /api/onboarding/complete — Mark onboarding as complete
 *   - POST /api/onboarding/provision-number — Auto-provision phone number with atomic billing
 *
 * Critical assertions:
 *   1. Fire-and-forget telemetry always returns success (never blocks user)
 *   2. Provision-number: wallet refunded on ANY failure after deduction
 *   3. Clinic name/specialty trimmed to max lengths (200/100 chars)
 *   4. Status returns graceful default on DB error (don't block existing users)
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mock setup BEFORE imports
// ---------------------------------------------------------------------------

const mockRpc = jest.fn();
const mockFrom = jest.fn(() => makeQueryChain());

function makeQueryChain(overrides: Record<string, any> = {}) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockResolvedValue({ data: null, error: null }),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  return chain;
}

// Mock auth middleware - allow all requests with test user
const mockRequireAuth = async (req: any, res: any, next: any) => {
  req.user = { id: 'test-user-id', orgId: 'test-org-id' };
  next();
};

jest.mock('../../middleware/auth', () => ({
  requireAuth: mockRequireAuth,
  requireAuthOrDev: mockRequireAuth,
}));

jest.mock('../../services/supabase-client', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

const mockValidateCanProvision = jest.fn();
jest.mock('../../services/phone-validation-service', () => ({
  PhoneValidationService: {
    validateCanProvision: mockValidateCanProvision,
  },
}));

const mockProvisionManagedNumber = jest.fn();
jest.mock('../../services/managed-telephony-service', () => ({
  ManagedTelephonyService: {
    provisionManagedNumber: mockProvisionManagedNumber,
  },
}));

const mockDeductAssetCost = jest.fn();
const mockAddCredits = jest.fn();
jest.mock('../../services/wallet-service', () => ({
  deductAssetCost: mockDeductAssetCost,
  addCredits: mockAddCredits,
}));

const mockCreateLogger = jest.fn(() => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../services/logger', () => ({
  createLogger: mockCreateLogger,
}));

// ---------------------------------------------------------------------------
// Import after all mocks
// ---------------------------------------------------------------------------

import onboardingRouter from '../../routes/onboarding';

// ---------------------------------------------------------------------------
// Setup Express app for testing
// ---------------------------------------------------------------------------

let app: Express;

beforeEach(() => {
  jest.clearAllMocks();

  // Mock auth middleware to inject test user
  const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.user = {
      id: 'test-user-id',
      orgId: 'test-org-id',
    } as any;
    next();
  };

  app = express();
  app.use(express.json());

  // Pre-pend auth middleware BEFORE the router
  app.use(mockAuthMiddleware);

  // Override requireAuth at module level in the router
  const routerWithoutAuth = express.Router();

  // Copy all routes from the original router and re-apply without requiring auth
  // Actually, let's just use the router as-is and ensure our auth middleware passes
  app.use('/api/onboarding', onboardingRouter);
});

// ---------------------------------------------------------------------------
// Tests: POST /event (fire-and-forget telemetry)
// ---------------------------------------------------------------------------

describe('POST /api/onboarding/event', () => {
  it('should accept valid event and return success', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        insert: jest.fn().mockResolvedValue({ data: { id: 'event-1' }, error: null }),
      })
    );

    const response = await request(app)
      .post('/api/onboarding/event')
      .send({
        event_name: 'started',
        step_index: 0,
        session_id: 'sess-123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('should accept all valid event names', async () => {
    const validEvents = ['started', 'clinic_named', 'specialty_chosen', 'payment_viewed', 'payment_success', 'test_call_completed'];

    for (const eventName of validEvents) {
      mockFrom.mockReturnValueOnce(
        makeQueryChain({
          insert: jest.fn().mockResolvedValue({ data: { id: `event-${eventName}` }, error: null }),
        })
      );

      const response = await request(app)
        .post('/api/onboarding/event')
        .send({
          event_name: eventName,
          step_index: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }
  });

  it('should reject invalid event_name with 400', async () => {
    const response = await request(app)
      .post('/api/onboarding/event')
      .send({
        event_name: 'invalid_event',
        step_index: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid event_name');
    expect(response.body.valid).toContain('started');
  });

  it('should reject step_index >= 5 with 400', async () => {
    const response = await request(app)
      .post('/api/onboarding/event')
      .send({
        event_name: 'started',
        step_index: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid step_index');
  });

  it('should reject negative step_index with 400', async () => {
    const response = await request(app)
      .post('/api/onboarding/event')
      .send({
        event_name: 'started',
        step_index: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid step_index');
  });

  it('should return success even if DB insert fails (fire-and-forget)', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Unique constraint violated' },
        }),
      })
    );

    const response = await request(app)
      .post('/api/onboarding/event')
      .send({
        event_name: 'started',
        step_index: 0,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true); // Never block user on telemetry error
  });

  it('should return success even if DB throws (fire-and-forget)', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        insert: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      })
    );

    const response = await request(app)
      .post('/api/onboarding/event')
      .send({
        event_name: 'started',
        step_index: 0,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /status
// ---------------------------------------------------------------------------

describe('GET /api/onboarding/status', () => {
  it('should return needs_onboarding=true when completed_at is NULL', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { onboarding_completed_at: null },
          error: null,
        }),
      })
    );

    const response = await request(app).get('/api/onboarding/status');

    expect(response.status).toBe(200);
    expect(response.body.needs_onboarding).toBe(true);
    expect(response.body.completed_at).toBeNull();
  });

  it('should return needs_onboarding=false when completed_at is set', async () => {
    const completedAt = '2026-02-25T10:30:00Z';
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { onboarding_completed_at: completedAt },
          error: null,
        }),
      })
    );

    const response = await request(app).get('/api/onboarding/status');

    expect(response.status).toBe(200);
    expect(response.body.needs_onboarding).toBe(false);
    expect(response.body.completed_at).toBe(completedAt);
  });

  it('should return graceful default on DB error (dont block existing users)', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection refused' },
        }),
      })
    );

    const response = await request(app).get('/api/onboarding/status');

    expect(response.status).toBe(200);
    expect(response.body.needs_onboarding).toBe(false); // Safe default
    expect(response.body.completed_at).toBeNull();
  });

  it('should return graceful default if query throws', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        maybeSingle: jest.fn().mockRejectedValue(new Error('Query error')),
      })
    );

    const response = await request(app).get('/api/onboarding/status');

    expect(response.status).toBe(200);
    expect(response.body.needs_onboarding).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /complete
// ---------------------------------------------------------------------------

describe('POST /api/onboarding/complete', () => {
  it('should set onboarding_completed_at and save clinic_name, specialty', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        update: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
    );

    const response = await request(app)
      .post('/api/onboarding/complete')
      .send({
        clinic_name: 'Smith Dermatology Clinic',
        specialty: 'Dermatology',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update was called with correct payload
    const updateChain = mockFrom.mock.results[0].value;
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_name: 'Smith Dermatology Clinic',
        specialty: 'Dermatology',
        onboarding_completed_at: expect.any(String),
      })
    );
  });

  it('should trim clinic_name to 200 chars', async () => {
    const longName = 'A'.repeat(250); // 250 chars → should be trimmed to 200
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        update: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
    );

    await request(app)
      .post('/api/onboarding/complete')
      .send({
        clinic_name: longName,
        specialty: 'Dermatology',
      });

    const updateChain = mockFrom.mock.results[0].value;
    const callArgs = updateChain.update.mock.calls[0][0];
    expect(callArgs.clinic_name).toHaveLength(200);
  });

  it('should trim specialty to 100 chars', async () => {
    const longSpecialty = 'B'.repeat(150);
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        update: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
    );

    await request(app)
      .post('/api/onboarding/complete')
      .send({
        clinic_name: 'Test Clinic',
        specialty: longSpecialty,
      });

    const updateChain = mockFrom.mock.results[0].value;
    const callArgs = updateChain.update.mock.calls[0][0];
    expect(callArgs.specialty).toHaveLength(100);
  });

  it('should allow completing without clinic_name/specialty (only timestamp)', async () => {
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        update: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
    );

    const response = await request(app)
      .post('/api/onboarding/complete')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updateChain = mockFrom.mock.results[0].value;
    const callArgs = updateChain.update.mock.calls[0][0];
    expect(callArgs).toHaveProperty('onboarding_completed_at');
    expect(callArgs.clinic_name).toBeUndefined();
  });

  it('should return 500 on DB update failure', async () => {
    // Create a chain that resolves to an error when awaited
    const errorResult = { data: null, error: { message: 'Update failed' } };

    const mockChain: any = makeQueryChain();
    mockChain.update = jest.fn().mockReturnValue(mockChain);
    mockChain.eq = jest.fn().mockReturnValue(Promise.resolve(errorResult));

    mockFrom.mockReturnValueOnce(mockChain);

    const response = await request(app)
      .post('/api/onboarding/complete')
      .send({
        clinic_name: 'Test Clinic',
        specialty: 'Dermatology',
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Failed');
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /provision-number (critical atomic billing)
// ---------------------------------------------------------------------------

describe('POST /api/onboarding/provision-number', () => {
  const PHONE_COST = 1000; // £10

  it('should provision phone number and return success', async () => {
    mockValidateCanProvision.mockResolvedValue({
      canProvision: true,
    });

    mockDeductAssetCost.mockResolvedValue({
      success: true,
      balance_after: 5000,
    });

    mockProvisionManagedNumber.mockResolvedValue({
      success: true,
      phoneNumber: '+12025551234',
    });

    const response = await request(app)
      .post('/api/onboarding/provision-number')
      .send({
        area_code: '202',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.phoneNumber).toBe('+12025551234');

    // Verify both functions were called
    expect(mockDeductAssetCost).toHaveBeenCalled();
    expect(mockProvisionManagedNumber).toHaveBeenCalled();
  });

  it('should return existing number if already provisioned', async () => {
    mockValidateCanProvision.mockResolvedValue({
      canProvision: false,
      existingNumber: {
        phoneNumber: '+12015551234',
      },
    });

    const response = await request(app)
      .post('/api/onboarding/provision-number')
      .send({
        area_code: '202',
      });

    expect(response.status).toBe(200);
    expect(response.body.alreadyProvisioned).toBe(true);
    expect(response.body.phoneNumber).toBe('+12015551234');
    expect(mockDeductAssetCost).not.toHaveBeenCalled();
  });

  it('should return 402 if insufficient balance (no wallet debit)', async () => {
    mockValidateCanProvision.mockResolvedValue({
      canProvision: true,
    });

    mockDeductAssetCost.mockResolvedValue({
      success: false,
      error: 'insufficient_balance',
      shortfallPence: 500,
    });

    const response = await request(app)
      .post('/api/onboarding/provision-number')
      .send({
        area_code: '202',
      });

    expect(response.status).toBe(402);
    expect(response.body.error).toContain('balance');
    expect(mockProvisionManagedNumber).not.toHaveBeenCalled();
  });

  it('should refund wallet if Twilio provisioning fails after deduction', async () => {
    mockValidateCanProvision.mockResolvedValue({
      canProvision: true,
    });

    mockDeductAssetCost.mockResolvedValue({
      success: true,
      balance_after: 4000,
    });

    mockProvisionManagedNumber.mockResolvedValue({
      success: false,
      error: 'No numbers available',
    });

    mockAddCredits.mockResolvedValue({
      success: true,
    });

    const response = await request(app)
      .post('/api/onboarding/provision-number')
      .send({
        area_code: '202',
      });

    expect(response.status).toBe(500);

    // CRITICAL: addCredits must be called with PHONE_COST_PENCE to refund
    expect(mockAddCredits).toHaveBeenCalledWith(
      'test-org-id',
      PHONE_COST,
      'refund',
      undefined,
      undefined,
      expect.any(String),
      'system:onboarding'
    );
  });

  it('should refund wallet if unexpected throw after deduction', async () => {
    mockValidateCanProvision.mockResolvedValue({
      canProvision: true,
    });

    mockDeductAssetCost.mockResolvedValue({
      success: true,
    });

    // Throw after wallet is debited
    mockProvisionManagedNumber.mockRejectedValue(new Error('Network timeout'));

    mockAddCredits.mockResolvedValue({
      success: true,
    });

    const response = await request(app)
      .post('/api/onboarding/provision-number')
      .send({
        area_code: '202',
      });

    expect(response.status).toBe(500);

    // CRITICAL: refund must still happen
    expect(mockAddCredits).toHaveBeenCalledWith(
      'test-org-id',
      PHONE_COST,
      'refund',
      undefined,
      undefined,
      expect.any(String),
      'system:onboarding'
    );
  });

  it('should return 500 if master Twilio credentials missing (before billing)', async () => {
    const originalSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
    const originalToken = process.env.TWILIO_MASTER_AUTH_TOKEN;

    delete process.env.TWILIO_MASTER_ACCOUNT_SID;
    delete process.env.TWILIO_MASTER_AUTH_TOKEN;

    try {
      const response = await request(app)
        .post('/api/onboarding/provision-number')
        .send({
          area_code: '202',
        });

      expect(response.status).toBe(500);
      expect(mockDeductAssetCost).not.toHaveBeenCalled();
    } finally {
      // Restore env vars
      if (originalSid) process.env.TWILIO_MASTER_ACCOUNT_SID = originalSid;
      if (originalToken) process.env.TWILIO_MASTER_AUTH_TOKEN = originalToken;
    }
  });

  it('should return 409 if validation fails and no existing number', async () => {
    mockValidateCanProvision.mockResolvedValue({
      canProvision: false,
      reason: 'Organization disabled phone provisioning',
    });

    const response = await request(app)
      .post('/api/onboarding/provision-number')
      .send({
        area_code: '202',
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('disabled');
  });
});
