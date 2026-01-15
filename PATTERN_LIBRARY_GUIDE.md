# Closed-Loop UX Synchronization Pattern Library

**Complete guide for implementing consistent, idempotent button state synchronization across the application.**

## Overview

The Closed-Loop UX Synchronization pattern ensures that:

1. **No phantom loading** - UI state always reflects actual database state
2. **No duplicate submissions** - Idempotent requests prevent double-processing
3. **Automatic recovery** - Failed requests retry with exponential backoff
4. **Real-time sync** - All clients see changes instantly via Supabase Realtime
5. **Offline support** - Failed requests queue and retry when network returns

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│                                                                 │
│  ┌──────────────┐      ┌──────────────────┐                   │
│  │ SyncButton   │────→ │ useSyncMutation  │                   │
│  │ Component    │      │ Hook             │                   │
│  └──────────────┘      └────────┬─────────┘                   │
│                                 │                              │
│                        ┌────────▼─────────┐                   │
│                        │ Offline Queue    │                   │
│                        │ (localStorage)   │                   │
│                        └────────┬─────────┘                   │
└────────────────────────────────┼─────────────────────────────┘
                                 │
                    X-Idempotency-Key Header
                                 │
┌────────────────────────────────▼─────────────────────────────┐
│                       Backend Layer                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Idempotency Middleware                               │  │
│  │ - Validates X-Idempotency-Key                        │  │
│  │ - Checks cache (60-second window)                    │  │
│  │ - Returns cached response if duplicate               │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │ Route Handler (wrapped with retry logic)             │  │
│  │ - Executes business logic                            │  │
│  │ - Error recovery with exponential backoff            │  │
│  │ - Validates circuit breaker state                    │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │ Database Update                                       │  │
│  │ - Row-level security (RLS)                           │  │
│  │ - Atomic transactions                                │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │ Realtime Broadcast                                   │  │
│  │ - Publish via Supabase Realtime                      │  │
│  │ - Cache latest state                                 │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┼──────────────────────────────────────┘
                     │
           Postgres Changes Event
                     │
┌────────────────────▼──────────────────────────────────────┐
│                      All Clients                          │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Supabase Realtime Subscription                      │ │
│  │ - Receive changes from database                     │ │
│  │ - Update UI with latest state                       │ │
│  │ - Cancel loading state                              │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

## Phase 1: Core Implementation

### 1. Backend Setup

#### 1.1 Add Idempotency Middleware to Routes

```typescript
// src/routes/bookings.ts
import { Router } from 'express';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { confirmBooking } from '../handlers/bookings';

const router = Router();

// Apply idempotency middleware to all state-changing endpoints
router.post(
  '/confirm',
  createIdempotencyMiddleware(),
  confirmBooking
);

export default router;
```

#### 1.2 Wrap Handlers with Error Recovery

```typescript
// src/handlers/bookings.ts
import { retryWithBackoff } from '../utils/error-recovery';

export async function confirmBooking(req: Request, res: Response) {
  const { bookingId } = req.body;

  try {
    // Wrap business logic with retry
    const result = await retryWithBackoff(
      () => processBookingConfirmation(bookingId),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        shouldRetry: (error) => {
          // Don't retry validation errors
          return !error.message.includes('Invalid');
        },
      }
    );

    // Publish change to all clients
    const realtimeSync = getRealtimeSyncService();
    await realtimeSync.publish('bookings', {
      id: bookingId,
      status: 'confirmed',
      updatedAt: new Date(),
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function processBookingConfirmation(bookingId: string) {
  // Your business logic here
  // This function is retried up to 3 times automatically
  return { id: bookingId, status: 'confirmed' };
}
```

### 2. Frontend Setup

#### 2.1 Use SyncButton Component

```typescript
// pages/bookings/[id]/confirm.tsx
import { SyncButton } from '@/components/common/SyncButton';

export default function BookingConfirmPage() {
  return (
    <SyncButton
      endpoint="/api/bookings/confirm"
      onClick={(mutate) => mutate({ bookingId: '123' })}
      successMessage="Booking confirmed!"
      errorMessage="Failed to confirm booking. Please try again."
    >
      Confirm Booking
    </SyncButton>
  );
}
```

#### 2.2 Subscribe to Realtime Changes

```typescript
// components/BookingCard.tsx
import { useEffect, useState } from 'react';
import { getRealtimeSyncService } from '@/services/realtime-sync';

export function BookingCard({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    // Subscribe to changes for this booking
    const realtimeSync = getRealtimeSyncService();
    
    const unsubscribe = realtimeSync.subscribe(
      'bookings',
      (event) => {
        // Update UI when database changes
        if (event.new.id === bookingId) {
          setBooking(event.new);
        }
      },
      `id=eq.${bookingId}` // Optional filter
    );

    return unsubscribe;
  }, [bookingId]);

  return (
    <div>
      <h2>Booking #{bookingId}</h2>
      <p>Status: {booking?.status}</p>
    </div>
  );
}
```

