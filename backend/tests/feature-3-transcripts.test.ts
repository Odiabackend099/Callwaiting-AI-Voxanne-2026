import request from 'supertest';
import { app } from '../src/server';

describe('Feature 3: Live Transcript', () => {
  const mockTranscriptWebhook = {
    message: {
      type: 'transcript',
      transcript: 'Hello, how can I help you?',
      role: 'assistant',
      callId: 'test-call-789',
    },
  };

  it('should receive transcript events', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .send(mockTranscriptWebhook)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should store transcript in database', async () => {
    await request(app)
      .post('/api/webhooks/vapi')
      .send(mockTranscriptWebhook);

    const response = await request(app)
      .get('/api/calls/test-call-789/transcript')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.transcript).toBeDefined();
    expect(response.body.transcript.length).toBeGreaterThan(0);
  });

  it('should deduplicate transcript messages', async () => {
    await request(app)
      .post('/api/webhooks/vapi')
      .send(mockTranscriptWebhook);

    await request(app)
      .post('/api/webhooks/vapi')
      .send(mockTranscriptWebhook);

    const response = await request(app)
      .get('/api/calls/test-call-789/transcript')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    const duplicates = response.body.transcript.filter(
      (t: any) => t.text === 'Hello, how can I help you?'
    );
    expect(duplicates.length).toBe(1);
  });
});
