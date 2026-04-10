export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ExternalApiError extends AppError {
  public readonly retryAfterSeconds: number | null;

  constructor(message: string, statusCode = 502, code = "EXTERNAL_API_ERROR", retryAfterSeconds: number | null = null) {
    super(message, statusCode, code);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
