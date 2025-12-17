import request from 'supertest';
import { app } from '../src/server';

describe('Feature 7: Safe Mode (Compliance)', () => {
  const medicalQuestions = [
    'Is my swelling normal after surgery?',
    'Should I take ibuprofen for pain?',
    'Do I have an infection?',
  ];

  medicalQuestions.forEach((question) => {
    it(`should escalate medical question: "${question}"`, async () => {
      const response = await request(app)
        .post('/api/vapi/webhook')
        .send({
          message: {
            type: 'function-call',
            functionCall: {
              name: 'handleMedicalQuestion',
              parameters: { question },
            },
          },
        })
        .expect(200);

      expect(response.body.escalated).toBe(true);
    });
  });

  it('should NOT escalate non-medical questions', async () => {
    const response = await request(app)
      .post('/api/vapi/webhook')
      .send({
        message: {
          type: 'function-call',
          functionCall: {
            name: 'handleQuestion',
            parameters: {
              question: 'What are your hours?',
            },
          },
        },
      })
      .expect(200);

    expect(response.body.escalated).toBe(false);
  });

  it('should log all escalations', async () => {
    await request(app)
      .post('/api/vapi/webhook')
      .send({
        message: {
          type: 'function-call',
          functionCall: {
            name: 'handleMedicalQuestion',
            parameters: {
              question: 'Is my swelling normal?',
            },
          },
        },
      });

    const response = await request(app)
      .get('/api/escalations')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.escalations.length).toBeGreaterThan(0);
  });
});
