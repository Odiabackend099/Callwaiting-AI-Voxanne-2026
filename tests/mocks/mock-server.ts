/**
 * Mock Telephony Server
 *
 * Simulates the entire Voxanne Telephony API without hitting real Twilio.
 * Perfect for:
 * - Automated E2E testing
 * - CI/CD pipelines
 * - Cost-free local development
 * - Offline testing
 *
 * Replicates exact behavior of production API endpoints.
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.MOCK_SERVER_PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Simulate network latency
app.use((req: any, res: any, next: any) => {
  const delay = process.env.MOCK_LATENCY ? parseInt(process.env.MOCK_LATENCY) : 50;
  setTimeout(next, delay);
});

// Request logging
app.use((req: any, res: any, next: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// IN-MEMORY STORES (for testing)
// ============================================

interface VerifiedNumber {
  id: string;
  phone_number: string;
  friendly_name?: string;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  verified_at?: string;
  created_at: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const verifiedNumbers = new Map<string, VerifiedNumber>();
const rateLimits = new Map<string, RateLimitEntry>();
const forwardingConfigs = new Map<string, any>();

// ============================================
// MOCK ENDPOINTS FOR DASHBOARD
// ============================================

app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok' });
});

app.get('/api/billing/wallet', (req: any, res: any) => {
  res.json({
    balance: 0,
    currency: 'GBP',
    credits: 0
  });
});

app.get('/api/analytics/dashboard-pulse', (req: any, res: any) => {
  res.json({
    total_calls: 0,
    inbound_calls: 0,
    outbound_calls: 0,
    avg_duration: 0,
    appointments_booked: 0,
    avg_sentiment: 0,
    pipeline_value: 0
  });
});

app.get('/api/analytics/recent-activity', (req: any, res: any) => {
  res.json({
    activities: []
  });
});

app.get('/orgs/validate/:orgId', (req: any, res: any) => {
  res.json({
    valid: true,
    org_id: req.params.orgId
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function validateE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true; // Not rate limited
  }

  if (entry.count >= 3) {
    return false; // Rate limited
  }

  entry.count++;
  return true; // Not rate limited yet
}

function generateGSMCodes(carrier: string, forwardingType: string, ringTimeSeconds?: number) {
  const AI_NUMBER = '+15550109999';

  let activationCode = '';
  let deactivationCode = '';

  switch (carrier.toLowerCase()) {
    case 'tmobile':
      if (forwardingType === 'total_ai') {
        activationCode = `**21*${AI_NUMBER}#`;
        deactivationCode = '##21#';
      } else {
        const ringTime = ringTimeSeconds || 25;
        activationCode = `**61*${AI_NUMBER}*11*${ringTime}#`;
        deactivationCode = '##61#';
      }
      break;

    case 'att':
      if (forwardingType === 'total_ai') {
        activationCode = `*21*${AI_NUMBER}#`;
        deactivationCode = '#21#';
      } else {
        const ringTime = ringTimeSeconds || 25;
        activationCode = `*004*${AI_NUMBER}*11*${ringTime}#`;
        deactivationCode = '##004#';
      }
      break;

    case 'verizon':
      if (forwardingType === 'total_ai') {
        activationCode = `*72${AI_NUMBER}`;
        deactivationCode = '*73';
      } else {
        activationCode = `*71${AI_NUMBER}`;
        deactivationCode = '*73';
      }
      break;

    default:
      // Default to GSM codes
      if (forwardingType === 'total_ai') {
        activationCode = `**21*${AI_NUMBER}#`;
        deactivationCode = '##21#';
      } else {
        const ringTime = ringTimeSeconds || 25;
        activationCode = `**61*${AI_NUMBER}*11*${ringTime}#`;
        deactivationCode = '##61#';
      }
  }

  return { activationCode, deactivationCode };
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /health
 * Health check endpoint for test infrastructure
 */
