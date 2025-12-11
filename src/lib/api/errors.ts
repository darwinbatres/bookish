import type { NextApiResponse } from "next";

/**
 * Standard API Error Response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }

  toResponse(): ApiErrorResponse {
    return {
      error: this.getErrorName(),
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }

  private getErrorName(): string {
    switch (this.statusCode) {
      case 400:
        return "Bad Request";
      case 401:
        return "Unauthorized";
      case 403:
        return "Forbidden";
      case 404:
        return "Not Found";
      case 405:
        return "Method Not Allowed";
      case 409:
        return "Conflict";
      case 413:
        return "Payload Too Large";
      case 422:
        return "Unprocessable Entity";
      case 429:
        return "Too Many Requests";
      case 500:
        return "Internal Server Error";
      case 502:
        return "Bad Gateway";
      case 503:
        return "Service Unavailable";
      default:
        return "Error";
    }
  }
}

/**
 * Pre-defined error factories
 */
export const Errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiError(message, 400, details),

  unauthorized: (message = "Authentication required") =>
    new ApiError(message, 401),

  forbidden: (message = "Access denied") => new ApiError(message, 403),

  notFound: (resource = "Resource") =>
    new ApiError(`${resource} not found`, 404),

  methodNotAllowed: (allowed: string[]) =>
    new ApiError(`Method not allowed. Allowed: ${allowed.join(", ")}`, 405),

  conflict: (message: string) => new ApiError(message, 409),

  payloadTooLarge: (maxSize: string) =>
    new ApiError(`Payload too large. Maximum size: ${maxSize}`, 413),

  unprocessable: (message: string, details?: Record<string, unknown>) =>
    new ApiError(message, 422, details),

  tooManyRequests: (retryAfter?: number) =>
    new ApiError(
      `Too many requests. ${retryAfter ? `Retry after ${retryAfter}s` : ""}`,
      429
    ),

  internal: (message = "An unexpected error occurred") =>
    new ApiError(message, 500),

  serviceUnavailable: (message = "Service temporarily unavailable") =>
    new ApiError(message, 503),
};

/**
 * Send error response
 */
export function sendError(res: NextApiResponse, error: ApiError | Error): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json(error.toResponse());
  } else {
    // Log unexpected errors in production
    console.error("Unexpected error:", error);

    const apiError = Errors.internal(
      process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred"
    );
    res.status(500).json(apiError.toResponse());
  }
}
