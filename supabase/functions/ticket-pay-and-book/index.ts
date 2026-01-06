// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Minimal declaration for Deno global used for env access in Edge Functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

type TicketPayAndBookRequest = {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  venue: string
  bookingDate: string
  ticketQuantity: number
  ticketType?: string
  paymentToken: string
  groupToken?: string // Optional: for guest purchases via shared link
  parentBookingId?: string // Optional: for occasion ticket purchases
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-action, x-api-key",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function getOriginFromRequest(req: Request): string {
  // Try to get origin from Origin header
  const origin = req.headers.get('origin')
  if (origin) return origin
  
  // Try to get from Referer header
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      const url = new URL(referer)
      return `${url.protocol}//${url.host}`
    } catch {
      // ignore parse errors
    }
  }
  
  // Fallback to production domain
  return 'https://manorleederville.com'
}

async function toIdempotencyKey(value: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(value)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const bytes = new Uint8Array(digest)
    let hex = ''
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
    // Square idempotency key must be <= 45 chars
    return hex.slice(0, 45)
  } catch {
    // Fallback: truncate original string
    return String(value).slice(0, 45)
  }
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const bytes = new Uint8Array(signature)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

async function generateGuestListToken(bookingId: string, bookingDate: string): Promise<string> {
  const secret = Deno.env.get('GUEST_LIST_SECRET') || 'guest-list-secret'

  let expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // default: 7 days from now
  try {
    if (bookingDate) {
      const d = new Date(String(bookingDate))
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1) // expire 1 day after booking date
        expiry = Math.floor(d.getTime() / 1000)
      }
    }
  } catch {
    // fall back to default expiry
  }

  const sig = await hmacSha256(`${bookingId}${expiry}`, secret)
  return `${bookingId}.${expiry}.${sig}`
}

function generateReferenceCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `TIX-${code}`
}

function generateShareToken(): string {
  // 8-char alphanumeric (no ambiguous chars: 0/O, 1/I/L)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 8; i++) token += alphabet[Math.floor(Math.random() * alphabet.length)]
  return token
}

