import { HttpStatus } from '@nestjs/common';

export interface ErrorRequest {
  url: string;
  method: string;
}

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string;
}

export class ErrorResponseBuilder {
  /**
   * Build standardized error response
   */
  static build(
    status: number,
    message: string | string[],
    request: ErrorRequest,
    error?: string,
  ): ErrorResponse {
    return {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: error || this.getErrorName(status),
    };
  }

  /**
   * Get error name from HTTP status code
   */
  static getErrorName(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      default:
        return 'Error';
    }
  }
}
