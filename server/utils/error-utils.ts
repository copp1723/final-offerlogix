/**
 * Type guard to check if a value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Convert unknown error to Error instance for logging
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }
  
  return new Error('Unknown error occurred: ' + String(error));
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return 'Unknown error: ' + String(error);
}

/**
 * Create error context for logging with proper typing
 */
export function createErrorContext(error: unknown, additionalContext?: Record<string, unknown>) {
  const errorObj = toError(error);
  return {
    error: errorObj,
    message: errorObj.message,
    stack: errorObj.stack,
    ...additionalContext
  };
}

export type ErrorCategory =
  | 'network'
  | 'api'
  | 'parsing'
  | 'validation'
  | 'auth'
  | 'rate_limit'
  | 'unknown';

/**
 * Categorize errors for better handling and user feedback
 */
export function categorizeError(error: unknown): ErrorCategory {
  const err = toError(error);
  const msg = err.message.toLowerCase();

  if (msg.includes('network') || msg.includes('fetch') || (err as any).code === 'ECONNREFUSED') {
    return 'network';
  }
  if (msg.includes('timeout')) {
    return 'network';
  }
  if (msg.includes('json') || msg.includes('parse')) {
    return 'parsing';
  }
  if (msg.includes('invalid') || msg.includes('validation')) {
    return 'validation';
  }
  if (msg.includes('unauthorized') || msg.includes('forbidden')) {
    return 'auth';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'rate_limit';
  }
  return 'unknown';
}

/**
 * Build standardized error response with category and user-friendly message
 */
export function buildErrorResponse(error: unknown) {
  const category = categorizeError(error);
  let message = getErrorMessage(error);

  const userFriendlyMessages: Record<ErrorCategory, string> = {
    network: 'Network error. Please check your connection and retry.',
    api: 'AI service error. Please try again later.',
    parsing: 'Received an unexpected response from the AI service.',
    validation: 'Invalid input provided. Please review and try again.',
    auth: 'Authentication required. Please refresh the page.',
    rate_limit: 'Too many requests. Please wait a moment and try again.',
    unknown: 'Unexpected error occurred. Please try again.'
  };

  // Use user-friendly message for frontend
  message = userFriendlyMessages[category];

  return { message, type: category } as const;
}