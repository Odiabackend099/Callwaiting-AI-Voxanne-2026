# Phase 2: Critical Buttons Integration Guide

## Overview

This guide demonstrates how to integrate the three critical button components into your existing pages. Each button implements the Closed-Loop UX Sync pattern from Phase 1, ensuring:

- **Idempotency**: Duplicate requests return identical responses (no phantom duplicates)
- **Automatic Retry**: Failed requests retry with exponential backoff
- **Realtime Sync**: All clients see updates instantly via Supabase Realtime
- **Offline Support**: Requests queue when offline and replay when network restores
- **Error Recovery**: Circuit breakers prevent cascade failures

## Quick Start

### 1. Import Components

```typescript
import {
  BookingConfirmButton,
  SendSMSButton,
  LeadStatusButton,
  LeadStatusBulkUpdateButton,
} from '@/components/common/CriticalButtons';
```

### 2. Initialize Realtime Sync (App Root)

In your app initialization (e.g., `_app.tsx` or `layout.tsx`):

```typescript
import { getRealtimeSyncService } from '@/services/realtime-sync';

export default function App() {
  useEffect(() => {
    // Initialize realtime sync service
    const realtimeSync = getRealtimeSyncService();
    
    // Subscribe to critical table changes
    realtimeSync.subscribe('appointments', (event) => {
      console.log('Appointment changed:', event);
      // Component hooks handle UI updates automatically
    });

    return () => {
      // Cleanup on unmount
    };
  }, []);

  return <AppContent />;
}
```

---

## Component Integrations

### Component 1: BookingConfirmButton

**Purpose**: Confirm appointment scheduling in the dashboard

**Location**: Dashboard > Appointments Tab

#### Basic Usage

```typescript
import { BookingConfirmButton } from '@/components/common/CriticalButtons';

export function AppointmentCard({ appointment }) {
  return (
    <div className="appointment-card">
      <h3>{appointment.title}</h3>
      <p>{appointment.scheduled_at}</p>
      
      <BookingConfirmButton
        appointmentId={appointment.id}
        onSuccess={() => {
          // Optional: Show success message
          toast.success('Appointment confirmed');
        }}
        onError={(error) => {
          // Optional: Handle specific errors
          if (error.code === 'ALREADY_CONFIRMED') {
            toast.info('Appointment already confirmed');
          } else {
            toast.error(error.message);
          }
        }}
      />
    </div>
  );
}
```

#### With Confirmation Dialog

```typescript
<BookingConfirmButton
  appointmentId={appointment.id}
  variant="with-confirm"
  confirmMessage="Are you sure you want to confirm this appointment?"
  onSuccess={() => toast.success('Appointment confirmed')}
/>
```

#### Advanced: In Appointment List

```typescript
export function AppointmentsList({ appointments }) {
  return (
    <table>
      <tbody>
        {appointments.map((apt) => (
          <tr key={apt.id}>
            <td>{apt.title}</td>
            <td>{apt.scheduled_at}</td>
            <td>
              <BookingConfirmButton
                appointmentId={apt.id}
                variant={apt.status === 'pending' ? 'default' : 'disabled'}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### API Endpoint Reference

**Endpoint**: `POST /api/bookings/confirm`

```typescript
// Request
{
  "appointmentId": "apt-123",
  "confirmedBy": "user-456",
  "notes": "Client confirmed via phone"
}

// Response (success 200)
{
  "success": true,
  "appointment": {
    "id": "apt-123",
    "status": "confirmed",
    "confirmed_at": "2024-01-15T10:30:00Z",
    "confirmed_by": "user-456"
  }
}

// Response (already confirmed 409)
{
  "success": false,
  "error": "Appointment is already confirmed"
}
```

---

### Component 2: SendSMSButton

**Purpose**: Send SMS confirmations or follow-ups to leads

**Location**: Lead Card > Actions Menu

#### Basic Usage

```typescript
import { SendSMSButton } from '@/components/common/CriticalButtons';

export function LeadCard({ lead }) {
  return (
    <div className="lead-card">
      <h3>{lead.name}</h3>
      <p>{lead.phone}</p>
      
      <SendSMSButton
        leadId={lead.id}
        message={`Hi ${lead.firstName}, your appointment is confirmed for tomorrow at 10am.`}
        onSuccess={() => {
          toast.success('SMS sent');
        }}
        onError={(error) => {
          if (error.code === 'CIRCUIT_BREAKER_OPEN') {
            toast.error('SMS service temporarily unavailable. Will retry automatically.');
          } else {
            toast.error(`Failed to send SMS: ${error.message}`);
          }
        }}
      />
    </div>
  );
}
```

#### With Loading Progress

```typescript
<SendSMSButton
  leadId={lead.id}
  message={message}
  variant="with-progress"
  onProgress={(progress) => {
    console.log(`Send attempt ${progress.attempt}/${progress.maxAttempts}`);
  }}
