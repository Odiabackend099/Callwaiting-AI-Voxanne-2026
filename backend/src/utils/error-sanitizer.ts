import { log } from '../config/logger';

/**
 * Sanitizes error messages before sending to users
 * Logs full technical details internally for debugging
 *
 * @param error - The error object (can be Error, any, or unknown)
 * @param context - Description of where/what failed (for logging)
 * @param fallbackMessage - Generic message if error can't be classified
 * @returns User-friendly error message (never contains technical details)
 */
export function sanitizeError(
  error: any,
  context: string,
  fallbackMessage: string = 'An error occurred'
): string {
  // Log full error details internally (for Sentry/debugging)
  // This ensures developers can still debug issues
  log.error('SanitizedError', context, {
    errorMessage: error?.message,
    code: error?.code,
    constraint: error?.constraint,
    detail: error?.detail,
    stack: error?.stack,
    name: error?.name,
  });

  // Extract error message safely
  const errorMessage = error?.message?.toLowerCase() || '';

  // Database errors (PostgreSQL/Supabase)
  if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
    return 'Database configuration error. Please contact support.';
  }
  if (errorMessage.includes('violates') && errorMessage.includes('constraint')) {
    return 'This operation would create an invalid data state.';
  }
  if (errorMessage.includes('duplicate key')) {
    return 'This record already exists.';
  }
  if (errorMessage.includes('foreign key')) {
    return 'Cannot complete operation due to data dependencies.';
  }
  if (errorMessage.includes('null value') && errorMessage.includes('violates not-null')) {
    return 'Required information is missing.';
  }

  // Network/timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'Request timed out. Please try again.';
  }
  if (errorMessage.includes('network') || errorMessage.includes('econnrefused')) {
    return 'Unable to connect to service. Please try again shortly.';
  }
  if (errorMessage.includes('socket hang up') || errorMessage.includes('enotfound')) {
    return 'Connection failed. Please check your network and try again.';
  }

  // Validation errors (from services)
  if (errorMessage.includes('validation failed')) {
    return 'Invalid input provided.';
  }
  if (errorMessage.includes('invalid format') || errorMessage.includes('must be')) {
    return 'Invalid input format. Please check your data.';
  }

  // Permission/auth errors (should rarely reach here, usually caught earlier)
  if (errorMessage.includes('permission denied') || errorMessage.includes('pgrst116')) {
    return 'You do not have permission to access this data.';
  }
  if (errorMessage.includes('unauthorized') || errorMessage.includes('not authenticated')) {
    return 'Authentication required. Please sign in.';
  }

  // Service-specific errors
  if (errorMessage.includes('retry exhausted')) {
    return 'Operation timed out after multiple attempts. Please try again.';
  }
  if (errorMessage.includes('runtime does not support')) {
    return 'Server configuration error. Please contact support.';
  }

  // Default: return generic message (never expose raw error)
  return fallbackMessage;
}

/**
 * Sanitizes validation errors from Zod schema validation
 *
 * @param zodError - Zod error object with issues array
 * @returns User-friendly validation error message
 */
export function sanitizeValidationError(zodError: any): string {
  log.warn('ValidationError', 'Input validation failed', {
    issues: zodError.issues,
    issueCount: zodError.issues?.length,
  });

  // Don't expose regex patterns, field constraints, or schema details
  // Just return a generic validation message
  return 'Invalid input. Please check your data and try again.';
}

/**
 * Standard error response helper
 * Logs internal error details, sends sanitized response to user
 *
 * @param res - Express response object
 * @param statusCode - HTTP status code (400, 500, etc.)
 * @param userMessage - User-friendly message to send
 * @param internalError - Original error object (for logging only)
 * @param context - Context string for logging
 */
export function errorResponse(
  res: any, // Express.Response type
  statusCode: number,
  userMessage: string,
  internalError?: any,
  context?: string
) {
  // Log internal error details (if provided)
  if (internalError && context) {
    log.error(context, userMessage, {
      error: internalError?.message,
      stack: internalError?.stack,
      code: internalError?.code,
    });
  }

  // Send sanitized response to user
  return res.status(statusCode).json({
    error: userMessage,
  });
}

/**
 * Detect if error is an RLS (Row-Level Security) violation
 *
 * @param error - Error object to check
 * @returns true if RLS violation, false otherwise
 */
export function isRLSViolation(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toUpperCase() || '';

  return (
    errorCode === 'PGRST116' ||
    errorMessage.includes('permission denied') ||
    errorMessage.includes('row-level security')
  );
}

/**
 * Sanitize and respond with appropriate message for database errors
 * Handles common database error patterns
 *
 * @param res - Express response object
 * @param error - Database error object
 * @param context - Context string describing the operation
 * @param fallbackMessage - Fallback message if error can't be classified
 */
export function handleDatabaseError(
  res: any,
  error: any,
  context: string,
  fallbackMessage: string = 'Database operation failed'
) {
  // Check for RLS violations first (security-sensitive)
  if (isRLSViolation(error)) {
    log.error('RLS Violation', context, {
      errorMessage: error?.message,
      code: error?.code,
    });
    return res.status(403).json({
      error: 'You do not have permission to access this data.',
    });
  }

  // Sanitize and return generic database error
  const userMessage = sanitizeError(error, context, fallbackMessage);
  return errorResponse(res, 500, userMessage, error, context);
}
