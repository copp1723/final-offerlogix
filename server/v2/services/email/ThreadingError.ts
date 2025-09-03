export class ThreadingError extends Error {
  constructor(
    message: string,
    public code:
      | 'DUPLICATE_MESSAGE_ID'
      | 'INVALID_AGENT'
      | 'CONVERSATION_NOT_FOUND'
      | 'DB_ERROR',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ThreadingError';
  }
}

