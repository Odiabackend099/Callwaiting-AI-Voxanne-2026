/**
 * Call Outcome Enum
 * Centralized definition of all possible call outcomes
 * Use these constants instead of magic strings throughout the codebase
 */

export enum CallOutcome {
  // Call not yet completed
  QUEUED = 'queued',
  RINGING = 'ringing',
  IN_PROGRESS = 'in_progress',

  // Call completed - positive outcomes
  ANSWERED = 'answered',
  COMPLETED = 'completed',
  DEMO_BOOKED = 'demo_booked',
  INTERESTED = 'interested',
  CALLBACK_SCHEDULED = 'callback_scheduled',

  // Call completed - neutral outcomes
  VOICEMAIL = 'voicemail',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',

  // Call completed - negative outcomes
  NOT_INTERESTED = 'not_interested',
  WRONG_NUMBER = 'wrong_number',
  DO_NOT_CALL = 'do_not_call',
  HANGUP = 'hangup',

  // Call failed
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

/**
 * Call Status (for active calls)
 */
export enum CallStatus {
  QUEUED = 'queued',
  RINGING = 'ringing',
  ANSWERED = 'answered',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Check if outcome is a positive result
 */
export function isPositiveOutcome(outcome: CallOutcome): boolean {
  return [
    CallOutcome.ANSWERED,
    CallOutcome.COMPLETED,
    CallOutcome.DEMO_BOOKED,
    CallOutcome.INTERESTED,
    CallOutcome.CALLBACK_SCHEDULED
  ].includes(outcome);
}

/**
 * Check if outcome is a negative result
 */
export function isNegativeOutcome(outcome: CallOutcome): boolean {
  return [
    CallOutcome.NOT_INTERESTED,
    CallOutcome.WRONG_NUMBER,
    CallOutcome.DO_NOT_CALL,
    CallOutcome.HANGUP,
    CallOutcome.FAILED,
    CallOutcome.CANCELLED,
    CallOutcome.ERROR
  ].includes(outcome);
}

/**
 * Check if call is still active (not completed)
 */
export function isActiveCall(outcome: CallOutcome): boolean {
  return [
    CallOutcome.QUEUED,
    CallOutcome.RINGING,
    CallOutcome.IN_PROGRESS
  ].includes(outcome);
}

/**
 * Get human-readable label for outcome
 */
export function getOutcomeLabel(outcome: CallOutcome): string {
  const labels: Record<CallOutcome, string> = {
    [CallOutcome.QUEUED]: 'Queued',
    [CallOutcome.RINGING]: 'Ringing',
    [CallOutcome.IN_PROGRESS]: 'In Progress',
    [CallOutcome.ANSWERED]: 'Answered',
    [CallOutcome.COMPLETED]: 'Completed',
    [CallOutcome.DEMO_BOOKED]: 'Demo Booked',
    [CallOutcome.INTERESTED]: 'Interested',
    [CallOutcome.CALLBACK_SCHEDULED]: 'Callback Scheduled',
    [CallOutcome.VOICEMAIL]: 'Voicemail',
    [CallOutcome.NO_ANSWER]: 'No Answer',
    [CallOutcome.BUSY]: 'Busy',
    [CallOutcome.NOT_INTERESTED]: 'Not Interested',
    [CallOutcome.WRONG_NUMBER]: 'Wrong Number',
    [CallOutcome.DO_NOT_CALL]: 'Do Not Call',
    [CallOutcome.HANGUP]: 'Hangup',
    [CallOutcome.FAILED]: 'Failed',
    [CallOutcome.CANCELLED]: 'Cancelled',
    [CallOutcome.ERROR]: 'Error'
  };
  return labels[outcome] || outcome;
}

export default CallOutcome;