## Phase 2: Critical Button Implementation

Apply the pattern to these high-impact buttons:

### 2.1 Booking Confirmation Button

```typescript
// components/BookingConfirmButton.tsx
import { SyncButton } from '@/components/common/SyncButton';

export function BookingConfirmButton({ bookingId }: { bookingId: string }) {
  return (
    <SyncButton
      endpoint="/api/bookings/confirm"
      onClick={(mutate) => mutate({ bookingId })}
      successMessage="Booking confirmed!"
    >
      Confirm Booking
    </SyncButton>
  );
}
```

### 2.2 SMS Send Button

```typescript
// components/SendSMSButton.tsx
import { SyncButton } from '@/components/common/SyncButton';

export function SendSMSButton({ leadId }: { leadId: string }) {
  return (
    <SyncButton
      endpoint="/api/leads/send-sms"
      onClick={(mutate) => mutate({ leadId, message: 'Your booking details...' })}
      successMessage="SMS sent!"
      errorMessage="Failed to send SMS"
    >
      Send SMS
    </SyncButton>
  );
}
```

### 2.3 Lead Status Update Button

```typescript
// components/LeadStatusButton.tsx
import { SyncButton } from '@/components/common/SyncButton';

export function LeadStatusButton({ leadId, status }: { leadId: string; status: string }) {
  return (
    <SyncButton
      endpoint="/api/leads/status"
      onClick={(mutate) => mutate({ leadId, status })}
      successMessage={`Status updated to ${status}`}
    >
      Mark as {status}
    </SyncButton>
  );
}
```

## Phase 3: Advanced Features

### 3.1 Error Recovery & Retry Dashboard

```typescript
// pages/admin/sync-status.tsx
import { useState, useEffect } from 'react';
import { getOfflineQueue, syncOfflineQueue } from '@/hooks/mutations/useSyncMutation';

export default function SyncStatusPage() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    setQueue(getOfflineQueue());
  }, []);

  const handleRetryAll = async () => {
    await syncOfflineQueue();
    setQueue(getOfflineQueue());
  };

  return (
    <div>
      <h1>Sync Status Dashboard</h1>
      <p>Pending requests: {queue.length}</p>
      <button onClick={handleRetryAll}>Retry All</button>
      
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Timestamp</th>
            <th>Retries</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((item) => (
            <tr key={item.idempotencyKey}>
              <td>{item.endpoint}</td>
              <td>{new Date(item.timestamp).toLocaleString()}</td>
              <td>{item.retryCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3.2 Circuit Breaker for External Services

```typescript
// src/services/external-service.ts
import { CircuitBreaker } from '../utils/error-recovery';

const emailBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  onStateChange: (oldState, newState) => {
    console.log(`Email service circuit breaker: ${oldState} → ${newState}`);
  },
});

export async function sendEmail(to: string, subject: string, body: string) {
  return emailBreaker.execute(() =>
    externalEmailService.send({ to, subject, body })
  );
}
```

### 3.3 Monitoring & Alerting

```typescript
// src/monitoring/sync-health.ts
import { getIdempotencyCacheStats } from '../middleware/idempotency';
import { getRealtimeSyncService } from '../services/realtime-sync';

export function getSyncHealthMetrics() {
  const idempotencyStats = getIdempotencyCacheStats();
  const realtimeSync = getRealtimeSyncService();

  return {
    idempotency: {
      cacheSize: idempotencyStats.size,
      windowSeconds: idempotencyStats.windowSeconds,
    },
    realtime: {
      activeSubscriptions: realtimeSync.getSubscriptionCount(),
    },
    timestamp: new Date(),
  };
}
```

## Integration Patterns

### Pattern 1: Optimistic Update with Rollback

```typescript
// Use case: Update UI immediately, rollback on error

import { SyncButton } from '@/components/common/SyncButton';
import { useState } from 'react';

export function OptimisticUpdateButton() {
  const [status, setStatus] = useState('pending');
  const [optimisticStatus, setOptimisticStatus] = useState(status);

  return (
    <SyncButton
      endpoint="/api/update"
      onClick={(mutate) => {
        // Show optimistic update immediately
        setOptimisticStatus('confirmed');
        
        mutate({ status: 'confirmed' })
          .catch(() => {
            // Rollback on error
            setOptimisticStatus(status);
          });
      }}
      successMessage="Updated!"
    >
      {optimisticStatus === 'confirmed' ? 'Confirmed ✓' : 'Confirm'}
    </SyncButton>
  );
}
```

### Pattern 2: Bulk Operations with Progress

```typescript
// Use case: Update multiple items with progress tracking

