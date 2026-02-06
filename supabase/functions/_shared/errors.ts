/**
 * Shared error handling utilities for Supabase Edge Functions
 */

/**
 * Base class for application errors with HTTP status codes
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Error for payment-related failures
 */
export class PaymentError extends AppError {
  constructor(
    message: string,
    public readonly paymentId?: string,
    statusCode: number = 500
  ) {
    super(message, statusCode, 'PAYMENT_ERROR')
    this.name = 'PaymentError'
  }
}

/**
 * Error for booking-related failures
 */
export class BookingError extends AppError {
  constructor(
    message: string,
    public readonly bookingId?: string,
    statusCode: number = 500
  ) {
    super(message, statusCode, 'BOOKING_ERROR')
    this.name = 'BookingError'
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

/**
 * Error for authentication failures
 */
export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR')
    this.name = 'AuthError'
  }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends AppError {
  constructor(
    message: string,
    public readonly resource?: string
  ) {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

/**
 * Error for configuration/environment issues
 */
export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 500, 'CONFIG_ERROR')
    this.name = 'ConfigError'
  }
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: Record<string, unknown>
}

/**
 * Determine HTTP status code from an error
 */
export function getStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Client errors (4xx)
    if (message.includes('invalid') || message.includes('missing')) return 400
    if (message.includes('unauthorized') || message.includes('unauthenticated')) return 401
    if (message.includes('forbidden') || message.includes('not allowed')) return 403
    if (message.includes('not found') || message.includes('expired')) return 404
    if (message.includes('conflict') || message.includes('already exists')) return 409
    if (message.includes('rate limit') || message.includes('too many')) return 429

    // Server errors (5xx)
    if (message.includes('timeout')) return 504
    if (message.includes('unavailable')) return 503
  }

  // Default to internal server error
  return 500
}

/**
 * Format an error into a standard response object
 */
export function formatErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    }
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: false,
    error: String(error),
  }
}

/**
 * Create a JSON Response object from an error
 */
export function errorResponse(
  error: unknown,
  corsHeaders: Record<string, string> = {}
): Response {
  const statusCode = getStatusCode(error)
  const body = formatErrorResponse(error)

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Wrap an async handler with standardized error handling
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>,
  corsHeaders: Record<string, string> = {}
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (error) {
      console.error('Request handler error:', error)
      return errorResponse(error, corsHeaders)
    }
  }
}

/**
 * Log an error with context
 */
export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  const errorInfo = {
    context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...extra,
  }

  console.error(JSON.stringify(errorInfo))
}
