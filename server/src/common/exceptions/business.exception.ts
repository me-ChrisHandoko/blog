export class BusinessException extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, any>,
  ) {
    super(messageKey);
  }
}

export class UserNotFoundException extends BusinessException {
  constructor(userId: string) {
    super('USER_NOT_FOUND', 'users.messages.notFound', 404, { userId });
  }
}
