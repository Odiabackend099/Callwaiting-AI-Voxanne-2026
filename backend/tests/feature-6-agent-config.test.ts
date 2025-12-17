import request from 'supertest';
import { app } from '../src/server';

describe('Feature 6: Agent Configuration', () => {
  const testConfig = {
    firstMessage: 'Hello from TESTBOT!',
    systemPrompt: 'You are a test assistant.',
    voice: 'british-female',
    language: 'en-GB',
  };

  it('should save agent configuration', async () => {
    const response = await request(app)
      .put('/api/agent/config')
      .set('Authorization', 'Bearer test-token')
      .send(testConfig)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should sync configuration to Vapi', async () => {
    const response = await request(app)
      .put('/api/agent/config')
      .set('Authorization', 'Bearer test-token')
      .send(testConfig)
      .expect(200);

    expect(response.body.webhookConfigured).toBe(true);
  });

  it('should retrieve agent configuration', async () => {
    await request(app)
      .put('/api/agent/config')
      .set('Authorization', 'Bearer test-token')
      .send(testConfig);

    const response = await request(app)
      .get('/api/agent/config')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.firstMessage).toBe('Hello from TESTBOT!');
    expect(response.body.voice).toBe('british-female');
  });
});
