import request from 'supertest';
import { app } from '../src/server';

describe('Feature 2: Call Recording & Storage', () => {
  const mockRecordingWebhook = {
    message: {
      type: 'end-of-call-report',
      call: {
        id: 'test-call-456',
        recordingUrl: 'https://vapi.ai/recordings/test.mp3',
      },
    },
  };

  it('should save recording URL to database', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .send(mockRecordingWebhook)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should generate signed URL for recording', async () => {
    const response = await request(app)
      .get('/api/calls/test-call-456/recording')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.url).toBeDefined();
    expect(response.body.expiresIn).toBe(3600);
  });

  it('should allow recording download', async () => {
    const response = await request(app)
      .get('/api/calls/test-call-456/recording')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.url).toBeDefined();
  });
});