/>
```

#### Template Messages

```typescript
const messageTemplates = {
  appointment_confirmation: (lead) =>
    `Hi ${lead.firstName}, your appointment is confirmed for ${lead.appointmentDate} at ${lead.appointmentTime}. Reply CONFIRM to confirm or CANCEL to cancel.`,
  
  follow_up: (lead) =>
    `${lead.firstName}, just checking in! Are you still interested in our services? Reply YES or NO.`,
  
  payment_reminder: (lead) =>
    `Hi ${lead.firstName}, we have an outstanding proposal. Please review and let us know if you have questions.`,
};

// Usage
<SendSMSButton
  leadId={lead.id}
  message={messageTemplates.appointment_confirmation(lead)}
/>
```

#### API Endpoint Reference

**Endpoint**: `POST /api/leads/send-sms`

```typescript
// Request
{
  "leadId": "lead-123",
  "message": "Hi John, your appointment is confirmed...",
  "templateId": "appointment_confirmation" // Optional
}

// Response (success 200)
{
  "success": true,
  "sms": {
    "id": "sms-789",
    "leadId": "lead-123",
    "message": "Hi John, your appointment is confirmed...",
    "status": "pending",
    "sentAt": "2024-01-15T10:30:00Z"
  }
}

// Response (circuit breaker open 503)
{
  "success": false,
  "error": "SMS service temporarily unavailable",
  "retrying": true
}
```

**Get SMS History**:

```typescript
// GET /api/leads/:leadId/sms-history
// Returns all SMS messages sent to a lead with delivery status

const response = await fetch(`/api/leads/${leadId}/sms-history`);
const { sms_messages } = await response.json();

// [
//   { id: 'sms-1', message: '...', status: 'delivered', sentAt: '...' },
//   { id: 'sms-2', message: '...', status: 'failed', sentAt: '...' }
// ]
```

---

### Component 3: LeadStatusButton

**Purpose**: Update individual lead status with confirmation for final states

**Location**: Lead Table > Status Column

#### Basic Usage

```typescript
import { LeadStatusButton } from '@/components/common/CriticalButtons';

export function LeadRow({ lead }) {
  return (
    <tr>
      <td>{lead.name}</td>
      <td>{lead.phone}</td>
      <td>
        <LeadStatusButton
          leadId={lead.id}
          currentStatus={lead.status}
          onSuccess={(updatedLead) => {
            // Lead status updated, realtime event will update other clients
            toast.success(`Status changed to ${updatedLead.status}`);
          }}
        />
      </td>
    </tr>
  );
}
```

#### With Confirmation for Final States

```typescript
<LeadStatusButton
  leadId={lead.id}
  currentStatus={lead.status}
  variant="with-confirm"
  confirmMessage={{
    won: "Mark this lead as won? This is final.",
    lost: "Mark this lead as lost? You can reopen later.",
  }}
  onSuccess={(lead) => {
    toast.success(`Lead marked as ${lead.status}`);
  }}
/>
```

#### Available Statuses

```typescript
const VALID_STATUSES = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'contacted', label: 'Contacted', color: 'yellow' },
  { value: 'qualified', label: 'Qualified', color: 'green' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'purple' },
  { value: 'negotiating', label: 'Negotiating', color: 'orange' },
  { value: 'won', label: 'Won', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' },
];

// Status color mapping
const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  proposal_sent: 'bg-purple-100 text-purple-800',
  negotiating: 'bg-orange-100 text-orange-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};
```

#### API Endpoint Reference

**Endpoint**: `POST /api/leads/update-status`

```typescript
// Request (single lead)
{
  "leadId": "lead-123",
  "status": "qualified"
}

// Request (bulk update)
{
  "leadIds": ["lead-123", "lead-124", "lead-125"],
  "status": "contacted"
}

// Response (success 200)
{
  "success": true,
  "lead": {
    "id": "lead-123",
    "status": "qualified",
    "status_changed_at": "2024-01-15T10:30:00Z"
  }
}

// Response (bulk success)
{
  "success": true,
  "updated": 3,
  "failed": 0,
  "leads": [...]
}
```

---

### Component 4: LeadStatusBulkUpdateButton

**Purpose**: Update multiple leads status at once with progress tracking

**Location**: Lead Table > Bulk Actions

#### Basic Usage

```typescript
import { LeadStatusBulkUpdateButton } from '@/components/common/CriticalButtons';

