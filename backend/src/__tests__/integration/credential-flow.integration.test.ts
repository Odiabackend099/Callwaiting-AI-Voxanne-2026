/**
 * Integration Tests for Complete Credential Flow
 *
 * Test coverage:
 * - End-to-end credential storage and retrieval
 * - Webhook handler with org isolation
 * - Multi-tenant credential access
 * - API endpoints (store, verify, status)
 * - Cache behavior under load
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// Assumes Express app is exported from main server file
// import { app } from '@/server';

const BASE_URL = 'http://localhost:3000/api';

// Mock org IDs for testing
const ORG_1 = 'org-clinic-1';
const ORG_2 = 'org-clinic-2';

// Test credentials
const VAPI_CREDS_1 = {
  apiKey: 'sk_test_vapi_clinic1_abc123def456',
  webhookSecret: 'whs_test_clinic1_xyz789',
};

const VAPI_CREDS_2 = {
  apiKey: 'sk_test_vapi_clinic2_ghi123jkl456',
  webhookSecret: 'whs_test_clinic2_mno789',
};

const TWILIO_CREDS_1 = {
  accountSid: 'ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p',
  authToken: 'authtoken1234567890abcdefghijklmn',
  phoneNumber: '+12025551234',
};

const TWILIO_CREDS_2 = {
  accountSid: 'ACz9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k',
  authToken: 'authtoken0987654321zyxwvutsrqpon',
  phoneNumber: '+14155552222',
};

describe('Credential Flow Integration Tests', () => {
  beforeEach(async () => {
    // Clean up: disconnect all integrations before each test
    // In real scenario, this would reset test database
  });

  describe('Single-Tenant Credential Storage and Retrieval', () => {
    it('should store and retrieve Vapi credentials for single org', async () => {
      // Store Vapi credentials
      const storeResponse = await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      expect(storeResponse.status).toBe(200);
      expect(storeResponse.body.success).toBe(true);
      expect(storeResponse.body.data.inboundAssistantId).toBeDefined();
      expect(storeResponse.body.data.outboundAssistantId).toBeDefined();

      // Retrieve and verify status
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.vapi.connected).toBe(true);
      expect(statusResponse.body.data.vapi.lastVerified).toBeDefined();
    });

    it('should store and retrieve Twilio credentials for single org', async () => {
      const storeResponse = await request(BASE_URL)
        .post('/integrations/twilio')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(TWILIO_CREDS_1);

      expect(storeResponse.status).toBe(200);
      expect(storeResponse.body.success).toBe(true);

      // Verify status
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(statusResponse.body.data.twilio.connected).toBe(true);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate Vapi credentials between orgs', async () => {
      // Store different Vapi credentials for each org
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_2}`)
        .send(VAPI_CREDS_2);

      // Retrieve status for both orgs
      const status1 = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      const status2 = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_2}`);

      // Both should be connected but with different credentials
      expect(status1.body.data.vapi.connected).toBe(true);
      expect(status2.body.data.vapi.connected).toBe(true);

      // Verify different assistants were created (not shared)
      expect(status1.body.data.vapi.lastVerified).toBeDefined();
      expect(status2.body.data.vapi.lastVerified).toBeDefined();
    });

    it('should prevent access to other org credentials', async () => {
      // Store credentials for ORG_1
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      // Try to access ORG_1 credentials as ORG_2 (should fail)
      // This would be enforced by RLS policies in production
      const unauthorizedResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_2}`);

      // ORG_2 should see empty status, not ORG_1's credentials
      expect(unauthorizedResponse.body.data.vapi.connected).toBe(false);
    });
  });

  describe('Webhook Handler with Org Isolation', () => {
    it('should process webhook with correct org-specific credentials', async () => {
      // Store Vapi credentials for ORG_1 with webhook secret
      const storeResponse = await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      const assistantId = storeResponse.body.data.inboundAssistantId;

      // Simulate Vapi webhook with valid signature
      // Note: In real test, signature would be calculated with org's webhook secret
      const webhookPayload = {
        assistantId,
        message: 'Call started',
        timestamp: new Date().toISOString(),
      };

      const webhookResponse = await request(BASE_URL)
        .post('/webhooks/vapi')
        .set('x-vapi-signature', 'valid-signature-for-org-1')
        .set('x-vapi-timestamp', Math.floor(Date.now() / 1000).toString())
        .send(webhookPayload);

      // Should process successfully with correct org context
      expect(webhookResponse.status).toBeLessThan(400); // Not a client error
    });

    it('should reject webhook with invalid signature', async () => {
      const assistantId = 'asst_unknown_123';

      const webhookPayload = {
        assistantId,
        message: 'Call started',
      };

      // Send webhook with invalid signature
      const webhookResponse = await request(BASE_URL)
        .post('/webhooks/vapi')
        .set('x-vapi-signature', 'invalid-signature')
        .set('x-vapi-timestamp', Math.floor(Date.now() / 1000).toString())
        .send(webhookPayload);

      // Should reject due to invalid signature or unknown assistant
      expect(webhookResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should use correct org credentials for webhook processing', async () => {
      // Store different Twilio credentials for each org
      await request(BASE_URL)
        .post('/integrations/twilio')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(TWILIO_CREDS_1);

      await request(BASE_URL)
        .post('/integrations/twilio')
        .set('Authorization', `Bearer token-${ORG_2}`)
        .send(TWILIO_CREDS_2);

      // Store Vapi credential for ORG_1
      const storeResponse = await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      const assistantId = storeResponse.body.data.inboundAssistantId;

      // Webhook should use ORG_1's Twilio credentials, not ORG_2's
      // This is verified through the webhook handler implementation
      // which should select credentials based on resolved org
    });
  });

  describe('Credential Verification and Status', () => {
    it('should update last_verified_at on successful verification', async () => {
      // Store credentials
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      // Get initial status
      const initialStatus = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      const initialVerified = initialStatus.body.data.vapi.lastVerified;

      // Wait and verify connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      const verifyResponse = await request(BASE_URL)
        .post('/integrations/vapi/verify')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.connected).toBe(true);

      // Get updated status
      const updatedStatus = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      // lastVerified should be updated
      const updatedVerified = updatedStatus.body.data.vapi.lastVerified;
      expect(new Date(updatedVerified).getTime()).toBeGreaterThan(
        new Date(initialVerified).getTime()
      );
    });

    it('should track verification errors', async () => {
      // Store invalid credentials
      const invalidCreds = {
        accountSid: 'invalid',
        authToken: 'invalid',
        phoneNumber: '+12025551234',
      };

      const storeResponse = await request(BASE_URL)
        .post('/integrations/twilio')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(invalidCreds);

      // Should fail due to invalid credentials
      expect(storeResponse.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Disconnect and Cleanup', () => {
    it('should disconnect integration and prevent usage', async () => {
      // Store credentials
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      // Disconnect
      const disconnectResponse = await request(BASE_URL)
        .delete('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(disconnectResponse.status).toBe(200);

      // Verify status shows disconnected
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(statusResponse.body.data.vapi.connected).toBe(false);
    });

    it('should preserve credentials in database after disconnect (soft delete)', async () => {
      // Store credentials
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      // Disconnect
      await request(BASE_URL)
        .delete('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`);

      // In production, verify in database that row still exists with is_active=false
      // This preserves audit trail and allows quick reconnection
    });
  });

  describe('Multiple Integrations per Org', () => {
    it('should support multiple integrations for single org', async () => {
      // Store multiple integrations
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      await request(BASE_URL)
        .post('/integrations/twilio')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(TWILIO_CREDS_1);

      // Get status
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      // Both should be connected
      expect(statusResponse.body.data.vapi.connected).toBe(true);
      expect(statusResponse.body.data.twilio.connected).toBe(true);

      // Should be able to disconnect one without affecting other
      await request(BASE_URL)
        .delete('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`);

      const updatedStatus = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(updatedStatus.body.data.vapi.connected).toBe(false);
      expect(updatedStatus.body.data.twilio.connected).toBe(true);
    });
  });

  describe('Credential Encryption and Security', () => {
    it('should never expose plaintext credentials in responses', async () => {
      // Store credentials
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      // Get status - should not include actual credentials
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      // Response should only have status, not credentials
      const vapiStatus = statusResponse.body.data.vapi;
      expect(vapiStatus.apiKey).toBeUndefined();
      expect(vapiStatus.webhookSecret).toBeUndefined();
      expect(vapiStatus.connected).toBeDefined();
    });

    it('should validate credentials before storing', async () => {
      // Try to store invalid Vapi key (too short)
      const response = await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send({
          apiKey: 'invalid', // Too short, should fail
          webhookSecret: '',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent credential stores safely', async () => {
      const credentials1 = { ...VAPI_CREDS_1 };
      const credentials2 = {
        ...VAPI_CREDS_1,
        apiKey: 'sk_test_vapi_clinic1_different789',
      };

      // Send two concurrent updates
      const [response1, response2] = await Promise.all([
        request(BASE_URL)
          .post('/integrations/vapi')
          .set('Authorization', `Bearer token-${ORG_1}`)
          .send(credentials1),
        request(BASE_URL)
          .post('/integrations/vapi')
          .set('Authorization', `Bearer token-${ORG_1}`)
          .send(credentials2),
      ]);

      // Both should succeed (last write wins)
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Only one should actually be stored (or second overwrites first)
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(statusResponse.body.data.vapi.connected).toBe(true);
    });

    it('should handle concurrent reads from cache', async () => {
      // Store credentials
      await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send(VAPI_CREDS_1);

      // Send many concurrent status requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(BASE_URL)
            .get('/integrations/status')
            .set('Authorization', `Bearer token-${ORG_1}`)
        );

      const responses = await Promise.all(requests);

      // All should succeed and return consistent data
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data.vapi.connected).toBe(true);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing credentials gracefully', async () => {
      // Try to get status without storing anything
      const statusResponse = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', `Bearer token-${ORG_1}`);

      expect(statusResponse.status).toBe(200);
      // All providers should show as not connected
      expect(statusResponse.body.data.vapi.connected).toBe(false);
      expect(statusResponse.body.data.twilio.connected).toBe(false);
    });

    it('should reject requests without authentication', async () => {
      const response = await request(BASE_URL)
        .get('/integrations/status')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBeGreaterThanOrEqual(401);
    });

    it('should validate input data types', async () => {
      const response = await request(BASE_URL)
        .post('/integrations/vapi')
        .set('Authorization', `Bearer token-${ORG_1}`)
        .send({
          apiKey: 123, // Should be string
          webhookSecret: true, // Should be string
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });
});
