// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { generateSecureCode, generateGuestListToken as generateGuestListTokenBase } from "../_shared/crypto.ts"
import { chargeSquare, refundSquarePayment, toIdempotencyKey } from "../_shared/square.ts"

// Minimal declaration for Deno global used for env access in Edge Functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

type PayAndBookRequest = {
  holdId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  guestCount?: number
  bookingDate: string
  venue: string
  startTime: string
  endTime: string
  boothId: string
  paymentToken: string
  ticketQuantity?: number
}

type HoldRow = {
  booth_id: string
  venue: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  expires_at: string
}

type JsonBody = Record<string, unknown>

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Fallback allow-list; we will echo request headers dynamically in the OPTIONS handler
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-action, x-api-key",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// Wrapper to get secret from environment
async function generateGuestListToken(bookingId: string, bookingDate: string): Promise<string> {
  const secret = Deno.env.get('GUEST_LIST_SECRET') || 'guest-list-secret'
  return generateGuestListTokenBase(bookingId, bookingDate, secret)
}

function timeToMinutes(timeHHMM: string): number {
  const [h, m] = timeHHMM.slice(0, 5).split(':').map((v) => Number(v) || 0)
  return h * 60 + m
}

async function fetchBoothHourlyRate(boothId: string, supabaseUrl: string, supabaseKey: string): Promise<number> {
  const res = await fetch(`${supabaseUrl}/rest/v1/karaoke_booths?id=eq.${encodeURIComponent(boothId)}&select=hourly_rate`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: 'application/json',
    }
  })
  if (!res.ok) throw new Error(`Failed to fetch booth rate (${res.status})`)
  const rows = await res.json() as Array<{ hourly_rate: number | null }>
  const rate = rows?.[0]?.hourly_rate
  if (!rate || rate <= 0) throw new Error('Invalid booth hourly rate')
  return Number(rate)
}

async function fetchHold(holdId: string, supabaseUrl: string, supabaseKey: string): Promise<HoldRow> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/karaoke_booth_holds?id=eq.${encodeURIComponent(holdId)}&select=booth_id,venue,booking_date,start_time,end_time,status,expires_at`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: 'application/json',
      }
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to fetch hold: ${body || res.status}`)
  }
  const rows = await res.json() as HoldRow[]
  const hold = rows?.[0]
  if (!hold) throw new Error('Hold not found')
  const nowIso = new Date().toISOString()
  if (hold.status !== 'active' || hold.expires_at <= nowIso) {
    throw new Error('Hold expired or inactive')
  }
  return hold
}

