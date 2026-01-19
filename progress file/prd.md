ers)**

```typescript
// backend/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

// Tiered limits based on subscription
const RATE_LIMITS = {
  starter: { windowMs: 60000, max: 100 },    // 100 req/min
  pro: { windowMs: 60000, max: 1000 },       // 1000 req/min
  enterprise: { windowMs: 60000, max: 10000 } // 10k req/min
};

export function createOrgRateLimiter() {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:',
    }),
    keyGenerator: (req) => {
      // Rate limit per org (from JWT)
      const orgId = req.auth?.orgId || 'anonymous';
      return `org:${orgId}`;
    },
    handler: async (req, res) => {
      // Lookup org's plan
      const org = await db('organizations')
        .where('id', req.auth.orgId)
        .first();
      
      const tier = org?.subscription_tier || 'starter';
      const limit = RATE_LIMITS[tier];
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        tier,
        limit: limit.max,
        reset_in: limit.windowMs / 1000
      });
    },
    // Dynamic limit based on org tier
    max: async (req) => {
      const org = await db('organizations')
        .where('id', req.auth.orgId)
        .first();
      const tier = org?.subscription_tier || 'starter';
      return RATE_LIMITS[tier].max;
    }
  });
}
```

---

## 📊 MONITORING & OBSERVABILITY

### **1. Structured Logging (PII-Redacted)**

```typescript
// backend/src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Custom serializers
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      org_id: req.auth?.orgId,
      user_id: req.auth?.userId,
      // Redact sensitive headers
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for']
      }
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      duration: res.responseTime
    }),
    err: pino.stdSerializers.err
  },
  
  // PII redaction
  redact: {
    paths: [
      'patient_name',
      'phone',
      'email',
      'transcript',
      '*.patient_name',
      '*.phone',
      '*.email',
      'req.headers.authorization',
      'req.headers.cookie'
    ],
    censor: '[REDACTED]'
  },
  
  // Correlation IDs
  formatters: {
    log(object) {
      return {
        ...object,
        correlation_id: object.correlation_id || crypto.randomUUID(),
        env: process.env.NODE_ENV,
        service: 'voxanne-backend'
      };
    }
  }
});
```

### **2. Performance Metrics (Prometheus + Grafana)**

