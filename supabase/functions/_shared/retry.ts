/**
 * Shared retry utilities with exponential backoff for Supabase Edge Functions
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** HTTP status codes that should trigger a retry (default: [429, 502, 503, 504]) */
  retryableStatuses?: number[]
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean
  /** Callback for logging retry attempts */
  onRetry?: (attempt: number, delay: number, error: unknown) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [429, 502, 503, 504],
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt)
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)
  // Add jitter (0-25% of delay) to prevent thundering herd
  const jitter = cappedDelay * Math.random() * 0.25
  return Math.floor(cappedDelay + jitter)
}

/**
 * Check if an error contains a retryable HTTP status code
 */
function isRetryableStatus(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Check for status codes in error message
    for (const status of retryableStatuses) {
      if (message.includes(String(status))) return true
    }
    // Check for common transient error patterns
    if (message.includes('rate limit') || message.includes('too many requests')) return true
    if (message.includes('timeout') || message.includes('timed out')) return true
    if (message.includes('temporarily unavailable')) return true
    if (message.includes('service unavailable')) return true
    if (message.includes('bad gateway')) return true
    if (message.includes('gateway timeout')) return true
  }
  return false
}

/**
 * Custom error class for retry failures
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * const result = await withRetry(
 *   () => fetchFromApi(),
 *   { maxRetries: 3, retryableStatuses: [429, 503] }
 * )
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    retryableStatuses = DEFAULT_OPTIONS.retryableStatuses,
    isRetryable,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        break
      }

      // Check if the error is retryable
      const shouldRetry = isRetryable
        ? isRetryable(error)
        : isRetryableStatus(error, retryableStatuses)

      if (!shouldRetry) {
        // Not a retryable error, throw immediately
        throw error
      }

      // Calculate delay for this attempt
      const delay = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier)

      // Log retry attempt
      if (onRetry) {
        onRetry(attempt + 1, delay, error)
      } else {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // Wait before retrying
      await sleep(delay)
    }
  }

  // All retries exhausted
  throw new RetryError(
    `Failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    maxRetries + 1,
    lastError
  )
}

/**
 * Execute a fetch request with retry logic
 * Automatically checks response status for retryable errors
 *
 * @example
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' })
 * })
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const {
    retryableStatuses = DEFAULT_OPTIONS.retryableStatuses,
    ...retryOptions
  } = options

  return withRetry(
    async () => {
      const response = await fetch(url, init)

      // Check if response status is retryable
      if (retryableStatuses.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    },
    { ...retryOptions, retryableStatuses }
  )
}
