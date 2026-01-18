/**
 * Standardized response formatters for VAPI tool responses
 * Ensures consistent error handling and response structures
 */

export interface FormattedResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  nextAction?: string;
  error?: {
    code: string;
    details?: string;
  };
}

/**
 * Format a successful tool response
 */
export function formatSuccess<T>(data: T, message?: string, nextAction?: string): FormattedResponse<T> {
  return {
    success: true,
    data,
    message: message || 'Operation completed successfully',
    nextAction: nextAction || 'CONTINUE'
  };
}

/**
 * Format a failed tool response
 */
export function formatError(
  errorCode: string,
  message: string,
  details?: string,
  nextAction?: string
): FormattedResponse<never> {
  return {
    success: false,
    message,
    nextAction: nextAction || 'RETRY',
    error: {
      code: errorCode,
      details
    }
  };
}

/**
 * Format a SafeCall result into a standardized response
 */
export function formatSafeCallResult<T>(
  result: { success: boolean; data?: T; userMessage?: string },
  successMessage: string,
  errorCode: string = 'SERVICE_UNAVAILABLE'
): FormattedResponse<T> {
  if (result.success) {
    return formatSuccess(result.data, successMessage);
  }
  return formatError(errorCode, result.userMessage || 'Service temporarily unavailable');
}