```typescript
// backend/src/lib/metrics.ts
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status', 'org_id'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]
});

// Tool call duration
export const toolCallDuration = new Histogram({
  name: 'vapi_tool_call_duration_ms',
  help: 'Duration of Vapi tool calls in ms',
  labelNames: ['tool_name', 'org_id', 'status'],
  buckets: [50, 100, 200, 500, 1000, 2000]
});

// Database query duration
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['operation', 'table'],
  buckets: [5, 10, 25, 50, 100, 250, 500]
});

// Error counter
export const errors = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'org_id']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(toolCallDuration);
register.registerMetric(dbQueryDuration);
register.registerMetric(errors);

// Express middleware
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || 'unknown',
        status: res.statusCode,
        org_id: req.auth?.orgId || 'anonymous'
      },
      duration
    );
  });
  
  next();
}

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### **3. Alerting Rules (PagerDuty Integration)**

```yaml
# alerts/voxanne-alerts.yml
groups:
  - name: voxanne_critical
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate >5% for 2 minutes"
          description: "{{ $labels.org_id }} experiencing {{ $value }}% error rate"
      
      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_ms_bucket[5m])
          ) > 2000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p95 latency >2s"
          description: "{{ $labels.route }} p95: {{ $value }}ms"
      
      # Database connection pool exhaustion
      - alert: ConnectionPoolExhaustion
        expr: |
          pg_stat_activity_count > 45
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connections >45 (limit 50)"
          description: "Risk of connection exhaustion"
      
      # Tool sync failures
      - alert: ToolSyncFailures
        expr: |
          rate(tool_sync_failures_total[10m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tool sync failing for multiple orgs"
```

---

## 🧪 TESTING STRATEGY

### **1. Multi-Tenant Isolation Tests (CI/CD Blocker)**

```typescript
// tests/security/multi-tenant-isolation.test.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import { createTestClient, createTestOrg, createTestUser } from './helpers';

describe('Multi-Tenant Isolation (CRITICAL)', () => {
  let orgA, orgB, userA, userB;
  
  beforeAll(async () => {
    orgA = await createTestOrg('Clinic A');
    orgB = await createTestOrg('Clinic B');
    userA = await createTestUser(orgA.id, 'admin');
    userB = await createTestUser(orgB.id, 'admin');
  });
  
  it('prevents cross-org appointment access', async () => {
    // Arrange - Create appointment for Org B
    const apptB = await createTestAppointment({
      org_id: orgB.id,
      patient_name: 'Secret Patient',
      scheduled_at: new Date('2026-02-01T14:00:00Z')
    });
    
    // Act - Try to access as Org A user
    const clientA = createTestClient(userA.token);
    const result = await clientA
      .from('appointments')
      .select('*')
      .eq('id', apptB.id);
    
    // Assert - MUST be empty (RLS blocks access)
    expect(result.data).toHaveLength(0);
    expect(result.error).toBeNull();  // Not an error, just filtered
  });
  
  it('prevents cross-org tool access', async () => {
    // Arrange
    const toolB = await db('org_tools').insert({
      org_id: orgB.id,
      tool_name: 'bookAppointment',
      vapi_tool_id: 'tool_xyz'
    }).returning('*');
    
    // Act
    const clientA = createTestClient(userA.token);
    const result = await clientA
      .from('org_tools')
      .select('*')
      .eq('id', toolB[0].id);
    
    // Assert
    expect(result.data).toHaveLength(0);
  });
  
  it('prevents token spoofing', async () => {
    // Arrange - Malicious token with wrong org_id
    const maliciousToken = jwt.sign(
      {
        sub: userA.id,
        app_metadata: { org_id: orgB.id }  // ← Wrong org
      },
      process.env.JWT_SECRET!
    );
    
    // Act
    const response = await fetch('/api/appointments', {
      headers: { Authorization: `Bearer ${maliciousToken}` }
    });
    
    // Assert - Should fail signature verification
    expect(response.status).toBe(401);
  });
});
```

### **2. Race Condition Tests (Stress Testing)**

```typescript
// tests/performance/race-conditions.test.ts
describe('Atomic Booking (Race Conditions)', () => {
  it('prevents double-booking under concurrent load', async () => {
    const orgId = 'test-org-id';
    const scheduledAt = new Date('2026-02-01T14:00:00Z');
    
    // Arrange - 100 concurrent booking attempts for SAME slot
    const bookingPromises = Array.from({ length: 100 }, (_, i) => 
      bookAppointment({
        orgId,
        patientName: `Patient ${i}`,
        scheduledAt
      })
    );
    
    // Act
    const results = await Promise.allSettled(bookingPromises);
    
    // Assert - EXACTLY ONE success, 99 failures
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');
    
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(99);
    
    // Verify database consistency
    const dbAppointments = await db('appointments')
      .where({ org_id: orgId, scheduled_at: scheduledAt });
    
    expect(dbAppointments).toHaveLength(1);
  });
});
```

### **3. Load Testing (Artillery.io)**

```yaml
# tests/load/booking-flow.yml
config:
  target: "https://api.voxanne.ai"
  phases:
    # Warm-up
    - duration: 60
      arrivalRate: 5
      name: "Warm-up"
    
    # Sustained load
    - duration: 300
      arrivalRate: 50
      name: "Sustained (50 RPS)"
    
    # Spike test
    - duration: 60
      arrivalRate: 200
      name: "Spike (200 RPS)"
  
  # Performance thresholds
  ensure:
    p95: 2000  # p95 <2s
    p99: 3000  # p99 <3s
    maxErrorRate: 0.01  # <1% errors

scenarios:
  - name: "Book Appointment Flow"
    flow:
      # Step 1: Vapi webhook (inbound call)
      - post:
          url: "/api/vapi/tools/bookAppointment"
          headers:
            x-vapi-signature: "{{ $randomString() }}"
            x-vapi-timestamp: "{{ $timestamp }}"
          json:
            orgId: "{{ $randomUUID() }}"
            message:
              call:
                id: "{{ $randomUUID() }}"
              toolCallList:
                - id: "{{ $randomUUID() }}"
                  function:
                    name: "bookClinicAppointment"
                    arguments:
                      patient_name: "{{ $randomString() }}"
                      preferred_time: "2026-02-01T14:00:00Z"
                      service_type: "consultation"
          
          # Assertions
          capture:
            - json: "$.result"
              as: "confirmation"
          
          expect:
            - statusCode: 200
            - contentType: json
            - hasProperty: result
```

---

## 🚦 DEPLOYMENT CHECKLIST

### **Pre-Production (Week 1)**

- [ ] **Security Hardening**
  - [ ] RLS policies on ALL tables
  - [ ] Multi-tenant isolation test suite (100% passing)
  - [ ] PII redaction in all logs
  - [ ] Secrets migrated to Supabase Vault
  - [ ] HMAC signature verification on Vapi webhooks
  - [ ] MFA enabled for admin accounts

- [ ] **Performance Optimization**
  - [ ] Strategic indexes on all query paths
  - [ ] PgBouncer deployed (transaction pooling)
  - [ ] Redis caching for clinic settings
  - [ ] Query plans verified (<200ms p95)
  - [ ] Connection pool monitoring (<80% usage)

- [ ] **Reliability**
  - [ ] Atomic booking with SERIALIZABLE isolation
  - [ ] Webhook idempotency tracking
  - [ ] Exponential backoff retry (2s, 4s, 8s)
  - [ ] Database constraints (UNIQUE on org+slot)
  - [ ] Tool sync graceful degradation

- [ ] **Observability**
  - [ ] Structured logging with correlation IDs
  - [ ] Prometheus metrics exposed (/metrics)
  - [ ] Grafana dashboards (latency, errors, throughput)
  - [ ] PagerDuty alerts (>5% error rate, >2s p95)
  - [ ] Distributed tracing (Jaeger/DataDog)

### **Production Readiness (Month 1)**

- [ ] **Compliance**
  - [ ] Audit logs (immutable, 2-year retention)
  - [ ] Data retention policies (auto-delete after 2 years)
  - [ ] DPA (Data Processing Agreement) drafted
  - [ ] HIPAA controls documented
  - [ ] Annual pentest scheduled

- [ ] **Scalability**
  - [ ] Load testing (100+ concurrent calls)
  - [ ] Auto-scaling rules (CPU >70% → scale up)
  - [ ] Database read replicas (if >1000 RPS)
  - [ ] CDN for static assets
  - [ ] Queue system for batch operations (BullMQ)

- [ ] **Documentation**
  - [ ] API documentation (OpenAPI/Swagger)
  - [ ] Runbooks for common incidents
  - [ ] Architecture decision records (ADRs)
  - [ ] Security architecture diagram
  - [ ] Disaster recovery plan

---

## 📈 SUCCESS METRICS

### **Performance (SLOs)**

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Total Latency** | p95 <2s | End-to-end (call → booking) | >2.5s for 5 min |
| **API Latency** | p95 <500ms | Backend response time | >800ms for 5 min |
| **Database Latency** | p95 <100ms | Query execution time | >200ms for 5 min |
| **Error Rate** | <1% | Failed requests / total | >5% for 2 min |
| **Uptime** | 99.95% | Monthly availability | <99.9% |

### **Security (KPIs)**

| Metric | Target | Verification |
|--------|--------|-------------|
| **Cross-Tenant Leakage** | 0 incidents | Automated tests + annual pentest |
| **PII Exposure** | 0 incidents | Log analysis + compliance audit |
| **Unauthorized Access** | 0 incidents | Failed auth attempts monitored |
| **Data Breach** | 0 incidents | HIPAA breach notification (none) |

### **Business (OKRs)**

| Objective | Key Result | Timeline |
|-----------|------------|----------|
| Launch MVP | 50 clinics onboarded | Month 3 |
| Prove scalability | 500 concurrent calls (no downtime) | Month 6 |
| HIPAA compliance | BAA signed with enterprise customer | Month 6 |
| Market validation | $50k MRR | Month 9 |
| Scale milestone | 5,000 clinics | Month 12 |

---

## 🔄 CONTINUOUS IMPROVEMENT

### **Monthly Reviews**

1. **Security Posture**
   - Review audit logs for anomalies
   - Update secrets rotation
   - Scan dependencies (npm audit)
   - Review failed auth attempts

2. **Performance Optimization**
   - Analyze slow query logs
   - Review p95/p99 latencies
   - Optimize hot paths
   - Update database indexes

3. **Incident Retrospectives**
   - RCA (Root Cause Analysis) for outages
   - Update runbooks
   - Add monitoring for blind spots
   - Share learnings with team

### **Quarterly Roadmap**

- **Q1 2026:** MVP Launch + Initial Security Hardening
- **Q2 2026:** HIPAA Compliance + Performance Optimization
- **Q3 2026:** Advanced Features (Multi-language, SMS)
- **Q4 2026:** Enterprise Features (SSO, RBAC, SLA tiers)

---

## 📚 APPENDIX

### **A. Common Mistakes & Solutions**

| Mistake | Why It's Wrong | Correct Pattern |
|---------|----------------|-----------------|
| Per-org Vapi keys | Licensing hell, credential sprawl | Single backend key |
| Tools in `model.tools` array | Deprecated API pattern | `model.toolIds` (modern) |
| Blocking on tool sync | Poor UX (slow saves) | Fire-and-forget async |
| No webhook deduplication | Double-bookings on retries | Idempotency table |
| Plaintext secrets in `.env` | Security breach risk | Supabase Vault |
| No RLS on tables | Cross-tenant data leakage | RLS on ALL tables |
| Unindexed queries | Latency collapse at scale | Strategic indexes |
| No connection pooling | Connection exhaustion | PgBouncer |

### **B. Environment Variables (Production)**

```bash
# Backend Core
NODE_ENV=production
PORT=8080
BACKEND_URL=https://api.voxanne.ai

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=postgresql://postgres:<pass>@db.project.supabase.co:5432/postgres

# Auth
JWT_SECRET=<your-secret-256-bit>

# Vapi (CRITICAL: Backend is sole provider)
VAPI_PRIVATE_KEY=<master-vapi-api-key>  # Tool registration
VAPI_PUBLIC_KEY=<vapi-public-key>       # Assistant reference
VAPI_WEBHOOK_SECRET=<webhook-hmac-secret>

# Twilio
TWILIO_ACCOUNT_SID=<from-vault>  # Encrypted in Supabase Vault
TWILIO_AUTH_TOKEN=<from-vault>

# Google Calendar
GOOGLE_CLIENT_ID=<from-vault>
GOOGLE_CLIENT_SECRET=<from-vault>

# Redis (Caching + Queues)
REDIS_URL=redis://default:<password>@redis.upstash.io:6379

# Monitoring
SENTRY_DSN=https://<key>@sentry.io/<project>
DATADOG_API_KEY=<datadog-key>

# Feature Flags
ENABLE_TOOL_SYNC=true
ENABLE_AUTO_RETRY=true
```

### **C. Database Indexes (Copy-Paste)**

```sql
-- Appointments (most critical)
CREATE INDEX idx_appointments_org_scheduled 
ON appointments(org_id, scheduled_at DESC);

CREATE INDEX idx_appointments_org_status 
ON appointments(org_id, status) 
WHERE status IN ('pending', 'confirmed');

-- Org Tools
CREATE INDEX idx_org_tools_name 
ON org_tools(tool_name);

CREATE INDEX idx_org_tools_org_name 
ON org_tools(org_id, tool_name);

-- Audit Logs
CREATE INDEX idx_audit_org_time 
ON audit_logs(org_id, timestamp DESC);

CREATE INDEX idx_audit_table_op 
ON audit_logs(table_name, operation);

-- Webhooks (for cleanup)
CREATE INDEX idx_webhooks_expiry 
ON processed_webhooks(expires_at) 
WHERE expires_at > NOW();
```

### **D. Quick Reference: Architecture Decisions**

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| **Supabase (PostgreSQL)** | Native RLS, pgvector, managed | AWS RDS (more ops overhead) |
| **Single Vapi Key** | Avoid credential sprawl | Per-org keys (licensing hell) |
| **Fire-and-forget Tool Sync** | Better UX (instant save) | Blocking sync (slow saves) |
| **Redis for Caching** | Sub-10ms reads | In-memory (not persistent) |
| **BullMQ for Queues** | Redis-backed, retries | SQS (more expensive) |
| **Pino for Logging** | Fast, structured JSON | Winston (slower) |
| **PgBouncer** | Connection pooling | Native pooling (not enough) |

---

## 🎯 FINAL RECOMMENDATION

**Status:** ✅ **PRODUCTION READY** (with Week 1 fixes)

Voxanne AI has a **solid foundation** with excellent product-market fit. The architecture is sound, but requires **critical security and reliability hardening** before handling real patient data.

### **Go-Live Blockers (Week 1)**

1. **Complete RLS test coverage** (prevent data breach)
2. **Deploy atomic booking** (prevent double-bookings)
3. **Implement PII redaction** (HIPAA compliance)
4. **Add webhook idempotency** (prevent duplicate bookings)
5. **Deploy connection pooling** (handle 50+ concurrent calls)

### **Confidence Level**

- **Security:** 85% → 99% (after Week 1 fixes)
- **Reliability:** 80% → 95% (after atomic booking)
- **Scalability:** 75% → 90% (after connection pooling)
- **Compliance:** 60% → 85% (after audit logs + DPA)

### **Risk Assessment**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Data breach | CRITICAL | LOW | RLS + pentest + audit logs |
| Double-booking | HIGH | MEDIUM | SERIALIZABLE transactions |
| Latency degradation | HIGH | MEDIUM | Indexes + caching + monitoring |
| HIPAA non-compliance | CRITICAL | LOW | Audit prep + DPA + BAA |

---

**Next Steps:**  
1. Review this PRD with engineering team  
2. Prioritize Week 1 fixes (5-day sprint)  
3. Schedule penetration test (Week 2)  
4. Begin Month 1 compliance work  
5. Set production launch date (Month 2)

**Document Owner:** Senior System Architect  
**Last Review:** 2026-01-19  
**Next Review:** 2026-02-01