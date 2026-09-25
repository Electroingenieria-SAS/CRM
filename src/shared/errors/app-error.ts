export type AppErrorCode =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'BUSINESS_RULE'
  | 'NETWORK'
  | 'DATABASE'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
