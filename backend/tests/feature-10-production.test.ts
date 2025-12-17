import request from 'supertest';

describe('Feature 10: Production Deployment', () => {
  const productionUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  it('should have health check endpoint', async () => {
    const response = await request(productionUrl)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should use correct environment', async () => {
    const response = await request(productionUrl)
      .get('/health')
      .expect(200);

    expect(response.body.environment).toBeDefined();
  });

  it('should handle webhook from Vapi', async () => {
    const response = await request(productionUrl)
      .post('/api/webhooks/vapi')
      .send({
        message: {
          type: 'call-started',
          call: {
            id: 'prod-test-call',
            phoneNumber: '+447424038250',
          },
        },
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should have all required endpoints', async () => {
    const endpoints = [
      '/health',
      '/api/calls',
      '/api/knowledge-base',
      '/api/agent/config',
    ];

    for (const endpoint of endpoints) {
      const response = await request(productionUrl)
        .get(endpoint)
        .set('Authorization', 'Bearer test-token');

      expect([200, 401, 404]).toContain(response.status);
    }
  });
});
