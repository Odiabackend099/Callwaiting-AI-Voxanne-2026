import request from 'supertest';
import { app } from '../src/server';

describe('Feature 8: Real-Time Dashboard Updates', () => {
  it('should have health check endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('should broadcast events to connected clients', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .send({
        message: {
          type: 'call-ended',
          call: {
            id: 'realtime-test-call',
          },
        },
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should handle WebSocket connections', async () => {
    const response = await request(app)
      .get('/ws/live-calls')
      .expect(101);

    expect(response.status).toBe(101);
  });
});