export function LeadTableToolbar({ selectedLeads }) {
  return (
    <div className="toolbar">
      <LeadStatusBulkUpdateButton
        leadIds={selectedLeads.map(l => l.id)}
        targetStatus="contacted"
        onSuccess={(result) => {
          toast.success(
            `Updated ${result.updated} leads to ${result.status}`
          );
          // Refetch lead list
          refetchLeads();
        }}
        onError={(error) => {
          toast.error(
            `${error.failed} leads failed to update: ${error.message}`
          );
        }}
      />
    </div>
  );
}
```

#### With Progress Tracking

```typescript
<LeadStatusBulkUpdateButton
  leadIds={selectedLeads}
  targetStatus="qualified"
  variant="with-progress"
  onProgress={(progress) => {
    console.log(
      `Updating ${progress.processed}/${progress.total} leads...`
    );
  }}
/>
```

#### Example: Mark All as Contacted After Campaign

```typescript
export function CampaignCard({ campaign }) {
  const [leads, setLeads] = useState(campaign.leads);

  return (
    <div className="campaign-card">
      <h3>{campaign.name}</h3>
      <p>{leads.length} leads</p>

      <LeadStatusBulkUpdateButton
        leadIds={leads.map(l => l.id)}
        targetStatus="contacted"
        onSuccess={() => {
          toast.success(`Marked ${leads.length} leads as contacted`);
          // Update local state
          setLeads(leads.map(l => ({ ...l, status: 'contacted' })));
        }}
      />
    </div>
  );
}
```

#### API Endpoint Reference

**Endpoint**: `POST /api/leads/update-status` (same as single, detects bulk by leadIds array)

```typescript
// Request (bulk)
{
  "leadIds": ["lead-1", "lead-2", "lead-3"],
  "status": "qualified"
}

// Response (bulk success)
{
  "success": true,
  "updated": 3,
  "failed": 0,
  "message": "3 leads updated to qualified"
}

