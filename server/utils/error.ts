/**
 * Safely convert unknown values to Error objects
 * This utility ensures we always work with proper Error instances
 * while preserving error information from various sources
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  if (typeof error === 'object' && error !== null) {
    // Handle objects with message property
    if ('message' in error && typeof error.message === 'string') {
      const err = new Error(error.message);
      // Preserve additional properties if they exist
      if ('name' in error && typeof error.name === 'string') {
        err.name = error.name;
      }
      if ('stack' in error && typeof error.stack === 'string') {
        err.stack = error.stack;
      }
      return err;
    }
    
    // Handle objects with other string representations
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error('Unknown error object');
    }
  }
  
  // Handle primitive values
  if (typeof error === 'number') {
    return new Error(`Error code: ${error}`);
  }
  
  if (typeof error === 'boolean') {
    return new Error(`Error flag: ${error}`);
  }
  
  // Fallback for undefined, null, symbols, functions, etc.
  return new Error(`Unknown error: ${String(error)}`);
}

/**
 * Type guard to check if a value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  return toError(error).message;
}

/**
 * Create a new error with additional context while preserving the original
 */
export function wrapError(error: unknown, context: string): Error {
  const originalError = toError(error);
  const wrappedError = new Error(`${context}: ${originalError.message}`);
  
  // Preserve the original stack trace if available
  if (originalError.stack) {
    wrappedError.stack = `${wrappedError.stack}\nCaused by: ${originalError.stack}`;
  }
  
  return wrappedError;
}

/**
 * Create error context object for logging
 */
export function createErrorContext(error: unknown): { error: string; stack?: string; name?: string } {
  const err = toError(error);
  return {
    error: err.message,
    stack: err.stack,
    name: err.name
  };
}