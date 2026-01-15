'use client';

/**
 * Phase 2: Critical Button Components
 * 
 * Three essential buttons implementing the Closed-Loop UX Sync pattern:
 * 1. BookingConfirmButton - Confirm appointment booking
 * 2. SendSMSButton - Send SMS to lead
 * 3. LeadStatusButton - Update lead status
 * 
 * Each uses:
 * - useSyncMutation hook (idempotent, auto-retry)
 * - SyncButton component (state machine, loading states)
 * - Realtime subscriptions (instant updates)
 * - Offline queue (network resilience)
 */

import { SyncButton, SyncButtonWithConfirm, SyncButtonWithProgress } from './SyncButton';
import { useSyncMutation } from '@/hooks/mutations/useSyncMutation';
import { useEffect, useState } from 'react';

/**
 * BookingConfirmButton
 * 
 * Confirms a pending appointment booking.
 * 
 * Usage:
 * ```tsx
 * <BookingConfirmButton 
 *   appointmentId="123e4567-e89b-12d3-a456-426614174000"
 *   userName="John Smith"
 *   onSuccess={() => refetchBooking()}
 * />
 * ```
 * 
 * Features:
 * - Idempotent: Safe to click multiple times
 * - Realtime: All team members see confirmation instantly
 * - Offline support: Queues if network fails
 * - Auto-retry: Retries on network errors
 */
export function BookingConfirmButton({
  appointmentId,
  userName,
  onSuccess,
  onError,
}: {
  appointmentId: string;
  userName: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return (
    <SyncButton
      endpoint="/api/bookings/confirm"
      onClick={(mutate) =>
        mutate({
          appointmentId,
          userId: userName,
          notes: `Confirmed by ${userName}`,
        })
      }
      successMessage="Booking confirmed! ✓"
      errorMessage="Failed to confirm booking. Please try again."
      loadingText="Confirming..."
      onSuccess={() => {
        onSuccess?.();
      }}
      onError={onError}
      className="bg-green-600 hover:bg-green-700"
    >
      Confirm Booking
    </SyncButton>
  );
}

/**
 * SendSMSButton
 * 
 * Sends SMS message to a lead.
 * 
 * Usage:
 * ```tsx
 * <SendSMSButton
 *   leadId="123e4567-e89b-12d3-a456-426614174000"
 *   message="Your appointment is confirmed for tomorrow at 2 PM"
 *   onSuccess={() => toast.success('SMS sent!')}
 * />
 * ```
 * 
 * Features:
 * - Circuit breaker: Stops sending if SMS service down
 * - Retries: Automatic retry on network failures
 * - Audit trail: Logged for compliance
 * - Real-time status: Delivery status updates live
 */
export function SendSMSButton({
  leadId,
  message,
  template,
  onSuccess,
  onError,
}: {
  leadId: string;
  message: string;
  template?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const messagePreview = message.substring(0, 30) + (message.length > 30 ? '...' : '');

  return (
    <SyncButton
      endpoint="/api/leads/send-sms"
      onClick={(mutate) =>
        mutate({
          leadId,
          message,
          template,
        })
      }
      successMessage="SMS sent!"
      errorMessage="Failed to send SMS. Please try again."
      loadingText="Sending SMS..."
      onSuccess={() => {
        onSuccess?.();
      }}
      onError={onError}
      className="bg-blue-600 hover:bg-blue-700"
    >
      Send SMS
    </SyncButton>
  );
}

/**
 * LeadStatusButton
 * 
 * Updates lead status with optimistic UI update.
 * Supports single lead and bulk operations.
 * 
 * Usage (Single):
 * ```tsx
 * <LeadStatusButton
 *   leadId="123e4567-e89b-12d3-a456-426614174000"
 *   newStatus="won"
 *   userName="Sarah Johnson"
 *   onSuccess={() => refetchLead()}
 * />
 * ```
 * 
 * Usage (Bulk):
 * ```tsx
 * <LeadStatusButton
 *   leadIds={selectedLeadIds}
 *   newStatus="contacted"
 *   userName="Sarah Johnson"
 *   bulkOperation
 * />
 * ```
 * 
 * Features:
 * - Optimistic updates: UI updates immediately
 * - Bulk operations: Update multiple leads atomically
 * - Audit trail: Logs all status changes
 * - Real-time sync: All users see updates instantly
 */
export function LeadStatusButton({
  leadId,
  leadIds,
  newStatus,
  userName,
  notes,
  onSuccess,
  onError,
  bulkOperation,
  variant = 'default',
}: {
  leadId?: string;
  leadIds?: string[];
  newStatus: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiating' | 'won' | 'lost';
  userName: string;
  notes?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  bulkOperation?: boolean;
  variant?: 'default' | 'confirm' | 'progress';
}) {
  const isBulk = bulkOperation || (leadIds && leadIds.length > 0);
  const ids = isBulk ? leadIds! : [leadId!];
  const statusLabel = newStatus.replace('_', ' ').toUpperCase();

  const ButtonComponent =
    variant === 'confirm' ? SyncButtonWithConfirm : variant === 'progress' ? SyncButtonWithProgress : SyncButton;

  const buttonProps = {
    endpoint: '/api/leads/update-status',
    onClick: (mutate: any) =>
      mutate({
        ...(isBulk ? { leadIds: ids, bulkOperation: true } : { leadId: ids[0] }),
        status: newStatus,
        notes: notes || `Updated by ${userName}`,
      }),
    successMessage: isBulk ? `${ids.length} leads updated!` : 'Status updated!',
    errorMessage: 'Failed to update status. Will retry automatically.',
    loadingText: 'Updating...',
    onSuccess: onSuccess,
    onError: onError,
    className: getStatusColor(newStatus),
  };

  // Choose button component based on status type
  if (newStatus === 'won' || newStatus === 'lost') {
    // Confirmation dialog for final status
    return (
      <SyncButtonWithConfirm
        {...buttonProps}
        confirmTitle={`Mark as ${statusLabel}?`}
        confirmMessage={`This will mark ${isBulk ? `${ids.length} leads` : 'this lead'} as ${statusLabel}.`}
      >
        {statusLabel}
      </SyncButtonWithConfirm>
    );
  }

  // Default button
  return <SyncButton {...buttonProps}>{statusLabel}</SyncButton>;
}

/**
 * Helper: Get button color based on status
 */
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: 'bg-gray-500 hover:bg-gray-600',
    contacted: 'bg-blue-500 hover:bg-blue-600',
    qualified: 'bg-purple-500 hover:bg-purple-600',
    proposal_sent: 'bg-indigo-500 hover:bg-indigo-600',
    negotiating: 'bg-orange-500 hover:bg-orange-600',
    won: 'bg-green-600 hover:bg-green-700',
    lost: 'bg-red-600 hover:bg-red-700',
  };
  return colors[status] || 'bg-gray-500 hover:bg-gray-600';
}