// Response (partial success)
{
  "success": false,
  "updated": 2,
  "failed": 1,
  "message": "2 leads updated, 1 failed (not found)"
}
```

---

## Advanced Patterns

### Pattern 1: Coordinated Multi-Button Actions

Update booking, send SMS, and change status in sequence:

```typescript
export function AppointmentConfirmationWorkflow({ appointment, lead }) {
  const [step, setStep] = useState<'booking' | 'sms' | 'status'>('booking');

  return (
    <div className="workflow">
      {step === 'booking' && (
        <BookingConfirmButton
          appointmentId={appointment.id}
          onSuccess={() => setStep('sms')}
        />
      )}

      {step === 'sms' && (
        <SendSMSButton
          leadId={lead.id}
          message={`Hi ${lead.firstName}, your appointment is confirmed!`}
          onSuccess={() => setStep('status')}
        />
      )}

      {step === 'status' && (
        <LeadStatusButton
          leadId={lead.id}
          currentStatus={lead.status}
          onSuccess={() => {
            toast.success('Workflow completed');
            setStep('booking'); // Reset
          }}
        />
      )}
    </div>
  );
}
```

### Pattern 2: Optimistic Updates

Update UI before server confirmation for snappier feel:

```typescript
export function OptimisticLeadStatusUpdate({ lead, onStatusChange }) {
  const [optimisticStatus, setOptimisticStatus] = useState(lead.status);

  const handleStatusChange = async (newStatus: string) => {
    // Update UI immediately (optimistic)
    setOptimisticStatus(newStatus);

    // Then confirm with server
    try {
      await fetch(`/api/leads/${lead.id}/update-status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange(newStatus);
    } catch (error) {
      // Revert on failure
      setOptimisticStatus(lead.status);
      toast.error('Failed to update status');
    }
  };

  return (
    <button
      onClick={() => handleStatusChange('qualified')}
      disabled={optimisticStatus !== lead.status}
    >
      {optimisticStatus}
    </button>
  );
}
```

### Pattern 3: Realtime Collaboration

Show when other users update leads:

```typescript
export function CollaborativeLeadCard({ lead }) {
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const { useLeadStatusSync } = require('@/components/common/CriticalButtons');

  const { updatedLead } = useLeadStatusSync(lead.id);

  useEffect(() => {
    if (updatedLead && updatedLead.id === lead.id) {
      setLastUpdatedBy(updatedLead.updatedBy);
      setTimeout(() => setLastUpdatedBy(null), 3000); // Flash for 3s
    }
  }, [updatedLead]);

  return (
    <div className={lastUpdatedBy ? 'bg-yellow-100' : ''}>
      {lead.name} - {lead.status}
      {lastUpdatedBy && (
        <span className="text-sm text-gray-500">
          Updated by {lastUpdatedBy}
        </span>
      )}
    </div>
  );
}
```

### Pattern 4: Offline Queue Management

Handle network-induced queuing gracefully:

```typescript
import { getOfflineQueue, syncOfflineQueue } from '@/hooks/mutations/useSyncMutation';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync offline queue when network restores
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setQueuedCount(getOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="offline-banner">
        📡 Offline ({queuedCount} pending actions)
      </div>
    );
  }

  return null;
}
```

---

## Troubleshooting

### Issue: "Idempotency Key Already Processed"

**Cause**: Same request sent twice within 60-second window

**Solution**: The system is working correctly. Duplicate requests return cached response to prevent duplicates.

### Issue: "Circuit Breaker Open for SMS Service"

**Cause**: Too many SMS send failures in short period

**Resolution**: 
- Check Twilio account status
- Verify phone numbers are valid
- Wait 5 minutes for circuit breaker to reset

### Issue: "Lead Status Update Failed - Already Has Status"

**Cause**: Trying to update lead to current status

**Solution**: Check current status before submitting update

### Issue: Realtime Updates Not Showing

**Cause**: Missing Realtime subscription setup

**Solution**:
```typescript
// In your page/component initialization
import { getRealtimeSyncService } from '@/services/realtime-sync';

useEffect(() => {
  const realtimeSync = getRealtimeSyncService();
  realtimeSync.subscribe('leads', (event) => {
    // Manually update state if hooks aren't auto-updating
    console.log('Lead updated:', event.new);
  });
}, []);
```

### Issue: Offline Queue Not Syncing

**Cause**: Network restoration not triggering sync

**Solution**:
```typescript
// Manually trigger sync
import { syncOfflineQueue } from '@/hooks/mutations/useSyncMutation';

// In network restoration handler
window.addEventListener('online', () => {
  syncOfflineQueue();
});
```

---

## Performance Considerations

### Idempotency Cache

- **Window**: 60 seconds (configurable in `backend/src/middleware/idempotency.ts`)
- **Memory**: ~1KB per cached response (configure Redis for production)
- **Impact**: Prevents duplicate database writes, reduces server load

### Realtime Subscriptions

- **Connection**: One per user (shared across all components)
- **Impact**: Minimal bandwidth, near-zero latency
- **Scalability**: Supabase handles 1000+ concurrent subscriptions

### Offline Queue

- **Storage**: localStorage (browser storage limit ~5MB)
- **Performance**: Automatic retry on network restore
- **Impact**: No data loss during temporary offline periods

### Circuit Breaker

- **Threshold**: 5 failures in 60 seconds
- **Recovery**: Half-open state for 30 seconds
- **Impact**: Prevents cascade failures, graceful degradation

---

## Monitoring & Debugging

### Enable Debug Logging

```typescript
// In _app.tsx
if (process.env.DEBUG_SYNC) {
  window.DEBUG_SYNC = true;
  console.log('Sync debug logging enabled');
}
```

### Check Offline Queue

```typescript
import { getOfflineQueue } from '@/hooks/mutations/useSyncMutation';

console.log('Queued requests:', getOfflineQueue());
```

### Monitor Realtime Subscriptions

```typescript
import { getRealtimeSyncService } from '@/services/realtime-sync';

const sync = getRealtimeSyncService();
console.log('Active subscriptions:', sync.getSubscriptions());
```

### Check Circuit Breaker Status

```typescript
// In sms-sync.ts
console.log('SMS Circuit Breaker:', twilioCircuitBreaker.getState());
// Returns: CLOSED | OPEN | HALF_OPEN
```

---

## Migration Checklist

- [ ] Import all 4 button components
- [ ] Initialize Realtime sync in app root
- [ ] Add BookingConfirmButton to appointments page
- [ ] Add SendSMSButton to lead card
- [ ] Add LeadStatusButton to lead table
- [ ] Add LeadStatusBulkUpdateButton to bulk actions
- [ ] Test each button with network throttling (DevTools)
- [ ] Test each button offline
- [ ] Verify realtime updates across multiple browser tabs
- [ ] Monitor error logs for any circuit breaker opens
- [ ] Set up performance monitoring in staging

---

## Next Steps

1. **Integrate into Dashboard Pages**: Follow the component integration examples above
2. **Test with Realtime**: Open multiple browser tabs and verify instant sync
3. **Test Offline**: Use DevTools Network tab to simulate offline, verify queue and retry
4. **Monitor in Production**: Watch for circuit breaker opens, realtime latency
5. **Phase 3 Ready**: Integrate with other buttons (proposals, scheduling, etc.)
