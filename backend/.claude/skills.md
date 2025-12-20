# 🚀 VOXANNE MASTER SKILLS & PRODUCTION ROADMAP
**Backend & Full-Stack Development Expertise (15+ Years)**

**Document Version:** 1.0
**Last Updated:** Dec 19, 2025
**Status:** Production Roadmap - Phase 1 to Production

---

## 📌 TABLE OF CONTENTS

1. [Core Expertise Domains](#core-expertise-domains)
2. [Voxanne Architecture Mastery](#voxanne-architecture-mastery)
3. [Backend Best Practices](#backend-best-practices)
4. [Full-Stack Integration Patterns](#full-stack-integration-patterns)
5. [Database Mastery](#database-mastery)
6. [API Design & Standards](#api-design--standards)
7. [Security Deep Dive](#security-deep-dive)
8. [Performance & Optimization](#performance--optimization)
9. [DevOps & Deployment](#devops--deployment)
10. [Code Quality & Testing](#code-quality--testing)
11. [Production Readiness Checklist](#production-readiness-checklist)
12. [Phase 1→2→3→Production Roadmap](#phase-123production-roadmap)

---

## 1. CORE EXPERTISE DOMAINS

### A. Backend Engineering (15+ Years)

**Foundational Knowledge:**
- ✅ Distributed systems architecture
- ✅ Microservices vs monolithic tradeoffs
- ✅ Event-driven architecture patterns
- ✅ Message queues (RabbitMQ, Redis, Kafka)
- ✅ Async/await patterns and Promise handling
- ✅ Error handling and resilience strategies
- ✅ Rate limiting, throttling, circuit breakers
- ✅ Caching strategies (in-memory, Redis, CDN)
- ✅ Authentication & authorization (JWT, OAuth, SAML)
- ✅ Logging, monitoring, and observability

**Languages & Frameworks:**
- TypeScript/Node.js (primary)
- Express.js (lightweight, battle-tested)
- NestJS (enterprise patterns, optional upgrade)
- PostgreSQL (primary database)
- Supabase (PostgreSQL + serverless functions)

### B. Full-Stack Development (12+ Years)

**Frontend Knowledge:**
- React 18+ patterns (hooks, context, suspense)
- Next.js 14+ (App Router, Server Components)
- TypeScript for frontend type safety
- TailwindCSS for utility-first styling
- State management (Context, Zustand, Redux if needed)
- Form handling & validation
- Real-time updates (WebSockets, SSE)
- Authentication flows (session, JWT, OAuth)
- Performance optimization (code splitting, lazy loading)

**Integration Skills:**
- Frontend-backend API contracts
- CORS configuration and security
- WebSocket communication
- Real-time data synchronization
- File upload/download handling
- Error boundary implementation

### C. Database Engineering (14+ Years)

**PostgreSQL Mastery:**
- Schema design and normalization
- Query optimization (indexes, EXPLAIN ANALYZE)
- Transaction management and ACID compliance
- Window functions and CTEs
- JSON/JSONB operations
- Replication and high availability
- Connection pooling (PgBouncer)
- Backup & recovery strategies

**Supabase (PostgreSQL + Cloud):**
- Real-time subscriptions
- Row-level security (RLS)
- Serverless functions
- Storage buckets with signed URLs
- Auth integration
- Vector embeddings for AI features

---

## 2. VOXANNE ARCHITECTURE MASTERY

### Current State (Phase 1 - Complete)

```
┌─────────────────────────────────────────────────────────────┐
│                    VOXANNE SYSTEM DESIGN                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Inbound    │  │  Outbound    │  │   Users      │       │
│  │   (Vapi)     │  │  (Twilio)    │  │  (Browser)   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                   │
│                    ┌──────▼────────┐                         │
│                    │  Express.js    │                         │
│                    │  Backend       │                         │
│                    │  (Port 3001)   │                         │
│                    └──────┬─────────┘                         │
│                           │                                   │
│        ┌──────────────────┼──────────────────┐               │
│        │                  │                  │               │
│   ┌────▼─────┐      ┌────▼────┐      ┌─────▼──┐            │
│   │ call_logs │      │  calls   │      │ Vapi   │            │
│   │ (inbound) │      │(outbound)│      │Poller  │            │
│   └────┬─────┘      └────┬────┘      └─────┬──┘            │
│        │                 │                  │                │
│        └─────────────────┼──────────────────┘                │
│                          │                                    │
│                   ┌──────▼──────────┐                        │
│                   │ Supabase        │                        │
│                   │ PostgreSQL +    │                        │
│                   │ Storage (Signed │                        │
│                   │ URLs)           │                        │
│                   └─────────────────┘                        │
│                          │                                    │
│              ┌───────────┴───────────┐                       │
│              │                       │                       │
│         ┌────▼────┐          ┌──────▼──┐                    │
│         │ call_   │          │ call_   │                    │
│         │recordings│         │recordings│                   │
│         │bucket   │          │bucket   │                    │
│         └─────────┘          └────┬────┘                    │
│                                    │ signed URLs (1hr)      │
│              ┌─────────────────────┴────────┐               │
│              │                              │               │
│         ┌────▼───┐                   ┌─────▼──┐            │
│         │Next.js │                   │Audio   │            │
│         │Frontend│                   │Players │            │
│         │ Port   │                   │        │            │
│         │ 3000   │                   └────────┘            │
│         └────────┘                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Architecture Principles

**1. Dual-Table Pattern**
```typescript
// INBOUND CALLS (call_logs) - From Vapi
interface InboundCall {
  id: UUID;
  vapi_call_id: string;
  phone_number: string;
  caller_name: string;
  call_type: 'inbound';
  recording_storage_path: string;
  recording_signed_url: string; // 1-hour expiry
  transcript: Transcript[];
  sentiment_score: number;
  created_at: timestamp;
}

// OUTBOUND CALLS (calls) - From Twilio
interface OutboundCall {
  id: UUID;
  org_id: UUID;
  phone_number: string;
  caller_name: string;
  call_type: 'outbound';
  recording_url: string; // Twilio direct URL
  transcript: Transcript[];
  sentiment_score: number;
  call_date: timestamp;
}

// MERGE PATTERN
const allCalls = [
  ...inboundCalls.map(c => ({...c, type: 'inbound'})),
  ...outboundCalls.map(c => ({...c, type: 'outbound'}))
].sort((a, b) => new Date(b.call_date || b.created_at) - new Date(a.call_date || a.created_at))
 .slice((page-1) * limit, page * limit);
```

**Why This Works:**
- Inbound recordings = Vapi → Supabase Storage (high control)
- Outbound recordings = Twilio API (their infrastructure)
- Merge in application layer (flexibility, no complex SQL joins)
- Works at scale (up to millions of calls)

**2. Recording Pipeline Architecture**

```
Vapi Call Completes
    ↓
Vapi Webhook → Backend
    ↓
Vapi Poller (every 30 sec)
    ├─ Fetch completed calls from Vapi API
    ├─ Download WAV file
    ├─ Upload to Supabase Storage
    ├─ Generate signed URL (1-hour expiry)
    ├─ Update call_logs with recording_storage_path
    └─ Update call_logs with recording_signed_url
    ↓
Frontend Requests Recording
    ├─ GET /api/calls-dashboard/:callId
    └─ Returns current signed URL
```

**Critical Implementation Details:**
- Poller runs independent of request/response cycle
- No blocking on call creation
- Async recording upload doesn't block other operations
- Signed URL expiry requires refresh strategy (See: Signed URL Management)

**3. Event-Driven Webhooks**

```typescript
// Webhook Flow
POST /webhooks/vapi → {
  event: 'call.ended',
  callId: string,
  duration: number,
  recording: true|false
}

→ Backend creates call_logs entry (initial)
→ Records vapi_call_id
→ Vapi Poller periodically polls for updates
→ Updates with actual recording path when available
```

---

## 3. BACKEND BEST PRACTICES

### A. Project Structure

```
backend/
├── src/
│   ├── app.ts                      # Express app initialization
│   ├── server.ts                   # Entry point
│   ├── config/                     # Configuration management
│   │   ├── environment.ts          # Env variables & validation
│   │   └── constants.ts            # App constants
│   ├── routes/                     # API routes
│   │   ├── calls-dashboard.ts      # Dashboard API
│   │   ├── webhooks.ts             # Vapi/Twilio webhooks
│   │   └── auth.ts                 # Auth routes
│   ├── services/                   # Business logic
│   │   ├── vapi-poller.ts          # Recording capture
│   │   ├── twilio.ts               # Twilio integration
│   │   ├── vapi.ts                 # Vapi API client
│   │   └── recording.ts            # Recording processing
│   ├── middleware/                 # Express middleware
│   │   ├── auth.ts                 # Auth verification
│   │   ├── error.ts                # Error handling
│   │   └── cors.ts                 # CORS configuration
│   ├── lib/                        # Utilities
│   │   ├── supabase.ts             # Supabase client
│   │   ├── logger.ts               # Logging service
│   │   └── http-client.ts          # HTTP utilities
│   └── types/                      # TypeScript types
│       ├── calls.ts
│       ├── vapi.ts
│       └── index.ts
├── tests/                          # Test files
├── .env.example                    # Environment template
├── tsconfig.json                   # TypeScript config
└── package.json
```

### B. Express.js Setup Best Practices

```typescript
// ✅ CORRECT: app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Express = express();

// 1. Security middleware (must be first)
app.use(helmet()); // Security headers

// 2. CORS (configurable for production)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// 3. Body parsing (with limits)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 4. Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 5. Routes
app.use('/api/calls-dashboard', callsRouter);
app.use('/webhooks', webhooksRouter);

// 6. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 7. Error handling (must be last)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('ERROR:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
```

### C. Error Handling Pattern

```typescript
// ✅ PRODUCTION ERROR HANDLING

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Use in routes:
router.get('/api/calls-dashboard/:callId', async (req, res, next) => {
  try {
    const { callId } = req.params;

    if (!callId || !isValidUUID(callId)) {
      throw new ApiError(400, 'Invalid call ID', 'INVALID_ID');
    }

    const call = await getCall(callId);
    if (!call) {
      throw new ApiError(404, 'Call not found', 'NOT_FOUND');
    }

    res.json(call);
  } catch (error) {
    next(error); // Passes to error middleware
  }
});

// Error middleware:
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.code || 'ERROR',
      message: err.message,
    });
  }

  // Unknown errors
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});
```

### D. Environment Configuration

```typescript
// ✅ config/environment.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().default('3001'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  VAPI_API_KEY: z.string(),
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  FRONTEND_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);

// Usage:
export const config = {
  port: parseInt(env.PORT),
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  vapi: {
    apiKey: env.VAPI_API_KEY,
  },
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
  },
};
```

### E. Logging Best Practices

```typescript
// ✅ lib/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  constructor(private context: string) {}

  debug(msg: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`[${this.context}] DEBUG:`, msg, data);
    }
  }

  info(msg: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`[${this.context}] INFO:`, msg, data);
    }
  }

  warn(msg: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[${this.context}] WARN:`, msg, data);
    }
  }

  error(msg: string, error?: Error, data?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[${this.context}] ERROR:`, msg, {
        message: error?.message,
        stack: error?.stack,
        ...data,
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevel = LogLevel[config.logLevel.toUpperCase()] ?? LogLevel.INFO;
    return level >= minLevel;
  }
}

export const createLogger = (context: string) => new Logger(context);
```

### F. Async Service Pattern

```typescript
// ✅ services/vapi-poller.ts
import { createLogger } from '../lib/logger';

const logger = createLogger('VapiPoller');

class VapiPoller {
  private intervalId: NodeJS.Timer | null = null;

  start() {
    logger.info('Starting Vapi poller...');

    // Run immediately
    this.poll().catch(err => logger.error('Poll failed', err));

    // Then every 30 seconds
    this.intervalId = setInterval(() => {
      this.poll().catch(err => logger.error('Poll failed', err));
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Vapi poller stopped');
    }
  }

  private async poll() {
    try {
      const completedCalls = await this.fetchCompletedCalls();

      for (const call of completedCalls) {
        await this.processCall(call);
      }

      logger.debug(`Processed ${completedCalls.length} calls`);
    } catch (error) {
      logger.error('Poll error', error as Error);
      // Continue on error - don't stop the poller
    }
  }

  private async processCall(vapiCall: VapiCall) {
    try {
      // 1. Check if already processed
      const existing = await supabase
        .from('call_logs')
        .select('id')
        .eq('vapi_call_id', vapiCall.id)
        .single();

      if (!existing.data) {
        return; // Already processed
      }

      // 2. Download recording
      const recording = await this.downloadRecording(vapiCall.recordingUrl);

      // 3. Upload to Supabase
      const storagePath = `calls/inbound/${vapiCall.id}/${Date.now()}.wav`;
      await supabase.storage
        .from('call-recordings')
        .upload(storagePath, recording);

      // 4. Generate signed URL
      const { data } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(storagePath, 3600); // 1 hour

      // 5. Update database
      await supabase
        .from('call_logs')
        .update({
          recording_storage_path: storagePath,
          recording_signed_url: data.signedUrl,
        })
        .eq('vapi_call_id', vapiCall.id);

      logger.info('Call processed', { vapiCallId: vapiCall.id });
    } catch (error) {
      logger.error('Failed to process call', error as Error, {
        vapiCallId: vapiCall.id
      });
    }
  }

  private async downloadRecording(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async fetchCompletedCalls(): Promise<VapiCall[]> {
    // Implementation...
  }
}

export const vapiPoller = new VapiPoller();
```

---

## 4. FULL-STACK INTEGRATION PATTERNS

### A. API Contract Definition

```typescript
// ✅ types/api.ts
// Define all API responses in a single source of truth

export interface CallsResponse {
  calls: Call[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CallDetailResponse extends Call {
  recording_url?: string;
  recording_signed_url?: string;
  transcript_full?: string;
  related_calls?: Call[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}

// Frontend imports this for type safety
```

### B. Frontend API Layer

```typescript
// ✅ src/lib/api.ts
import { CallsResponse, CallDetailResponse } from './api-types';

class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async getCalls(page: number = 1, limit: number = 10): Promise<CallsResponse> {
    const res = await fetch(`${this.baseUrl}/api/calls-dashboard?page=${page}&limit=${limit}`);

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    return res.json();
  }

  async getCallDetail(callId: string): Promise<CallDetailResponse> {
    const res = await fetch(`${this.baseUrl}/api/calls-dashboard/${callId}`);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Call not found');
      }
      throw new Error(`API error: ${res.status}`);
    }

    return res.json();
  }

  async downloadRecording(callId: string): Promise<Blob> {
    const call = await this.getCallDetail(callId);
    const recordingUrl = call.recording_signed_url || call.recording_url;

    if (!recordingUrl) {
      throw new Error('No recording available');
    }

    const res = await fetch(recordingUrl);
    if (!res.ok) {
      throw new Error('Failed to download recording');
    }

    return res.blob();
  }
}

export const apiClient = new ApiClient();
```

### C. React Hook for Data Fetching

```typescript
// ✅ src/hooks/useCallsData.ts
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { CallsResponse } from '@/types/api';

export function useCallsData(page: number = 1) {
  const [data, setData] = useState<CallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCalls = async () => {
      try {
        setLoading(true);
        const result = await apiClient.getCalls(page);

        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCalls();

    return () => {
      isMounted = false;
    };
  }, [page]);

  return { data, loading, error };
}
```

### D. Error Boundary Component

```typescript
// ✅ src/components/ErrorBoundary.tsx
'use client';

import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error)
      ) : (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-red-800 font-bold">Something went wrong</h2>
          <p className="text-red-600">{this.state.error.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 5. DATABASE MASTERY

### A. Schema Design for Voxanne

```sql
-- ✅ OPTIMIZED SCHEMA FOR PRODUCTION

-- Call Logs Table (Inbound - Vapi)
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_call_id TEXT UNIQUE NOT NULL,

  -- Call Information
  phone_number TEXT,
  caller_name TEXT,
  call_type TEXT CHECK (call_type = 'inbound'),
  status TEXT DEFAULT 'pending',
  duration_seconds INT DEFAULT 0,

  -- Recording Information
  recording_storage_path TEXT,
  recording_signed_url TEXT,
  recording_duration_seconds INT,

  -- Analysis
  transcript JSONB DEFAULT '[]',
  sentiment_score FLOAT,
  sentiment_label TEXT,
  action_items JSONB DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Indexes
  CONSTRAINT no_null_vapi_id CHECK (vapi_call_id IS NOT NULL)
);

CREATE INDEX idx_call_logs_vapi_call_id ON call_logs(vapi_call_id);
CREATE INDEX idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX idx_call_logs_phone_number ON call_logs(phone_number);
CREATE INDEX idx_call_logs_has_recording ON call_logs(recording_storage_path)
  WHERE recording_storage_path IS NOT NULL;

-- Calls Table (Outbound - Twilio)
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),

  -- Call Information
  phone_number TEXT NOT NULL,
  caller_name TEXT,
  call_type TEXT CHECK (call_type = 'outbound'),
  status TEXT DEFAULT 'pending',
  duration_seconds INT DEFAULT 0,

  -- Recording Information
  recording_url TEXT,
  recording_sid TEXT,

  -- Analysis
  transcript JSONB DEFAULT '[]',
  sentiment_score FLOAT,
  sentiment_label TEXT,
  action_items JSONB DEFAULT '[]',

  -- Links
  vapi_call_id TEXT,
  twilio_sid TEXT,

  -- Metadata
  call_date TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_calls_org_id ON calls(org_id);
CREATE INDEX idx_calls_phone_number ON calls(phone_number);
CREATE INDEX idx_calls_call_date ON calls(call_date DESC);
CREATE INDEX idx_calls_has_recording ON calls(recording_url)
  WHERE recording_url IS NOT NULL;

-- Enable RLS for multi-tenancy
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their org calls"
  ON calls
  FOR SELECT
  USING (org_id = auth.uid());
```

### B. Query Optimization

```typescript
// ✅ EFFICIENT DASHBOARD QUERY

// WRONG: N+1 query problem
const calls = await supabase.from('calls').select('*');
for (const call of calls) {
  const details = await supabase
    .from('call_details')
    .select('*')
    .eq('call_id', call.id);
  // This runs N queries for N calls
}

// RIGHT: Single query with joins
const { data } = await supabase
  .from('calls')
  .select(`
    *,
    call_details(*)
  `)
  .order('call_date', { ascending: false })
  .range((page - 1) * limit, page * limit - 1);
```

### C. Caching Strategy

```typescript
// ✅ Redis Caching for High-Traffic Endpoints

class CacheManager {
  constructor(private redis: RedisClient) {}

  async getCallsWithCache(page: number, limit: number) {
    const cacheKey = `calls:page:${page}:limit:${limit}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from DB
    const data = await this.fetchCalls(page, limit);

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(data));

    return data;
  }

  async invalidateCallsCache() {
    // Clear all call-related cache
    const keys = await this.redis.keys('calls:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

---

## 6. API DESIGN & STANDARDS

### A. RESTful Principles

```typescript
// ✅ CORRECT API DESIGN

// GET /api/calls-dashboard
// Purpose: List all calls with pagination
// Response: { calls: Call[], pagination: Pagination }
// Query Params: page, limit, call_type, sort

// GET /api/calls-dashboard/:callId
// Purpose: Get single call with full details
// Response: { id, phone_number, ..., recording_url, transcript_full }

// POST /api/calls-dashboard/:callId/download-recording
// Purpose: Track recording download
// Body: { timestamp: ISO8601 }
// Response: { success: true }

// DELETE /api/calls-dashboard/:callId
// Purpose: Delete call (admin only)
// Response: { success: true }

// Versioning is important as API evolves
// POST /api/v1/calls-dashboard
// POST /api/v2/calls-dashboard (with new features)
// Keep both for backwards compatibility
```

### B. Pagination Pattern

```typescript
// ✅ CURSOR-BASED PAGINATION (better than offset)

interface CursorPaginationRequest {
  limit: number;
  cursor?: string; // Base64 encoded ID
}

interface CursorPaginationResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

async function getCalls(limit: number, cursor?: string): Promise<CursorPaginationResponse<Call>> {
  let query = supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1); // Get one extra to detect if there are more

  if (cursor) {
    const id = Buffer.from(cursor, 'base64').toString('utf-8');
    query = query.gt('created_at', id);
  }

  const { data } = await query;

  const items = data!.slice(0, limit);
  const hasMore = data!.length > limit;

  const nextCursor = hasMore
    ? Buffer.from(items[items.length - 1].created_at).toString('base64')
    : undefined;

  return { items, nextCursor, hasMore };
}
```

### C. Rate Limiting

```typescript
// ✅ RATE LIMITING MIDDLEWARE

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const redisClient = redis.createClient();

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

// Apply to sensitive endpoints
app.get('/api/calls-dashboard/:callId/download-recording', limiter, downloadHandler);
```

---

## 7. SECURITY DEEP DIVE

### A. Authentication & Authorization

```typescript
// ✅ PRODUCTION AUTH IMPLEMENTATION

// 1. Verify JWT Token
export async function verifyToken(token: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload as User;
  } catch (error) {
    return null;
  }
}

// 2. Auth Middleware
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).user = user;
  next();
};

// 3. Role-Based Access Control
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

// 4. Usage
app.delete(
  '/api/calls-dashboard/:callId',
  authMiddleware,
  requireRole(['admin', 'superuser']),
  deleteCallHandler
);
```

### B. Signed URLs for Recording Access

```typescript
// ✅ SECURE SIGNED URL GENERATION

async function generateSignedUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  const { data } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(storagePath, expiresIn);

  if (!data) {
    throw new Error('Failed to generate signed URL');
  }

  return data.signedUrl;
}

// Signed URLs are:
// - Time-limited (1 hour expiry)
// - Single-use (tokens are invalidated after generation)
// - Cryptographically signed (can't be tampered with)
// - Not exposed to frontend until needed
```

### C. Input Validation

```typescript
// ✅ ZODVALIDATION FOR INPUT SAFETY

import { z } from 'zod';

const CallFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  call_type: z.enum(['inbound', 'outbound']).optional(),
  search: z.string().max(255).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
});

type CallFilter = z.infer<typeof CallFilterSchema>;

router.get('/api/calls-dashboard', async (req, res) => {
  try {
    const filters = CallFilterSchema.parse(req.query);

    // filters is now type-safe and validated
    const calls = await getCalls(filters);
    res.json(calls);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
    }
    next(error);
  }
});
```

### D. OWASP Top 10 Protection

```typescript
// ✅ SECURITY HEADERS

app.use(helmet()); // Enables:
// - Content-Security-Policy
// - X-Frame-Options: DENY
// - X-Content-Type-Options: nosniff
// - X-XSS-Protection: 1; mode=block
// - Strict-Transport-Security
// - Referrer-Policy
// - Permissions-Policy

// ✅ CORS CONFIGURATION
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ RATE LIMITING (prevents brute force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

// ✅ SQL INJECTION PREVENTION (use parameterized queries)
// WRONG:
const query = `SELECT * FROM calls WHERE id = '${callId}'`;

// RIGHT:
const { data } = await supabase
  .from('calls')
  .select('*')
  .eq('id', callId); // Parameter is automatically escaped

// ✅ XSS PREVENTION (Content-Security-Policy header handles this)
// WRONG:
res.json({ html: userInput }); // User input rendered as HTML

// RIGHT:
res.json({ text: userInput }); // User input treated as text
```

---

## 8. PERFORMANCE & OPTIMIZATION

### A. Database Query Optimization

```typescript
// ✅ EXPLAIN ANALYZE TO FIND SLOW QUERIES

// Run in psql:
EXPLAIN ANALYZE
SELECT * FROM calls
WHERE call_date > now() - interval '30 days'
ORDER BY call_date DESC
LIMIT 10;

// Look for:
// - Sequential Scans (bad - use indexes)
// - High cost estimates
// - High actual rows

// Add index if missing:
CREATE INDEX idx_calls_call_date_recent ON calls(call_date DESC)
WHERE call_date > now() - interval '90 days';
```

### B. Connection Pooling

```typescript
// ✅ PgBouncer for Connection Pooling

// In backend/pgbouncer.ini:
[databases]
voxanne = host=db.supabase.co port=5432 dbname=voxanne

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

### C. Caching Layers

```
┌─────────────────────────────────────────┐
│      Browser (HTTP Cache)               │
│  Cache-Control: max-age=300             │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      CDN (CloudFlare, Vercel)           │
│  Static content cached for 1 hour       │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Next.js Server (ISR)               │
│  Revalidate: 5 minutes                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Redis (Application Cache)          │
│  Calls list cached for 5 minutes        │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Database (Source of Truth)         │
│  PostgreSQL with indexes                │
└─────────────────────────────────────────┘
```

### D. Frontend Performance

```typescript
// ✅ CODE SPLITTING
import dynamic from 'next/dynamic';

// Load RecordingPlayer only when needed
const RecordingPlayer = dynamic(() => import('@/components/RecordingPlayer'), {
  loading: () => <div>Loading player...</div>,
  ssr: false,
});

// ✅ IMAGE OPTIMIZATION
import Image from 'next/image';

<Image
  src="/avatar.jpg"
  alt="User avatar"
  width={48}
  height={48}
  priority // Load immediately
  quality={75} // Compress
/>

// ✅ LAZY LOADING
<RecordingPlayer recording={call.recording_url} loading="lazy" />

// ✅ BATCH UPDATES
const [updates, setUpdates] = useState([]);

const scheduleUpdate = (id: string) => {
  setUpdates(prev => [...prev, id]);
};

useEffect(() => {
  const timer = setTimeout(() => {
    // Send all updates in one request
    apiClient.bulkUpdate(updates);
    setUpdates([]);
  }, 500); // Debounce for 500ms

  return () => clearTimeout(timer);
}, [updates]);
```

---

## 9. DEVOPS & DEPLOYMENT

### A. Docker Setup

```dockerfile
# ✅ Multi-stage build for optimized image

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### B. Environment Management

```yaml
# .env.production
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx

# Vapi
VAPI_API_KEY=xxxx
VAPI_WEBHOOK_SECRET=xxxx

# Twilio
TWILIO_ACCOUNT_SID=xxxx
TWILIO_AUTH_TOKEN=xxxx

# Frontend
FRONTEND_URL=https://voxanne.com
ALLOWED_ORIGINS=https://voxanne.com,https://app.voxanne.com

# JWT
JWT_SECRET=<use strong random 32-character string>

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

### C. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push Docker image
        env:
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
        run: |
          docker build -t voxanne-backend:latest .
          docker tag voxanne-backend:latest $DOCKER_USERNAME/voxanne-backend:${{ github.sha }}
          echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
          docker push $DOCKER_USERNAME/voxanne-backend:${{ github.sha }}

      - name: Deploy to production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          ssh -i $DEPLOY_KEY deploy@prod.voxanne.com 'cd /app && docker pull ... && docker-compose up -d'
```

### D. Monitoring & Logging

```typescript
// ✅ Sentry for Error Tracking
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());

// ✅ Structured Logging
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

logger.info({
  context: 'VapiPoller',
  action: 'processing_call',
  vapiCallId: 'xxx',
  duration_ms: 234
});
```

---

## 10. CODE QUALITY & TESTING

### A. Unit Testing

```typescript
// ✅ Jest + Supertest for API testing

import request from 'supertest';
import app from '../app';

describe('GET /api/calls-dashboard', () => {
  it('should return paginated calls', async () => {
    const res = await request(app)
      .get('/api/calls-dashboard')
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('calls');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.calls).toBeInstanceOf(Array);
    expect(res.body.pagination.page).toBe(1);
  });

  it('should filter by call_type', async () => {
    const res = await request(app)
      .get('/api/calls-dashboard')
      .query({ call_type: 'inbound' });

    expect(res.status).toBe(200);
    res.body.calls.forEach(call => {
      expect(call.call_type).toBe('inbound');
    });
  });

  it('should validate page parameter', async () => {
    const res = await request(app)
      .get('/api/calls-dashboard')
      .query({ page: -1 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
```

### B. Integration Testing

```typescript
// ✅ Test full flow including database

describe('Call Recording Pipeline', () => {
  beforeEach(async () => {
    // Clear test data
    await supabase.from('call_logs').delete().neq('id', 'null');
  });

  it('should process call and generate signed URL', async () => {
    // 1. Simulate Vapi webhook
    const webhookPayload = {
      event: 'call.ended',
      callId: 'test-vapi-123',
      recordingUrl: 'https://example.com/recording.wav',
    };

    // 2. Create call_logs entry
    await supabase.from('call_logs').insert({
      vapi_call_id: webhookPayload.callId,
      phone_number: '+1234567890',
      caller_name: 'Test User',
      call_type: 'inbound',
    });

    // 3. Simulate Vapi Poller processing
    await vapiPoller.processCall(webhookPayload);

    // 4. Verify recording was uploaded and URL generated
    const { data } = await supabase
      .from('call_logs')
      .select('recording_storage_path, recording_signed_url')
      .eq('vapi_call_id', webhookPayload.callId)
      .single();

    expect(data.recording_storage_path).toBeDefined();
    expect(data.recording_signed_url).toBeDefined();
    expect(data.recording_signed_url).toContain('token=');
  });
});
```

### C. Load Testing

```bash
# ✅ Apache JMeter or k6 for load testing

# Install k6
npm install -g k6

# Create load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m30s', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
};

export default function () {
  const response = http.get('http://localhost:3001/api/calls-dashboard');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}

# Run test
k6 run load-test.js
```

---

## 11. PRODUCTION READINESS CHECKLIST

### A. Pre-Deployment Checklist

- [ ] **Code Quality**
  - [ ] All tests passing (`npm run test`)
  - [ ] No console.log statements (use logger)
  - [ ] No hardcoded secrets (use env vars)
  - [ ] TypeScript strict mode enabled (`strict: true`)
  - [ ] ESLint passing (`npm run lint`)
  - [ ] Code coverage > 80% (`npm run coverage`)

- [ ] **Security**
  - [ ] Auth bypass removed (`.env` auth bypass disabled)
  - [ ] JWT_SECRET is strong (32+ random characters)
  - [ ] CORS origins restricted to production domains
  - [ ] Rate limiting enabled on sensitive endpoints
  - [ ] Input validation for all user input
  - [ ] SQL injection prevention (parameterized queries)
  - [ ] XSS prevention (CSP headers enabled)
  - [ ] CSRF protection enabled
  - [ ] Secrets not in git history (use git-secrets hook)

- [ ] **Database**
  - [ ] All indexes created (performance verified with EXPLAIN ANALYZE)
  - [ ] Backups scheduled (daily snapshots)
  - [ ] Replication configured (high availability)
  - [ ] Row-level security (RLS) policies configured
  - [ ] Connection pooling set up (PgBouncer)
  - [ ] Database migrations tested in staging

- [ ] **Monitoring**
  - [ ] Error tracking (Sentry or similar)
  - [ ] Application logging configured
  - [ ] Performance monitoring enabled
  - [ ] Uptime monitoring configured
  - [ ] Alert thresholds set (error rate, response time, etc.)

- [ ] **Deployment**
  - [ ] Dockerfile optimized (multi-stage build)
  - [ ] Docker image scanned for vulnerabilities
  - [ ] Environment variables documented
  - [ ] Health check endpoint implemented
  - [ ] Graceful shutdown implemented
  - [ ] Rollback plan documented

- [ ] **Documentation**
  - [ ] README.md updated with setup instructions
  - [ ] API documentation (Swagger/OpenAPI)
  - [ ] Database schema documented
  - [ ] Environment variables documented
  - [ ] Troubleshooting guide created
  - [ ] Runbooks for common issues

- [ ] **Performance**
  - [ ] Frontend bundle size < 200KB (gzip)
  - [ ] Largest Contentful Paint < 2.5s
  - [ ] First Input Delay < 100ms
  - [ ] Cumulative Layout Shift < 0.1
  - [ ] API response time < 200ms (p95)
  - [ ] Database queries optimized (< 50ms)

### B. Launch Checklist

- [ ] Staging environment matches production
- [ ] Load testing completed (handles 10x peak load)
- [ ] Smoke tests pass in staging
- [ ] Database backup taken
- [ ] Rollback plan tested
- [ ] Team briefed on monitoring alerts
- [ ] Incident response team on standby
- [ ] Deploy during low-traffic window (off-peak)
- [ ] Monitor error rates and latency for 1 hour post-deploy
- [ ] Verify frontend can communicate with backend
- [ ] Test recording download flow end-to-end

### C. Post-Deployment Monitoring

```typescript
// ✅ Health check endpoint for uptime monitoring
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'pending',
      supabase: 'pending',
      redis: 'pending',
    },
  };

  // Quick database check
  supabase.from('call_logs').select('count').single()
    .then(() => {
      health.checks.database = 'ok';
      res.json(health);
    })
    .catch(err => {
      health.checks.database = 'error';
      health.status = 'degraded';
      res.status(503).json(health);
    });
});

// Monitor these metrics:
// - Requests per second
// - Error rate (5xx errors)
// - Response time (p50, p95, p99)
// - Database connection count
// - Recording processing latency
```

---

## 12. PHASE 1→2→3→PRODUCTION ROADMAP

### PHASE 1: CORE FUNCTIONALITY ✅ (COMPLETED)

**Status:** Dashboard shows inbound/outbound calls with recordings

**Completed:**
- ✅ Dual-table query (call_logs + calls)
- ✅ Call detail endpoint with recording URLs
- ✅ Recording playback UI
- ✅ Demo call filtering
- ✅ Frontend auth bypass (for testing)

**Code:**
- `backend/src/routes/calls-dashboard.ts`
- `src/app/dashboard/calls/page.tsx`
- `src/components/RecordingPlayer.tsx`

---

### PHASE 2: PRODUCTION HARDENING (READY TO START)

**Focus:** Make Phase 1 production-ready

#### 2.1 Remove Auth Bypass
```typescript
// Before (current):
if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === 'true') {
  // Allow dashboard access without auth
}

// After (production):
// Remove this conditional
// Enforce real auth on all protected routes
```

**Steps:**
1. Remove `NEXT_PUBLIC_E2E_AUTH_BYPASS` from `.env.local`
2. Remove auth bypass logic from `AuthContext.tsx`
3. Remove auth bypass from `DashboardGate.tsx`
4. Implement proper login flow (Supabase Auth)
5. Verify auth works end-to-end

#### 2.2 Implement Recording Download Audit
```typescript
// New table: call_download_logs
CREATE TABLE call_download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES call_logs(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  downloaded_at TIMESTAMP DEFAULT now(),
  file_size INT,
  client_info JSONB
);

// API endpoint to log download
POST /api/calls-dashboard/:callId/download-recording
Body: { timestamp: ISO8601 }
Response: { success: true }
```

#### 2.3 Implement Signed URL Refresh
```typescript
// Problem: Signed URLs expire after 1 hour
// Solution: Refresh on-demand

GET /api/calls-dashboard/:callId/refresh-recording-url
Response: {
  recording_url: 'https://...?token=new_token',
  expires_at: ISO8601
}
```

**Implementation:**
```typescript
router.get('/api/calls-dashboard/:callId/refresh-recording-url', async (req, res) => {
  const { callId } = req.params;

  const { data: call } = await supabase
    .from('call_logs')
    .select('recording_storage_path')
    .eq('id', callId)
    .single();

  if (!call || !call.recording_storage_path) {
    return res.status(404).json({ error: 'Recording not found' });
  }

  // Generate fresh signed URL
  const { data: { signedUrl } } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(call.recording_storage_path, 3600);

  // Update database with new URL
  await supabase
    .from('call_logs')
    .update({ recording_signed_url: signedUrl })
    .eq('id', callId);

  res.json({
    recording_url: signedUrl,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
});
```

#### 2.4 Add Recording Search
```typescript
// Allow filtering by:
// - Date range
// - Phone number
// - Caller name
// - Sentiment (positive/negative/neutral)
// - Call duration
// - Call type (inbound/outbound)

GET /api/calls-dashboard?
  start_date=2025-01-01&
  end_date=2025-01-31&
  phone_number=%2B1234567890&
  sentiment=positive&
  duration_min=60
```

#### 2.5 Full Transcript Implementation
```typescript
// Display full transcript in call detail modal
// Format: [timestamp] Speaker: "Text"

interface Transcript {
  timestamp: number; // milliseconds
  speaker: 'caller' | 'agent' | 'system';
  text: string;
  confidence?: number;
}

// Show in UI with playback scrubbing
// Click timestamp → jump to that point in recording
```

---

### PHASE 3: ANALYTICS & INSIGHTS (AFTER PHASE 2)

**Focus:** Business intelligence dashboard

#### 3.1 Analytics Tables
```sql
-- Daily aggregates for fast queries
CREATE TABLE call_analytics_daily (
  date DATE PRIMARY KEY,
  total_calls INT,
  inbound_calls INT,
  outbound_calls INT,
  avg_duration_seconds INT,
  avg_sentiment_score FLOAT,
  recording_count INT,
  storage_used_mb INT
);

-- Create daily
INSERT INTO call_analytics_daily
SELECT
  DATE(created_at),
  COUNT(*),
  COUNT(CASE WHEN call_type = 'inbound' THEN 1 END),
  COUNT(CASE WHEN call_type = 'outbound' THEN 1 END),
  AVG(duration_seconds),
  AVG(sentiment_score),
  COUNT(CASE WHEN recording_storage_path IS NOT NULL THEN 1 END),
  SUM(COALESCE(recording_size, 0)) / 1024 / 1024
FROM call_logs
GROUP BY DATE(created_at);
```

#### 3.2 Analytics Endpoints
```typescript
GET /api/analytics/summary
Response: {
  period: '2025-01-01 to 2025-01-31',
  calls: {
    total: 1250,
    inbound: 850,
    outbound: 400,
    completed: 1200,
    failed: 50,
  },
  duration: {
    avg: 245,  // seconds
    min: 5,
    max: 1800,
  },
  sentiment: {
    positive: 35.2,
    negative: 12.4,
    neutral: 52.4,
  },
  recordings: {
    total: 920,
    storage_used_gb: 450,
  },
}

GET /api/analytics/chart/daily
Response: {
  data: [
    { date: '2025-01-01', calls: 42, avg_duration: 240 },
    { date: '2025-01-02', calls: 38, avg_duration: 255 },
    ...
  ]
}
```

#### 3.3 Analytics UI Components
```typescript
// Dashboard components to add:
// 1. Key metrics cards (total calls, avg duration, sentiment)
// 2. Line chart (calls over time)
// 3. Pie chart (inbound vs outbound)
// 4. Heatmap (calls by hour of day)
// 5. Sentiment gauge
// 6. Top calling numbers
// 7. Storage usage gauge
```

---

### PRODUCTION: SCALE & RELIABILITY

**After Phase 3 is complete:**

#### Scaling Considerations

```
Current State:
- Single Node.js process
- Single database connection
- No caching layer
- Handles ~10 calls/minute

Production Scaling (10x):
- Load balancer (HAProxy, Nginx)
- 3-5 Node.js processes
- Connection pooling (PgBouncer)
- Redis cache layer
- CDN for signed URLs
- Handles ~100 calls/minute

Enterprise Scaling (100x):
- Kubernetes cluster
- Auto-scaling based on load
- Database read replicas
- Redis cluster
- Message queue (optional, for async processing)
- Handles ~1000 calls/minute
```

#### Reliability Improvements

1. **Database Replication**
   ```sql
   -- Primary-standby replication
   -- Automatic failover with pg_auto_failover
   ```

2. **Blue-Green Deployments**
   ```bash
   # Deploy to new environment (green)
   # Run smoke tests
   # Switch traffic from blue → green
   # Keep blue as rollback target
   ```

3. **Circuit Breaker Pattern**
   ```typescript
   // For external API calls (Vapi, Twilio)
   const circuitBreaker = new CircuitBreaker({
     failureThreshold: 5,      // Fail after 5 consecutive errors
     resetTimeout: 60000,      // Retry after 60 seconds
   });

   try {
     await circuitBreaker.execute(() => vapiClient.fetchCall(id));
   } catch {
     // Fall back to cached data or error response
   }
   ```

---

## EXPERTISE SUMMARY

This skills.md encodes **15+ years** of backend and full-stack development knowledge:

### What You Can Do Now:
✅ Build enterprise-grade REST APIs
✅ Design database schemas for scale
✅ Implement production authentication/authorization
✅ Set up monitoring and logging
✅ Deploy with confidence
✅ Handle security properly
✅ Optimize performance systematically
✅ Write testable, maintainable code

### For Voxanne Specifically:
✅ Understand dual-table architecture
✅ Maintain recording pipeline
✅ Manage signed URL expiry
✅ Filter demo calls correctly
✅ Implement features from Phase 2 & 3
✅ Scale to 1000+ calls/minute
✅ Ensure data security and compliance

### How to Use This Document:
1. **Reference** when implementing Phase 2 features
2. **Guide** implementation decisions with best practices
3. **Validate** your code against production standards
4. **Extend** with project-specific learnings

---

## Document Maintenance

**Last Updated:** Dec 19, 2025
**Next Review:** After Phase 2 completion
**Maintainer:** Backend Team

**How to Update:**
1. Add new learnings as they occur
2. Update patterns as best practices evolve
3. Link to new decision records
4. Keep phase roadmaps in sync

---

**Status:** 🚀 READY FOR PRODUCTION
