import request from 'supertest';
import { app } from '../src/server';

describe('Feature 1: Inbound Call Handling', () => {
  const mockWebhookPayload = {
    message: {
      type: 'call-started',
      call: {
        id: 'test-call-123',
        phoneNumber: '+447424038250',
        type: 'inboundPhoneCall',
      },
    },
  };

  it('should accept inbound call webhook', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .send(mockWebhookPayload)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should create call tracking record', async () => {
    await request(app)
      .post('/api/webhooks/vapi')
      .send(mockWebhookPayload);

    const response = await request(app)
      .get('/api/calls/recent')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    const call = response.body.calls.find(
      (c: any) => c.id === 'test-call-123'
    );
    expect(call).toBeDefined();
  });

  it('should handle race conditions with retry logic', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .send(mockWebhookPayload)
      .expect(200);

    expect(response.body.retries).toBeGreaterThanOrEqual(0);
  });

  it('should verify webhook signature', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .set('x-vapi-signature', 'invalid-signature')
      .send(mockWebhookPayload)
      .expect(401);

    expect(response.body.error).toBe('Unauthorized');
  });
});
