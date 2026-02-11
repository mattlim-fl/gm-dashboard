/**
 * Shared Square API utilities for Supabase Edge Functions
 */

import { withRetry, RetryOptions } from './retry.ts'
import { PaymentError, logError } from './errors.ts'
import {
  parseSquarePaymentResponse,
  parseSquareRefundResponse,
  parseSquareOrderResponse,
  extractSquareError,
} from './schemas.ts'

// Square API base URL - production
const SQUARE_API_BASE = 'https://connect.squareup.com'
const SQUARE_API_VERSION = '2023-10-18'

// Default retry options for Square API calls
const SQUARE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 502, 503, 504],
  onRetry: (attempt, delay, error) => {
    logError('square_retry', error, { attempt, delay })
  }
}

export interface ChargeParams {
  amountCents: number
  token: string
  idempotencyKey: string
  locationId: string
  accessToken: string
  orderId?: string // Optional: link payment to a Square order
}

export interface ChargeResult {
  paymentId: string
}

export interface RefundParams {
  paymentId: string
  amountCents: number
  accessToken: string
  reason?: string
}

export interface RefundResult {
  refundId: string
}

/**
 * Generate a SHA-256 hash truncated to 45 chars for Square idempotency keys
 */
export async function toIdempotencyKey(value: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(value)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const bytes = new Uint8Array(digest)
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0')
    }
    // Square idempotency key must be <= 45 chars
    return hex.slice(0, 45)
  } catch {
    // Fallback: truncate original string
    return String(value).slice(0, 45)
  }
}

/**
 * Charge a customer using Square Payments API
 * Includes automatic retry with exponential backoff for transient failures
 */
export async function chargeSquare(params: ChargeParams): Promise<ChargeResult> {
  const { amountCents, token, idempotencyKey, locationId, accessToken, orderId } = params

  return withRetry(async () => {
    const paymentBody: Record<string, unknown> = {
      idempotency_key: idempotencyKey,
      source_id: token,
      location_id: locationId,
      amount_money: { amount: amountCents, currency: 'AUD' }
    }

    // Link payment to order if provided
    if (orderId) {
      paymentBody.order_id = orderId
    }

    const res = await fetch(`${SQUARE_API_BASE}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_API_VERSION,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentBody)
    })

    const rawBody = await res.json()

    // Check for retryable status codes
    if ([429, 502, 503, 504].includes(res.status)) {
      const errorMsg = extractSquareError(rawBody) || res.statusText
      throw new Error(`Square API error ${res.status}: ${errorMsg}`)
    }

    if (!res.ok) {
      const message = extractSquareError(rawBody) || 'Square charge failed'
      // Client errors (4xx) should not be retried
      throw new PaymentError(message, undefined, res.status >= 400 && res.status < 500 ? 400 : 500)
    }

    // Validate response with Zod schema
    const body = parseSquarePaymentResponse(rawBody)

    const paymentId = body.payment?.id
    if (!paymentId) throw new PaymentError('Missing Square payment id')

    return { paymentId }
  }, SQUARE_RETRY_OPTIONS)
}

/**
 * Refund a Square payment
 * Includes automatic retry with exponential backoff for transient failures
 */
export async function refundSquarePayment(params: RefundParams): Promise<RefundResult> {
  const { paymentId, amountCents, accessToken, reason } = params
  const idempotencyKey = await toIdempotencyKey(`refund:${paymentId}:${amountCents}:${Date.now()}`)

  return withRetry(async () => {
    const res = await fetch(`${SQUARE_API_BASE}/v2/refunds`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_API_VERSION,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        payment_id: paymentId,
        amount_money: { amount: amountCents, currency: 'AUD' },
        reason: reason || 'Booking creation failed - automatic refund'
      })
    })

    const rawBody = await res.json()

    // Check for retryable status codes
    if ([429, 502, 503, 504].includes(res.status)) {
      const errorMsg = extractSquareError(rawBody) || res.statusText
      throw new Error(`Square API error ${res.status}: ${errorMsg}`)
    }

    if (!res.ok) {
      const message = extractSquareError(rawBody) || 'Square refund failed'
      logError('refund_failed', new Error(message), { paymentId, amountCents })
      throw new PaymentError(`Refund failed: ${message}`, paymentId, res.status >= 400 && res.status < 500 ? 400 : 500)
    }

    // Validate response with Zod schema
    const body = parseSquareRefundResponse(rawBody)

    const refundId = body.refund?.id
    if (!refundId) throw new PaymentError('Missing Square refund id', paymentId)

    console.log('Refund successful:', { paymentId, refundId, amountCents })
    return { refundId }
  }, SQUARE_RETRY_OPTIONS)
}

export interface CreateOrderParams {
  locationId: string
  accessToken: string
  idempotencyKey: string
  lineItems: Array<{
    catalogObjectId: string // Square catalog item variation ID
    quantity: number
    basePriceCents?: number // Optional: override catalog price (for variable-priced items like karaoke)
  }>
}

export interface CreateOrderResult {
  orderId: string
  totalCents: number
}

/**
 * Create a Square order with line items
 * Includes automatic retry with exponential backoff for transient failures
 */
export async function createSquareOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { locationId, accessToken, idempotencyKey, lineItems } = params

  const squareLineItems = lineItems.map(item => {
    const lineItem: Record<string, unknown> = {
      catalog_object_id: item.catalogObjectId,
      quantity: String(item.quantity)
    }
    // Override catalog price if specified (for variable-priced items like karaoke)
    if (item.basePriceCents !== undefined) {
      lineItem.base_price_money = { amount: item.basePriceCents, currency: 'AUD' }
    }
    return lineItem
  })

  return withRetry(async () => {
    const res = await fetch(`${SQUARE_API_BASE}/v2/orders`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_API_VERSION,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        order: {
          location_id: locationId,
          line_items: squareLineItems
        }
      })
    })

    const rawBody = await res.json()

    // Check for retryable status codes
    if ([429, 502, 503, 504].includes(res.status)) {
      const errorMsg = extractSquareError(rawBody) || res.statusText
      throw new Error(`Square API error ${res.status}: ${errorMsg}`)
    }

    if (!res.ok) {
      const message = extractSquareError(rawBody) || 'Square order creation failed'
      throw new PaymentError(message, undefined, res.status >= 400 && res.status < 500 ? 400 : 500)
    }

    // Validate response with Zod schema
    const body = parseSquareOrderResponse(rawBody)

    const orderId = body.order?.id
    const totalCents = Number(body.order?.total_money?.amount || 0)

    if (!orderId) throw new PaymentError('Missing Square order id')

    return { orderId, totalCents }
  }, SQUARE_RETRY_OPTIONS)
}