async function chargeSquare(params: { amountCents: number; token: string; idempotencyKey: string; locationId: string; accessToken: string }): Promise<{ paymentId: string }> {
  const { amountCents, token, idempotencyKey, locationId, accessToken } = params
  const res = await fetch('https://connect.squareupsandbox.com/v2/payments', {
    method: 'POST',
    headers: {
      'Square-Version': '2023-10-18',
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

async function fetchParentBookingByShareToken(
  shareToken: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ id: string; booking_date: string; venue: string; customer_name: string } | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/bookings?share_token=eq.${encodeURIComponent(shareToken)}&select=id,booking_date,venue,customer_name`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      }
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null
  return data[0]
}

async function createTicketBooking(
  payload: {
    customerName: string
    customerEmail?: string
    customerPhone?: string
    venue: string
    bookingDate: string
    ticketQuantity: number
    ticketType?: string
    ticketPriceCents: number
    totalAmount: number
    squarePaymentId: string
    guestListToken: string
    shareToken?: string | null
    parentBookingId?: string | null
  },
  supabaseUrl: string,
  supabaseKey: string
) {
  const referenceCode = generateReferenceCode()
  const row: Record<string, unknown> = {
    customer_name: payload.customerName,
    customer_email: payload.customerEmail || null,
    customer_phone: payload.customerPhone || null,
    booking_type: 'vip_tickets',
    venue: payload.venue,
    booking_date: payload.bookingDate,
    ticket_quantity: payload.ticketQuantity,
    ticket_price_cents: payload.ticketPriceCents,
    status: 'confirmed',
    payment_status: 'paid',
    total_amount: payload.totalAmount,
    square_payment_id: payload.squarePaymentId,
    payment_attempted_at: new Date().toISOString(),
    payment_completed_at: new Date().toISOString(),
    booking_source: 'website_direct',
    reference_code: referenceCode,
    guest_list_token: payload.guestListToken,
  }
  
  // Add share_token for organiser bookings
  if (payload.shareToken) {
    row.share_token = payload.shareToken
  }
  
  // Add parent_booking_id for guest bookings
  if (payload.parentBookingId) {
    row.parent_booking_id = payload.parentBookingId
  }
  
  console.log('Creating ticket booking with row:', row)
  const res = await fetch(`${supabaseUrl}/rest/v1/bookings?select=id,reference_code,share_token`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(row)
  })
  const body = await res.json()
  console.log('Database response body:', body)
  if (!res.ok) {
    const message = body?.message || JSON.stringify(body)
    throw new Error(`Failed to create booking: ${message}`)
  }
  type BookingResp = { id?: string; reference_code?: string; share_token?: string }
  const asObj: BookingResp | BookingResp[] = body as BookingResp | BookingResp[]
  const first: BookingResp | undefined = Array.isArray(asObj) ? asObj[0] : asObj
  const id = first?.id
  const reference = first?.reference_code || referenceCode
  const shareTokenResult = first?.share_token || null
  if (!id) throw new Error('Missing booking id')
  return { bookingId: String(id), referenceCode: String(reference), shareToken: shareTokenResult }
}

async function insertGuestAsBookingGuest(bookingId: string, guestName: string, isOrganiser: boolean, supabaseUrl: string, supabaseKey: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/booking_guests`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      booking_id: bookingId,
      guest_name: guestName,
      is_organiser: isOrganiser
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Failed to insert guest:', body)
    // Non-fatal: log but don't throw - the booking is already created
  }
}

async function sendConfirmationEmail(
  payload: {
    customerName: string
    customerEmail?: string
    customerPhone?: string
    referenceCode: string
    venue: string
    bookingDate: string
    ticketQuantity: number
    guestListToken: string
    shareToken?: string | null
  },
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  if (!payload.customerEmail) return
  
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: 'priority-ticket-confirmation',
        data: {
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          customerPhone: payload.customerPhone,
          referenceCode: payload.referenceCode,
          venue: payload.venue,
          bookingDate: payload.bookingDate,
          ticketQuantity: payload.ticketQuantity,
          guestListToken: payload.guestListToken,
          shareToken: payload.shareToken,
        }
      })
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('Failed to send confirmation email:', body)
    }
  } catch (err) {
    console.error('Error sending confirmation email:', err)
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const reqHeaders = req.headers.get('Access-Control-Request-Headers') || '*'
    const headers = { ...corsHeaders, "Access-Control-Allow-Headers": reqHeaders }
    return new Response('ok', { status: 200, headers })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_SANDBOX_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_SANDBOX_LOCATION_ID') || 'LNNPG8BZ4VVMP'

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ success: false, error: 'Supabase env not configured' }, 200)
    if (!SQUARE_ACCESS_TOKEN) return json({ success: false, error: 'Square sandbox token not configured' }, 200)

    // Get the origin from the request for building the share URL
    const origin = getOriginFromRequest(req)

    const body = (await req.json()) as Record<string, unknown>
    const input: TicketPayAndBookRequest = {
      customerName: String(body.customerName || ''),
      customerEmail: body.customerEmail ? String(body.customerEmail) : undefined,
      customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
      venue: String(body.venue || 'manor'),
      bookingDate: String(body.bookingDate || ''),
      ticketQuantity: Number(body.ticketQuantity || 1),
      ticketType: body.ticketType ? String(body.ticketType) : 'priority_25_plus',
      paymentToken: String(body.paymentToken || ''),
      groupToken: body.groupToken ? String(body.groupToken) : undefined,
      parentBookingId: body.parentBookingId ? String(body.parentBookingId) : undefined,
    }

    // Validate inputs
    if (!input.customerName.trim()) return json({ success: false, error: 'Missing customer name' }, 200)
    if (!input.customerEmail && !input.customerPhone) return json({ success: false, error: 'Email or phone is required' }, 200)
    if (!input.ticketQuantity || input.ticketQuantity < 1) return json({ success: false, error: 'Invalid ticket quantity' }, 200)
    if (!input.paymentToken) return json({ success: false, error: 'Missing payment token' }, 200)

    // Determine if this is a guest purchase (via shared link) or organiser purchase
    let parentBookingId: string | null = null
    let shareToken: string | null = null
    let effectiveBookingDate = input.bookingDate
    let effectiveVenue = input.venue
    
    // Handle direct parentBookingId (for occasion bookings)
    if (input.parentBookingId) {
      parentBookingId = input.parentBookingId
      console.log(`Occasion guest purchase linked to parent booking ${parentBookingId}`)
      
      // Check capacity for occasion bookings
      const capacityCheckRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(parentBookingId)}&select=capacity,booking_date,venue`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          }
        }
      )
      const parentData = await capacityCheckRes.json()
      if (!Array.isArray(parentData) || parentData.length === 0) {
        return json({ success: false, error: 'Occasion not found' }, 200)
      }
      const parentOccasion = parentData[0]
      effectiveBookingDate = parentOccasion.booking_date
      effectiveVenue = parentOccasion.venue
      
      // Get current guest count for this occasion
      const guestCountRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?parent_booking_id=eq.${encodeURIComponent(parentBookingId)}&status=neq.cancelled&select=ticket_quantity`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          }
        }
      )
      const childBookings = await guestCountRes.json()
      const currentGuestCount = Array.isArray(childBookings) 
        ? childBookings.reduce((sum: number, b: { ticket_quantity?: number }) => sum + (b.ticket_quantity || 0), 0) 
        : 0
      
      const capacity = parentOccasion.capacity || 0
      const remainingCapacity = capacity - currentGuestCount
      
      if (input.ticketQuantity > remainingCapacity) {
        return json({ 
          success: false, 
          error: `Cannot add ${input.ticketQuantity} guests. Only ${remainingCapacity} spots remaining (capacity: ${capacity})` 
        }, 200)
      }
      
      console.log(`Capacity check passed: ${input.ticketQuantity} guests, ${remainingCapacity} spots remaining`)
    } else if (input.groupToken) {
      // Guest purchase: validate the group token
      const parentBooking = await fetchParentBookingByShareToken(input.groupToken, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      if (!parentBooking) {
        return json({ success: false, error: 'Invalid or expired group link' }, 200)
      }
      parentBookingId = parentBooking.id
      // Use the parent booking's date and venue (guest cannot change these)
      effectiveBookingDate = parentBooking.booking_date
      effectiveVenue = parentBooking.venue
      console.log(`Guest purchase linked to parent booking ${parentBookingId}`)
    } else {
      // Organiser purchase: need a booking date, generate share token
      if (!input.bookingDate) return json({ success: false, error: 'Missing booking date' }, 200)
      shareToken = generateShareToken()
      console.log(`Organiser purchase with share token ${shareToken}`)
    }

    // Calculate pricing
    const TICKET_PRICE_CENTS = 1000 // $10 per ticket
    const totalCents = input.ticketQuantity * TICKET_PRICE_CENTS

    // Generate idempotency key
    const rawIdKey = `ticket:${input.customerEmail || input.customerPhone}:${effectiveBookingDate}:${input.ticketQuantity}:${Date.now()}`
    const idempotencyKey = await toIdempotencyKey(rawIdKey)

    // Charge with Square
    const { paymentId } = await chargeSquare({
      amountCents: totalCents,
      token: input.paymentToken,
      idempotencyKey,
      locationId: SQUARE_LOCATION_ID,
      accessToken: SQUARE_ACCESS_TOKEN
    })

    // Generate guest list token before creating booking
    const tempId = crypto.randomUUID()
    const guestListToken = await generateGuestListToken(tempId, effectiveBookingDate)

    // Create ticket booking row
    const booking = await createTicketBooking({
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      venue: effectiveVenue,
      bookingDate: effectiveBookingDate,
      ticketQuantity: input.ticketQuantity,
      ticketType: input.ticketType,
      ticketPriceCents: TICKET_PRICE_CENTS,
      totalAmount: totalCents / 100,
      squarePaymentId: paymentId,
      guestListToken,
      shareToken,
      parentBookingId,
    }, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Update the guest list token with the actual booking ID
    const actualGuestListToken = await generateGuestListToken(booking.bookingId, effectiveBookingDate)
    
    // Update the booking with the correct token
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking.bookingId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guest_list_token: actualGuestListToken })
    })

    // Insert purchaser as guest in booking_guests
    // For organiser: is_organiser = true; for guest purchases: is_organiser = false
    const isOrganiser = !parentBookingId
    await insertGuestAsBookingGuest(booking.bookingId, input.customerName, isOrganiser, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Send confirmation email (fire and forget)
    sendConfirmationEmail({
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      referenceCode: booking.referenceCode,
      venue: effectiveVenue,
      bookingDate: effectiveBookingDate,
      ticketQuantity: input.ticketQuantity,
      guestListToken: actualGuestListToken,
      shareToken: booking.shareToken,
    }, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const result: Record<string, unknown> = {
      success: true,
      bookingId: booking.bookingId,
      referenceCode: booking.referenceCode,
      paymentId,
      guestListToken: actualGuestListToken,
    }
    
    // Include share token and URL for organiser purchases
    // Use the origin from the request to build the URL
    if (booking.shareToken) {
      result.shareToken = booking.shareToken
      result.shareUrl = `${origin}/tickets/${booking.shareToken}`
    }

    console.log('Returning ticket booking result:', result)
    return json(result)
  } catch (err) {
    console.error('ticket-pay-and-book error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return json({ success: false, error: message }, 200)
  }
})

