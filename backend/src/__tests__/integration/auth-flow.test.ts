import request from 'supertest';
import app from '../../server'; // Should map to src/server.ts export
import { setupTestUser, teardownTestUser, TestUser } from '../../tests/integration/utils/auth';
import { supabaseAdmin } from '../../tests/integration/utils/db';
import { randomUUID } from 'crypto';

describe('Integration: Auth Flow & Multi-Tenant Isolation', () => {
    let userA: TestUser;
    let userB: TestUser;
    let contactA_Id: string;
    let contactB_Id: string;

    beforeAll(async () => {
        // Create two users in different organizations
        userA = await setupTestUser('admin');
        userB = await setupTestUser('admin');

        // Create a contact for Org A directly in DB (to ensure it exists)
        const { data: contactA } = await supabaseAdmin.from('contacts').insert({
            org_id: userA.orgId,
            name: 'Contact A',
            phone: `+1${randomUUID().replace(/-/g, '').substring(0, 10)}`, // Unique phone
            created_at: new Date().toISOString()
        }).select().single();
        contactA_Id = contactA.id;

        // Create a contact for Org B
        const { data: contactB } = await supabaseAdmin.from('contacts').insert({
            org_id: userB.orgId,
            name: 'Contact B',
            phone: `+1${randomUUID().replace(/-/g, '').substring(0, 10)}`, // Unique phone
            created_at: new Date().toISOString()
        }).select().single();
        contactB_Id = contactB.id;
    });

    afterAll(async () => {
        // Cleanup users and orgs (cascade deletes contacts)
        await teardownTestUser(userA);
        await teardownTestUser(userB);
    });

    describe('Authentication', () => {
        it('should allow access to protected route with valid token', async () => {
            const res = await request(app)
                .get('/api/contacts/stats')
                .set('Authorization', `Bearer ${userA.token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('total');
        });

        it('should reject access with invalid token', async () => {
            const res = await request(app)
                .get('/api/contacts/stats')
                .set('Authorization', 'Bearer invalid_token_123');

            expect(res.status).toBe(401);
        });

        it('should reject access with no token', async () => {
            const res = await request(app)
                .get('/api/contacts/stats');

            expect(res.status).toBe(401);
        });
    });

    describe('Multi-Tenant Isolation (RLS)', () => {
        it('User A should access their own contact', async () => {
            const res = await request(app)
                .get(`/api/contacts/${contactA_Id}`)
                .set('Authorization', `Bearer ${userA.token}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(contactA_Id);
            expect(res.body.name).toBe('Contact A');
        });

        it('User A should NOT access User B contact (Cross-Org Access)', async () => {
            const res = await request(app)
                .get(`/api/contacts/${contactB_Id}`)
                .set('Authorization', `Bearer ${userA.token}`);

            // API returns 404 if not found OR not accessible due to RLS/Filter
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Contact not found');
        });

        it('User A listing contacts should NOT include User B contacts', async () => {
            const res = await request(app)
                .get('/api/contacts')
                .set('Authorization', `Bearer ${userA.token}`);

            expect(res.status).toBe(200);
            const contacts = res.body.contacts;
            expect(Array.isArray(contacts)).toBe(true);

            const foundA = contacts.find((c: any) => c.id === contactA_Id);
            const foundB = contacts.find((c: any) => c.id === contactB_Id);

            expect(foundA).toBeDefined();
            expect(foundB).toBeUndefined(); // Should not see B's contact
        });
    });
});
