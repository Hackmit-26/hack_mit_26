export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'NOT_MEMBER'
  | 'INVALID_STATE'
  | 'NOT_ENOUGH_DATA'
  | 'VISA_ERROR'
  | 'LLM_ERROR'
  | 'VALIDATION_ERROR';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const invalidState = (message: string) => new AppError('INVALID_STATE', 409, message);
export const notFound = (message = 'Not found') => new AppError('NOT_FOUND', 404, message);
