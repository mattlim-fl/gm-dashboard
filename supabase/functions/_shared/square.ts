/**
 * Shared Square API utilities for Supabase Edge Functions
 */

// Square API base URL - use sandbox for development
const SQUARE_API_BASE = 'https://connect.squareupsandbox.com'
const SQUARE_API_VERSION = '2023-10-18'

export interface ChargeParams {
  amountCents: number
  token: string
  idempotencyKey: string
  locationId: string
  accessToken: string
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
 */
export async function chargeSquare(params: ChargeParams): Promise<ChargeResult> {
  const { amountCents, token, idempotencyKey, locationId, accessToken } = params

  const res = await fetch(`${SQUARE_API_BASE}/v2/payments`, {
    method: 'POST',
    headers: {
      'Square-Version': SQUARE_API_VERSION,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      source_id: token,
      location_id: locationId,
      amount_money: { amount: amountCents, currency: 'AUD' }
    })
  })

  const body = await res.json()

  if (!res.ok) {
    const message = body?.errors?.[0]?.detail || body?.message || 'Square charge failed'
    throw new Error(message)
  }

  const paymentId = body?.payment?.id
  if (!paymentId) throw new Error('Missing Square payment id')

  return { paymentId }
}

/**
 * Refund a Square payment
 */
export async function refundSquarePayment(params: RefundParams): Promise<RefundResult> {
  const { paymentId, amountCents, accessToken, reason } = params
  const idempotencyKey = await toIdempotencyKey(`refund:${paymentId}:${amountCents}:${Date.now()}`)

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

  const body = await res.json()

  if (!res.ok) {
    const message = body?.errors?.[0]?.detail || body?.message || 'Square refund failed'
    console.error('Refund failed:', { paymentId, amountCents, error: message })
    throw new Error(`Refund failed: ${message}`)
  }

  const refundId = body?.refund?.id
  if (!refundId) throw new Error('Missing Square refund id')

  console.log('Refund successful:', { paymentId, refundId, amountCents })
  return { refundId }
}

export interface CreateOrderParams {
  locationId: string
  accessToken: string
  idempotencyKey: string
  lineItems: Array<{
    name: string
    quantity: number
    amountCents: number
  }>
}

export interface CreateOrderResult {
  orderId: string
  totalCents: number
}

/**
 * Create a Square order with line items
 */
export async function createSquareOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { locationId, accessToken, idempotencyKey, lineItems } = params

  const squareLineItems = lineItems.map(item => ({
    name: item.name,
    quantity: String(item.quantity),
    base_price_money: { amount: item.amountCents, currency: 'AUD' }
  }))

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

  const body = await res.json()

  if (!res.ok) {
    const message = body?.errors?.[0]?.detail || body?.message || 'Square order creation failed'
    throw new Error(message)
  }

  const orderId = body?.order?.id
  const totalCents = Number(body?.order?.total_money?.amount || 0)

  if (!orderId) throw new Error('Missing Square order id')

  return { orderId, totalCents }
}