/**
 * LeadStatusBulkUpdateButton
 * 
 * Update status for multiple selected leads with progress tracking.
 * 
 * Usage:
 * ```tsx
 * <LeadStatusBulkUpdateButton
 *   selectedLeadIds={selectedIds}
 *   newStatus="contacted"
 *   userName="team"
 *   progress={currentProgress}
 * />
 * ```
 */
export function LeadStatusBulkUpdateButton({
  selectedLeadIds,
  newStatus,
  userName,
  progress = 0,
  onSuccess,
}: {
  selectedLeadIds: string[];
  newStatus: string;
  userName: string;
  progress?: number;
  onSuccess?: () => void;
}) {
  if (selectedLeadIds.length === 0) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed"
      >
        Select leads first ({selectedLeadIds.length})
      </button>
    );
  }

  return (
    <SyncButtonWithProgress
      endpoint="/api/leads/update-status"
      onClick={(mutate) =>
        mutate({
          leadIds: selectedLeadIds,
          status: newStatus,
          bulkOperation: true,
          notes: `Bulk update by ${userName}`,
        })
      }
      successMessage={`${selectedLeadIds.length} leads updated!`}
      errorMessage="Failed to update some leads. Retrying..."
      progress={progress}
      showProgressBar
      onSuccess={onSuccess}
    >
      Update {selectedLeadIds.length} Leads
    </SyncButtonWithProgress>
  );
}

// Realtime sync hooks moved to backend - frontend does not require direct realtime subscriptions
// Use the API endpoints instead to fetch data