import { SyncButtonWithProgress } from '@/components/common/SyncButton';
import { useState } from 'react';

export function BulkUpdateButton({ ids }: { ids: string[] }) {
  const [progress, setProgress] = useState(0);

  return (
    <SyncButtonWithProgress
      endpoint="/api/bulk-update"
      onClick={(mutate) => {
        mutate({
          ids,
          onProgress: (current, total) => {
            setProgress((current / total) * 100);
          },
        });
      }}
      progress={progress}
    >
      Update All ({ids.length})
    </SyncButtonWithProgress>
  );
}
```

### Pattern 3: Confirmation Dialog

```typescript
// Use case: Destructive action requiring confirmation

import { SyncButtonWithConfirm } from '@/components/common/SyncButton';

export function DeleteButton({ id }: { id: string }) {
  return (
    <SyncButtonWithConfirm
      endpoint="/api/delete"
      onClick={(mutate) => mutate({ id })}
      confirmTitle="Delete Item?"
      confirmMessage="This action cannot be undone."
      successMessage="Item deleted"
    >
      Delete
    </SyncButtonWithConfirm>
  );
}
```

## API Endpoint Checklist

When adding a new button to the application, ensure:

- [ ] Endpoint has `createIdempotencyMiddleware()` applied
- [ ] Business logic wrapped with `retryWithBackoff()`
- [ ] Publishes change via `realtimeSync.publish()`
- [ ] Frontend uses `SyncButton` component
- [ ] Frontend subscribes to realtime changes
- [ ] Error messages are user-friendly
- [ ] Success notification shows confirmation
- [ ] Offline queue can retry if needed

## Testing Checklist

For each endpoint, verify:

- [ ] Idempotency: Same request twice returns identical response
- [ ] Retry: Failed request succeeds on retry
- [ ] Realtime: All clients receive update notification
- [ ] Offline: Offline queue persists and retries
- [ ] Error Recovery: Circuit breaker prevents cascade failures
- [ ] UI Feedback: User sees loading/success/error states

## Troubleshooting Guide

### Issue: "Phantom Loading" (button stays loading forever)

**Diagnosis:** Realtime subscription not receiving change event

**Solution:**
1. Check Supabase Realtime is enabled for the table
2. Verify database trigger publishes the change
3. Check browser console for subscription errors
4. Verify `realtimeSync.publish()` is called after DB update

### Issue: Duplicate Submissions (two identical requests processed)

**Diagnosis:** Idempotency middleware not applied or key not sent

**Solution:**
1. Verify middleware applied to route: `createIdempotencyMiddleware()`
2. Check frontend sends `X-Idempotency-Key` header
3. Verify cache TTL (default 60 seconds) is sufficient
4. Check cache clearing logic in tests

### Issue: "Failed to send SMS" error appears, but SMS was sent

**Diagnosis:** Request succeeded but timeout occurred

**Solution:**
1. Increase `timeoutMs` in mutation config
2. Add circuit breaker to prevent cascade
3. Verify database transaction is atomic
4. Check for network latency issues

### Issue: Offline queue grows indefinitely

**Diagnosis:** Requests never retry or sync

**Solution:**
1. Manually call `syncOfflineQueue()` when network restores
2. Verify `useOfflineSync()` hook is mounted
3. Check localStorage permissions
4. Add monitoring to detect stuck requests

## Performance Considerations

### Cache Size Management

```typescript
// Monitor cache growth
const stats = getIdempotencyCacheStats();
if (stats.size > 10000) {
  console.warn('Idempotency cache growing large:', stats.size);
  // Consider:
  // - Reducing IDEMPOTENCY_WINDOW_SECONDS
  // - Migrating to Redis for distributed systems
}
```

### Subscription Cleanup

```typescript
// Always unsubscribe when component unmounts
useEffect(() => {
  const unsubscribe = realtimeSync.subscribe('bookings', callback);
  return unsubscribe; // Called on unmount
}, []);
```

## Scaling to Production

1. **Redis Migration**: Replace in-memory cache with Redis for distributed systems
2. **Database Triggers**: Use PostgreSQL triggers for auto-publishing instead of application code
3. **Message Queue**: Use Supabase Queues for long-running operations
4. **Monitoring**: Set up alerts for circuit breaker state changes
5. **Analytics**: Track button click success rates and retry frequency

## References

- [Idempotency & Retry Patterns](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Offline-First Architecture](https://offlinefirst.org/)

## Support

For questions or issues with the pattern library:

1. Check the [Pattern Library Tests](backend/src/tests/patterns/pattern-library.test.ts)
2. Review [Example Implementations](#integration-patterns)
3. Check Supabase Realtime status
4. Verify middleware is applied to all state-changing endpoints
