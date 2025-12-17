import request from 'supertest';
import { app } from '../src/server';

describe('Feature 5: Knowledge Base RAG', () => {
  const testDocument = {
    name: 'Test Pricing',
    content: 'BBL costs £99,999 at our clinic.',
  };

  it('should upload document', async () => {
    const response = await request(app)
      .post('/api/knowledge-base')
      .set('Authorization', 'Bearer test-token')
      .send(testDocument)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.id).toBeDefined();
  });

  it('should chunk document automatically', async () => {
    const uploadResponse = await request(app)
      .post('/api/knowledge-base')
      .set('Authorization', 'Bearer test-token')
      .send(testDocument);

    const docId = uploadResponse.body.id;

    const chunksResponse = await request(app)
      .get(`/api/knowledge-base/${docId}/chunks`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(chunksResponse.body.chunks.length).toBeGreaterThan(0);
  });

  it('should search knowledge base', async () => {
    await request(app)
      .post('/api/knowledge-base')
      .set('Authorization', 'Bearer test-token')
      .send(testDocument);

    const searchResponse = await request(app)
      .post('/api/knowledge-base/search')
      .set('Authorization', 'Bearer test-token')
      .send({ query: 'How much is a BBL?' })
      .expect(200);

    expect(searchResponse.body.results.length).toBeGreaterThan(0);
    expect(searchResponse.body.results[0].content).toContain('£99,999');
  });

  it('should inject KB context into agent', async () => {
    await request(app)
      .post('/api/knowledge-base')
      .set('Authorization', 'Bearer test-token')
      .send(testDocument);

    const response = await request(app)
      .post('/api/vapi/webhook')
      .send({
        message: {
          type: 'function-call',
          functionCall: {
            name: 'getKnowledgeBaseContext',
            parameters: {
              query: 'How much is a BBL?',
            },
          },
        },
      })
      .expect(200);

    expect(response.body.result).toContain('£99,999');
  });
});