app.get('/health', (req: any, res: any) => {
  res.status(200).json({
    status: 'ok',
    service: 'mock-telephony-server',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/telephony/verify-caller-id/initiate
 * Initiates phone number verification via simulated Twilio call
 */
app.post('/api/telephony/verify-caller-id/initiate', (req: any, res: any) => {
  const { phoneNumber, friendlyName } = req.body;
  const requestId = generateId('req');

  console.log(`  📞 Initiating verification for ${phoneNumber}`);

  // Validation
  if (!phoneNumber) {
    return res.status(400).json({
      error: 'Phone number is required',
      requestId,
    });
  }

  if (!validateE164(phoneNumber)) {
    return res.status(400).json({
      error: 'Invalid phone number format. Must be E.164 format (e.g., +15551234567)',
      requestId,
    });
  }

  // Check existing verification
  if (verifiedNumbers.has(phoneNumber) && verifiedNumbers.get(phoneNumber)!.status === 'verified') {
    return res.status(400).json({
      error: 'This phone number is already verified for your organization',
      requestId,
    });
  }

  // Rate limiting (3 attempts per hour per phone)
  const rateLimitKey = `initiate:${phoneNumber}`;
  if (!checkRateLimit(rateLimitKey)) {
    return res.status(429).json({
      error: 'Too many verification attempts. Please try again later.',
      retryAfter: 3600,
      requestId,
    });
  }

  // Create pending verification
  const verificationId = generateId('ver');
  const validationCode = generateOTP();

  verifiedNumbers.set(phoneNumber, {
    id: verificationId,
    phone_number: phoneNumber,
    friendly_name: friendlyName,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // Store validation code in memory (in production, this would be hashed)
  (verifiedNumbers.get(phoneNumber) as any).validation_code = validationCode;

  return res.status(200).json({
    success: true,
    verificationId,
    message: 'Verification call in progress. Answer and enter the code when prompted.',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    requestId,
  });
});

/**
 * POST /api/telephony/verify-caller-id/confirm
 * Confirms verification by checking if user entered the code correctly
 */
app.post('/api/telephony/verify-caller-id/confirm', (req: any, res: any) => {
  const { verificationId, phoneNumber } = req.body;
  const requestId = generateId('req');

  console.log(`  ✅ Confirming verification for ${phoneNumber}`);

  if (!verificationId && !phoneNumber) {
    return res.status(400).json({
      error: 'verificationId or phoneNumber is required',
      requestId,
    });
  }

  // Find verification
  let verification: VerifiedNumber | null = null;

  if (verificationId) {
    for (const [, ver] of verifiedNumbers) {
      if (ver.id === verificationId) {
        verification = ver;
        break;
      }
    }
  } else if (phoneNumber) {
    verification = verifiedNumbers.get(phoneNumber) || null;
  }

  if (!verification) {
    return res.status(404).json({
      error: 'No pending verification found',
      requestId,
    });
  }

  // In mock, automatically mark as verified after 500ms delay (simulating user entering code)
  // In production, this would check Twilio's verification status
  setTimeout(() => {
    if (verification) {
      verification.status = 'verified';
      verification.verified_at = new Date().toISOString();
    }
  }, 500);

  return res.status(200).json({
    success: true,
    verifiedNumber: {
      id: verification.id,
      phoneNumber: verification.phone_number,
      friendlyName: verification.friendly_name || null,
      status: 'verified',
      verifiedAt: verification.verified_at || new Date().toISOString(),
    },
    requestId,
  });
});

/**
 * GET /api/telephony/verified-numbers
 * List all verified numbers for an organization
 */
app.get('/api/telephony/verified-numbers', (req: any, res: any) => {
  const requestId = generateId('req');

  console.log(`  📋 Listing verified numbers`);

  const numbers = Array.from(verifiedNumbers.values()).map(num => ({
    id: num.id,
    phone_number: num.phone_number,
    friendly_name: num.friendly_name,
    status: num.status,
    verified_at: num.verified_at || null,
    created_at: num.created_at,
    hasForwardingConfig: forwardingConfigs.has(num.id),
    forwardingStatus: forwardingConfigs.get(num.id)?.status || null,
  }));

  return res.status(200).json({
    success: true,
    numbers,
    requestId,
  });
});

/**
 * DELETE /api/telephony/verified-numbers/:id
 * Remove a verified number
 */
app.delete('/api/telephony/verified-numbers/:id', (req: any, res: any) => {
  const { id } = req.params;
  const requestId = generateId('req');

  console.log(`  🗑️  Deleting verified number ${id}`);

  // Find and delete
  let found = false;
  for (const [phone, num] of verifiedNumbers) {
    if (num.id === id) {
      verifiedNumbers.delete(phone);
      found = true;
      break;
    }
  }

  if (!found) {
    return res.status(404).json({
      error: 'Verified number not found',
      requestId,
    });
  }

  // Also delete associated forwarding config
  forwardingConfigs.delete(id);

  return res.status(200).json({
    success: true,
    message: 'Verified number removed successfully',
    requestId,
  });
});

/**
 * POST /api/telephony/forwarding-config
 * Create forwarding configuration and generate GSM codes
 */
app.post('/api/telephony/forwarding-config', (req: any, res: any) => {
  const { verifiedCallerId, forwardingType, carrier, ringTimeSeconds } = req.body;
  const requestId = generateId('req');

  console.log(`  ⚙️  Creating forwarding config: ${carrier} / ${forwardingType}`);

  // Validation
  if (!verifiedCallerId) {
    return res.status(400).json({
      error: 'verifiedCallerId is required',
      requestId,
    });
  }

  if (!['total_ai', 'safety_net'].includes(forwardingType)) {
    return res.status(400).json({
      error: 'forwardingType must be "total_ai" or "safety_net"',
      requestId,
    });
  }

  if (!['att', 'tmobile', 'verizon', 'sprint', 'other_gsm', 'other_cdma', 'international'].includes(carrier)) {
    return res.status(400).json({
      error: 'Invalid carrier',
      requestId,
    });
  }

  // Generate GSM codes
  const { activationCode, deactivationCode } = generateGSMCodes(
    carrier,
    forwardingType,
    ringTimeSeconds
  );

  const configId = generateId('hfc');
  const config = {
    id: configId,
    verifiedCallerId,
    forwardingType,
    carrier,
    ringTimeSeconds: forwardingType === 'safety_net' ? (ringTimeSeconds || 25) : undefined,
    activationCode,
    deactivationCode,
    status: 'pending_setup',
    created_at: new Date().toISOString(),
  };

  forwardingConfigs.set(verifiedCallerId, config);

  return res.status(200).json({
    success: true,
    config: {
      id: config.id,
      forwardingType: config.forwardingType,
      carrier: config.carrier,
      twilioForwardingNumber: '+15550109999',
      ringTimeSeconds: config.ringTimeSeconds || 0,
      activationCode: config.activationCode,
      deactivationCode: config.deactivationCode,
      status: config.status,
    },
    requestId,
  });
});

/**
 * GET /api/telephony/forwarding-config
 * Get current forwarding configuration
 */
app.get('/api/telephony/forwarding-config', (req: any, res: any) => {
  const requestId = generateId('req');

  console.log(`  ⚙️  Getting forwarding config`);

  const configs = Array.from(forwardingConfigs.values());

  return res.status(200).json({
    success: true,
    configs,
    requestId,
  });
});

/**
 * POST /api/telephony/forwarding-config/confirm
 * User confirms they've successfully dialed the GSM code
 */
app.post('/api/telephony/forwarding-config/confirm', (req: any, res: any) => {
  const { configId } = req.body;
  const requestId = generateId('req');

  console.log(`  ✅ Confirming forwarding setup for ${configId}`);

  if (!configId) {
    return res.status(400).json({
      error: 'configId is required',
      requestId,
    });
  }

  // Find and update config
  let found = false;
  for (const [, config] of forwardingConfigs) {
    if (config.id === configId) {
      config.status = 'active';
      config.user_confirmed_setup = true;
      config.confirmed_at = new Date().toISOString();
      found = true;
      break;
    }
  }

  if (!found) {
    return res.status(404).json({
      error: 'Forwarding config not found',
      requestId,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Forwarding configuration activated successfully',
    requestId,
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req: any, res: any) => {
  res.status(404).json({
    error: 'Not found',
    requestId: generateId('req'),
  });
});

// ============================================
// SERVER STARTUP
// ============================================

app.listen(PORT, () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     🎭 MOCK TELEPHONY SERVER STARTED 🎭        ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  URL: http://localhost:${PORT}`);
  console.log('║  Mode: Mock (no real Twilio API calls)         ║');
  console.log('║  Latency: Simulated network delays             ║');
  console.log('║  Data: In-memory (resets on restart)           ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('Endpoints available:');
  console.log('  POST   /api/telephony/verify-caller-id/initiate');
  console.log('  POST   /api/telephony/verify-caller-id/confirm');
  console.log('  GET    /api/telephony/verified-numbers');
  console.log('  DELETE /api/telephony/verified-numbers/:id');
  console.log('  POST   /api/telephony/forwarding-config');
  console.log('  GET    /api/telephony/forwarding-config');
  console.log('  POST   /api/telephony/forwarding-config/confirm');
  console.log('\n');
});
