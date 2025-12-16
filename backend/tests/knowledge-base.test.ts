/**
 * Knowledge Base API Tests
 * Unit and integration tests for KB CRUD, sync, and seed endpoints
 */

import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import app from '../src/server';
import { supabase } from '../src/services/supabase-client';

// Mock auth token
const mockToken = 'mock-jwt-token';
const mockOrgId = '550e8400-e29b-41d4-a716-446655440000';

describe('Knowledge Base API', () => {
  beforeEach(async () => {
    // Clear KB documents before each test
    await supabase
      .from('knowledge_base')
      .delete()
      .eq('org_id', mockOrgId);
  });

  afterEach(async () => {
    // Cleanup after tests
    await supabase
      .from('knowledge_base')
      .delete()
      .eq('org_id', mockOrgId);
  });

  describe('GET /api/knowledge-base', () => {
    it('should return empty list for new org', async () => {
      const res = await request(app)
        .get('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('should return all KB documents for org', async () => {
      // Create test documents
      await supabase.from('knowledge_base').insert([
        {
          org_id: mockOrgId,
          filename: 'test1.md',
          content: 'Test content 1',
          category: 'general',
          active: true,
          version: 1,
          metadata: { source: 'dashboard', bytes: 16 }
        },
        {
          org_id: mockOrgId,
          filename: 'test2.md',
          content: 'Test content 2',
          category: 'products_services',
          active: true,
          version: 1,
          metadata: { source: 'dashboard', bytes: 16 }
        }
      ]);

      const res = await request(app)
        .get('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].filename).toBe('test2.md'); // Most recent first
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/knowledge-base');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/knowledge-base', () => {
    it('should create a KB document', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          content: 'Test content',
          category: 'general',
          active: true
        });

      expect(res.status).toBe(200);
      expect(res.body.item).toBeDefined();
      expect(res.body.item.filename).toBe('test.md');
      expect(res.body.item.version).toBe(1);
      expect(res.body.item.active).toBe(true);
    });

    it('should reject invalid category', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          content: 'Test content',
          category: 'invalid_category'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid input');
    });

    it('should reject path traversal in filename', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: '../../../etc/passwd',
          content: 'Test content',
          category: 'general'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('path separators');
    });

    it('should reject whitespace-only content', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          content: '   ',
          category: 'general'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('whitespace');
    });

    it('should reject filename exceeding max length', async () => {
      const longFilename = 'a'.repeat(300);
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: longFilename,
          content: 'Test content',
          category: 'general'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid input');
    });

    it('should reject content exceeding max size', async () => {
      const largeContent = 'a'.repeat(400_000); // Exceeds 300KB limit
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          content: largeContent,
          category: 'general'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('too large');
    });

    it('should trim filename and content', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: '  test.md  ',
          content: '  Test content  ',
          category: 'general'
        });

      expect(res.status).toBe(200);
      expect(res.body.item.filename).toBe('test.md');
      expect(res.body.item.content).toBe('Test content');
    });

    it('should default category to general', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          content: 'Test content'
        });

      expect(res.status).toBe(200);
      expect(res.body.item.category).toBe('general');
    });
  });

  describe('PATCH /api/knowledge-base/:id', () => {
    let docId: string;

    beforeEach(async () => {
      const { data } = await supabase.from('knowledge_base').insert({
        org_id: mockOrgId,
        filename: 'test.md',
        content: 'Original content',
        category: 'general',
        active: true,
        version: 1,
        metadata: { source: 'dashboard', bytes: 16 }
      }).select('id').single();

      docId = data?.id;
    });

    it('should update KB document content', async () => {
      const res = await request(app)
        .patch(`/api/knowledge-base/${docId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          content: 'Updated content'
        });

      expect(res.status).toBe(200);
      expect(res.body.item.content).toBe('Updated content');
      expect(res.body.item.version).toBe(2); // Version incremented
    });

    it('should update KB document filename', async () => {
      const res = await request(app)
        .patch(`/api/knowledge-base/${docId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'updated.md'
        });

      expect(res.status).toBe(200);
      expect(res.body.item.filename).toBe('updated.md');
      expect(res.body.item.version).toBe(1); // Version not incremented for non-content updates
    });

    it('should update KB document category', async () => {
      const res = await request(app)
        .patch(`/api/knowledge-base/${docId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          category: 'products_services'
        });

      expect(res.status).toBe(200);
      expect(res.body.item.category).toBe('products_services');
    });

    it('should reject invalid category on update', async () => {
      const res = await request(app)
        .patch(`/api/knowledge-base/${docId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          category: 'invalid'
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440001';
      const res = await request(app)
        .patch(`/api/knowledge-base/${fakeId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          content: 'Updated content'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/knowledge-base/:id', () => {
    let docId: string;

    beforeEach(async () => {
      const { data } = await supabase.from('knowledge_base').insert({
        org_id: mockOrgId,
        filename: 'test.md',
        content: 'Test content',
        category: 'general',
        active: true,
        version: 1,
        metadata: { source: 'dashboard', bytes: 16 }
      }).select('id').single();

      docId = data?.id;
    });

    it('should soft-delete KB document', async () => {
      const res = await request(app)
        .delete(`/api/knowledge-base/${docId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify document is marked inactive
      const { data } = await supabase
        .from('knowledge_base')
        .select('active')
        .eq('id', docId)
        .single();

      expect(data?.active).toBe(false);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440001';
      const res = await request(app)
        .delete(`/api/knowledge-base/${fakeId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/knowledge-base/seed/beverly', () => {
    it('should seed Beverly KB documents', async () => {
      const res = await request(app)
        .post('/api/knowledge-base/seed/beverly')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.seeded).toBe(3); // 3 Beverly docs
      expect(res.body.items).toHaveLength(3);
    });

    it('should skip seed if KB already has documents', async () => {
      // Create a document first
      await supabase.from('knowledge_base').insert({
        org_id: mockOrgId,
        filename: 'existing.md',
        content: 'Existing content',
        category: 'general',
        active: true,
        version: 1,
        metadata: { source: 'dashboard', bytes: 16 }
      });

      const res = await request(app)
        .post('/api/knowledge-base/seed/beverly')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(200);
      expect(res.body.seeded).toBe(0);
      expect(res.body.message).toContain('already has documents');
    });
  });

  describe('POST /api/knowledge-base/sync', () => {
    beforeEach(async () => {
      // Create test KB documents
      await supabase.from('knowledge_base').insert([
        {
          org_id: mockOrgId,
          filename: 'test1.md',
          content: 'Test content 1',
          category: 'general',
          active: true,
          version: 1,
          metadata: { source: 'dashboard', bytes: 16 }
        },
        {
          org_id: mockOrgId,
          filename: 'test2.md',
          content: 'Test content 2',
          category: 'products_services',
          active: true,
          version: 1,
          metadata: { source: 'dashboard', bytes: 16 }
        }
      ]);
    });

    it('should return 400 if no active documents', async () => {
      // Create org with no active documents
      const emptyOrgId = '550e8400-e29b-41d4-a716-446655440002';

      const res = await request(app)
        .post('/api/knowledge-base/sync')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', emptyOrgId);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No active knowledge base documents');
    });

    it('should return 400 if no agents found', async () => {
      // This test assumes no agents exist for the org
      const res = await request(app)
        .post('/api/knowledge-base/sync')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No agents found');
    });

    it('should respect rate limiting', async () => {
      // First sync should succeed (or fail due to missing agents, but not rate limit)
      const res1 = await request(app)
        .post('/api/knowledge-base/sync')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      // Second sync immediately should be rate limited
      const res2 = await request(app)
        .post('/api/knowledge-base/sync')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId);

      expect(res2.status).toBe(429);
      expect(res2.body.error).toContain('Rate limited');
    });
  });

  describe('Input Validation', () => {
    it('should reject missing filename', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          content: 'Test content',
          category: 'general'
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing content', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          category: 'general'
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty filename', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: '',
          content: 'Test content',
          category: 'general'
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty content', async () => {
      const res = await request(app)
        .post('/api/knowledge-base')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Org-Id', mockOrgId)
        .send({
          filename: 'test.md',
          content: '',
          category: 'general'
        });

      expect(res.status).toBe(400);
    });
  });
});