async function createKaraokeBooking(payload: Omit<PayAndBookRequest, 'paymentToken'> & { totalAmount: number; squarePaymentId: string; durationHours: number }, supabaseUrl: string, supabaseKey: string) {
  const row: Record<string, unknown> = {
    customer_name: payload.customerName,
    customer_email: payload.customerEmail || null,
    customer_phone: payload.customerPhone || null,
    booking_type: 'karaoke_booking',
    venue: payload.venue,
    booking_date: payload.bookingDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    duration_hours: payload.durationHours,
    guest_count: payload.guestCount ?? null,
    karaoke_booth_id: payload.boothId,
    status: 'confirmed',
    payment_status: 'paid',
    total_amount: payload.totalAmount,
    square_payment_id: payload.squarePaymentId,
    payment_attempted_at: new Date().toISOString(),
    payment_completed_at: new Date().toISOString(),
    booking_source: 'website_direct',
    reference_code: generateReferenceCode()
  }
  console.log('Creating booking with row:', row)
  const res = await fetch(`${supabaseUrl}/rest/v1/bookings?select=id,reference_code`, {
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
  type BookingResp = { id?: string; reference_code?: string }
  const asObj: BookingResp | BookingResp[] = body as BookingResp | BookingResp[]
  const first: BookingResp | undefined = Array.isArray(asObj) ? asObj[0] : asObj
  console.log('First booking response:', first)
  const id = first?.id
  const reference = first?.reference_code || ''
  console.log('Extracted id:', id, 'reference:', reference)
  if (!id) throw new Error('Missing booking id')
  return { bookingId: String(id), referenceCode: String(reference || '') }
}

async function insertOrganiserAsGuest(bookingId: string, organiserName: string, supabaseUrl: string, supabaseKey: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/booking_guests`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      booking_id: bookingId,
      guest_name: organiserName,
      is_organiser: true
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Failed to insert organiser as guest:', body)
    // Non-fatal: log but don't throw - the booking is already created
  }
}

async function createTicketBookingRow(payload: { customerName: string; customerEmail?: string; customerPhone?: string; venue: string; bookingDate: string; ticketQuantity: number; totalAmount: number; squarePaymentId: string }, supabaseUrl: string, supabaseKey: string) {
  const row: Record<string, unknown> = {
    customer_name: payload.customerName,
    customer_email: payload.customerEmail || null,
    customer_phone: payload.customerPhone || null,
    booking_type: 'vip_tickets',
    venue: payload.venue,
    booking_date: payload.bookingDate,
    ticket_quantity: payload.ticketQuantity,
    status: 'confirmed',
    payment_status: 'paid',
    total_amount: payload.totalAmount,
    // Omit square_payment_id due to unique constraint on bookings.square_payment_id
    // Preserve for audit in staff_notes; adjust schema later if needed
    staff_notes: `square_payment_id=${payload.squarePaymentId}`,
    payment_attempted_at: new Date().toISOString(),
    payment_completed_at: new Date().toISOString(),
    booking_source: 'website_direct',
    reference_code: generateReferenceCode()
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/bookings?select=id,reference_code`, {
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
  if (!res.ok) {
    const message = body?.message || JSON.stringify(body)
    throw new Error(`Failed to create ticket booking: ${message}`)
  }
  type BookingResp = { id?: string; reference_code?: string }
  const asObj: BookingResp | BookingResp[] = body as BookingResp | BookingResp[]
  const first: BookingResp | undefined = Array.isArray(asObj) ? asObj[0] : asObj
  const id = first?.id
  const reference = first?.reference_code || ''
  if (!id) throw new Error('Missing ticket booking id')
  return { bookingId: String(id), referenceCode: String(reference || '') }
}

function generateReferenceCode(): string {
  return `K-${generateSecureCode(6)}`
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
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ success: false, error: 'Supabase env not configured' }, 500)
    if (!SQUARE_ACCESS_TOKEN) return json({ success: false, error: 'Square access token not configured' }, 500)
    if (!SQUARE_LOCATION_ID) return json({ success: false, error: 'Square location ID not configured' }, 500)

    const body = (await req.json()) as JsonBody
    const input: PayAndBookRequest = {
      holdId: String(body.holdId || ''),
      customerName: String(body.customerName || ''),
      customerEmail: body.customerEmail ? String(body.customerEmail) : undefined,
      customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
      guestCount: body.guestCount != null ? Number(body.guestCount) : undefined,
      bookingDate: String(body.bookingDate || ''),
      venue: String(body.venue || 'manor'),
      startTime: String(body.startTime || ''),
      endTime: String(body.endTime || ''),
      boothId: String(body.boothId || ''),
      paymentToken: String(body.paymentToken || ''),
      ticketQuantity: body.ticketQuantity != null ? Number(body.ticketQuantity) : undefined,
    }

    if (!input.holdId) return json({ success: false, error: 'Missing holdId' }, 400)
    if (!input.boothId) return json({ success: false, error: 'Missing boothId' }, 400)
    if (!input.paymentToken) return json({ success: false, error: 'Missing payment token' }, 400)

    // Resolve hold details so we trust server-side times and booth rather than client input
    const hold = await fetchHold(input.holdId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Use hold's booth/date/times as the source of truth
    input.boothId = String(hold.booth_id)
    input.bookingDate = String(hold.booking_date)
    input.venue = String(hold.venue || input.venue || 'manor')
    input.startTime = String(hold.start_time).slice(0, 5)
    input.endTime = String(hold.end_time).slice(0, 5)

    // Fetch booth hourly rate
    const hourlyRate = await fetchBoothHourlyRate(input.boothId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Derive duration from start/end time (in hours) and enforce max 2-hour rule
    const startMinutes = timeToMinutes(input.startTime)
    const endMinutes = timeToMinutes(input.endTime)
    // Handle overnight bookings (e.g. 23:00-00:00): if end <= start, add 24 hours
    const durationMinutes = endMinutes <= startMinutes
      ? (24 * 60 - startMinutes) + endMinutes
      : endMinutes - startMinutes
    if (!durationMinutes || durationMinutes < 0) return json({ success: false, error: 'Invalid session time range' }, 400)
    const durationHours = durationMinutes / 60
    if (durationHours > 2) {
      return json({ success: false, error: 'Maximum session length is 2 hours' }, 400)
    }

    const boothCents = Math.round(Number(hourlyRate) * durationHours * 100)
    const ticketQty = Math.max(0, Number(input.ticketQuantity || input.guestCount || 0))
    const TICKET_PRICE_CENTS = 1000 // $10 per ticket
    const ticketsCents = ticketQty * TICKET_PRICE_CENTS
    const totalCents = boothCents + ticketsCents

    // Idempotency key based on hold + booth + date/time (hashed to <=45 chars)
    const rawIdKey = `${input.holdId}:${input.boothId}:${input.bookingDate}:${input.startTime}-${input.endTime}:t${ticketQty}`
    const idempotencyKey = await toIdempotencyKey(rawIdKey)

    // Charge with Square directly (no order creation)
    const { paymentId } = await chargeSquare({ amountCents: totalCents, token: input.paymentToken, idempotencyKey, locationId: SQUARE_LOCATION_ID, accessToken: SQUARE_ACCESS_TOKEN })

    // Wrap booking creation in try-catch to trigger refund on failure
    let booking: { bookingId: string; referenceCode: string }
    let ticketBooking: { bookingId: string; referenceCode: string } | null = null
    let guestListToken: string

    try {
      // Create karaoke booking row (confirmed/paid) with booth amount only
      booking = await createKaraokeBooking({
        ...input,
        totalAmount: boothCents / 100,
        squarePaymentId: paymentId,
        durationHours,
      }, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Insert organiser as the first guest entry (with is_organiser = true)
      await insertOrganiserAsGuest(booking.bookingId, input.customerName, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Generate a signed guest list token for this karaoke booking
      guestListToken = await generateGuestListToken(booking.bookingId, input.bookingDate)

      // Create separate vip_tickets booking row (confirmed/paid)
      if (ticketQty > 0) {
        ticketBooking = await createTicketBookingRow({
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          venue: input.venue,
          bookingDate: input.bookingDate,
          ticketQuantity: ticketQty,
          totalAmount: ticketsCents / 100,
          squarePaymentId: paymentId
        }, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      }
    } catch (bookingError) {
      // Booking creation failed - refund the payment
      console.error('Booking creation failed, initiating refund:', bookingError)
      try {
        await refundSquarePayment({
          paymentId,
          amountCents: totalCents,
          accessToken: SQUARE_ACCESS_TOKEN,
          reason: 'Booking creation failed - automatic refund'
        })
        const errorMsg = bookingError instanceof Error ? bookingError.message : String(bookingError)
        throw new Error(`Booking failed and payment was refunded: ${errorMsg}`)
      } catch (refundError) {
        // Refund also failed - this is critical, log and surface both errors
        const bookingMsg = bookingError instanceof Error ? bookingError.message : String(bookingError)
        const refundMsg = refundError instanceof Error ? refundError.message : String(refundError)
        console.error('CRITICAL: Booking failed and refund also failed:', { paymentId, bookingError: bookingMsg, refundError: refundMsg })
        throw new Error(`Booking failed (${bookingMsg}). Refund attempt also failed (${refundMsg}). Please contact support with payment ID: ${paymentId}`)
      }
    }

    const result = {
      success: true,
      bookingId: booking.bookingId,
      referenceCode: booking.referenceCode,
      paymentId,
      karaokeBooking: {
        id: booking.bookingId,
        referenceCode: booking.referenceCode
      },
      ticketBooking: ticketBooking ? {
        id: ticketBooking.bookingId,
        referenceCode: ticketBooking.referenceCode
      } : null,
      guestListToken,
    }

    console.log('Returning booking result:', result)
    return json(result)
  } catch (err) {
    console.error('karaoke-pay-and-book error:', err)
    const message = err instanceof Error ? err.message : String(err)
    // Determine appropriate status code based on error type
    const isClientError = message.includes('Hold expired') ||
                          message.includes('Hold not found') ||
                          message.includes('Invalid') ||
                          message.includes('Missing')
    const status = isClientError ? 400 : 500
    return json({ success: false, error: message }, status)
  }
})



