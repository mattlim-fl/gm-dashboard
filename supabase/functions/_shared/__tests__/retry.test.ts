/**
 * Unit tests for retry utilities
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/retry.test.ts
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import {
  withRetry,
  RetryError,
} from "../retry.ts"

// ============================================
// withRetry Tests
// ============================================

Deno.test("withRetry - succeeds on first attempt", async () => {
  let attempts = 0

  const result = await withRetry(async () => {
    attempts++
    return "success"
  })

  assertEquals(result, "success")
  assertEquals(attempts, 1)
})

Deno.test("withRetry - retries on transient error and succeeds", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      if (attempts < 3) {
        throw new Error("HTTP 503: Service temporarily unavailable")
      }
      return "success after retry"
    },
    { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 }
  )

  assertEquals(result, "success after retry")
  assertEquals(attempts, 3)
})

Deno.test("withRetry - throws immediately on non-retryable error", async () => {
  let attempts = 0

  await assertRejects(
    async () => {
      await withRetry(
        async () => {
          attempts++
          throw new Error("Invalid input")
        },
        { maxRetries: 3, initialDelayMs: 10 }
      )
    },
    Error,
    "Invalid input"
  )

  assertEquals(attempts, 1) // Should not retry
})

Deno.test("withRetry - throws RetryError after max retries", async () => {
  let attempts = 0

  await assertRejects(
    async () => {
      await withRetry(
        async () => {
          attempts++
          throw new Error("HTTP 503: Server error")
        },
        { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 20 }
      )
    },
    RetryError
  )

  assertEquals(attempts, 3) // Initial + 2 retries
})

Deno.test("withRetry - respects custom retryable statuses", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      if (attempts < 2) {
        throw new Error("Custom error 418")
      }
      return "success"
    },
    {
      maxRetries: 3,
      initialDelayMs: 10,
      retryableStatuses: [418], // Custom status
    }
  )

  assertEquals(result, "success")
  assertEquals(attempts, 2)
})

Deno.test("withRetry - calls onRetry callback", async () => {
  const retryLog: Array<{ attempt: number; delay: number }> = []

  await assertRejects(
    async () => {
      await withRetry(
        async () => {
          throw new Error("Rate limit exceeded")
        },
        {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 20,
          onRetry: (attempt, delay) => {
            retryLog.push({ attempt, delay })
          },
        }
      )
    },
    RetryError
  )

  assertEquals(retryLog.length, 2)
  assertEquals(retryLog[0].attempt, 1)
  assertEquals(retryLog[1].attempt, 2)
})

Deno.test("withRetry - uses custom isRetryable function", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      if (attempts < 2) {
        throw new Error("CUSTOM_RETRYABLE_ERROR")
      }
      return "success"
    },
    {
      maxRetries: 3,
      initialDelayMs: 10,
      isRetryable: (error) => {
        return error instanceof Error && error.message.includes("CUSTOM_RETRYABLE")
      },
    }
  )

  assertEquals(result, "success")
  assertEquals(attempts, 2)
})

Deno.test("withRetry - handles rate limit errors", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      if (attempts < 2) {
        throw new Error("Too many requests")
      }
      return "success"
    },
    { maxRetries: 3, initialDelayMs: 10 }
  )

  assertEquals(result, "success")
  assertEquals(attempts, 2)
})

Deno.test("withRetry - handles timeout errors", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      if (attempts < 2) {
        throw new Error("Request timed out")
      }
      return "success"
    },
    { maxRetries: 3, initialDelayMs: 10 }
  )

  assertEquals(result, "success")
  assertEquals(attempts, 2)
})

Deno.test("withRetry - handles bad gateway errors", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      if (attempts < 2) {
        throw new Error("502 Bad Gateway")
      }
      return "success"
    },
    { maxRetries: 3, initialDelayMs: 10 }
  )

  assertEquals(result, "success")
  assertEquals(attempts, 2)
})

// ============================================
// RetryError Tests
// ============================================

Deno.test("RetryError - contains attempt count and last error", async () => {
  const originalError = new Error("Original failure")

  try {
    await withRetry(
      async () => {
        throw originalError
      },
      { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 20 }
    )
  } catch (error) {
    if (error instanceof RetryError) {
      assertEquals(error.attempts, 3)
      assertEquals(error.lastError, originalError)
      assertEquals(error.message.includes("Failed after 3 attempts"), true)
    } else {
      throw new Error("Expected RetryError")
    }
  }
})

// ============================================
// Edge Cases
// ============================================

Deno.test("withRetry - handles async errors correctly", async () => {
  let attempts = 0

  const result = await withRetry(
    async () => {
      attempts++
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (attempts < 2) {
        throw new Error("Service unavailable")
      }
      return "async success"
    },
    { maxRetries: 3, initialDelayMs: 10 }
  )

  assertEquals(result, "async success")
  assertEquals(attempts, 2)
})

Deno.test("withRetry - works with zero retries", async () => {
  let attempts = 0

  await assertRejects(
    async () => {
      await withRetry(
        async () => {
          attempts++
          throw new Error("Service unavailable")
        },
        { maxRetries: 0, initialDelayMs: 10 }
      )
    },
    RetryError
  )

  assertEquals(attempts, 1) // Only initial attempt
})

Deno.test("withRetry - preserves return type", async () => {
  interface MyResult {
    id: number
    name: string
  }

  const result = await withRetry<MyResult>(async () => {
    return { id: 123, name: "test" }
  })

  assertEquals(result.id, 123)
  assertEquals(result.name, "test")
})
