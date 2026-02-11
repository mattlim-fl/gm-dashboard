// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { generateSecureCode, generateGuestListToken as generateGuestListTokenBase } from "../_shared/crypto.ts"
import { chargeSquare, refundSquarePayment, toIdempotencyKey, createSquareOrder } from "../_shared/square.ts"

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

// Wrapper to get secret from environment
async function generateGuestListToken(bookingId: string, bookingDate: string): Promise<string> {
  const secret = Deno.env.get('GUEST_LIST_SECRET') || 'guest-list-secret'
  return generateGuestListTokenBase(bookingId, bookingDate, secret)
}

function generateReferenceCode(): string {
  return `TIX-${generateSecureCode(6)}`
}

function generateShareToken(): string {
  // 8-char alphanumeric (no ambiguous chars: 0/O, 1/I/L)
  return generateSecureCode(8, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789')
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
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ success: false, error: 'Supabase env not configured' }, 500)
    if (!SQUARE_ACCESS_TOKEN) return json({ success: false, error: 'Square access token not configured' }, 500)
    if (!SQUARE_LOCATION_ID) return json({ success: false, error: 'Square location ID not configured' }, 500)

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
    if (!input.customerName.trim()) return json({ success: false, error: 'Missing customer name' }, 400)
    if (!input.customerEmail && !input.customerPhone) return json({ success: false, error: 'Email or phone is required' }, 400)
    if (!input.ticketQuantity || input.ticketQuantity < 1) return json({ success: false, error: 'Invalid ticket quantity' }, 400)
    if (!input.paymentToken) return json({ success: false, error: 'Missing payment token' }, 400)

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
        return json({ success: false, error: 'Occasion not found' }, 404)
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
        }, 400)
      }
      
      console.log(`Capacity check passed: ${input.ticketQuantity} guests, ${remainingCapacity} spots remaining`)
    } else if (input.groupToken) {
      // Guest purchase: validate the group token
      const parentBooking = await fetchParentBookingByShareToken(input.groupToken, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      if (!parentBooking) {
        return json({ success: false, error: 'Invalid or expired group link' }, 400)
      }
      parentBookingId = parentBooking.id
      // Use the parent booking's date and venue (guest cannot change these)
      effectiveBookingDate = parentBooking.booking_date
      effectiveVenue = parentBooking.venue
      console.log(`Guest purchase linked to parent booking ${parentBookingId}`)
    } else {
      // Organiser purchase: need a booking date, generate share token
      if (!input.bookingDate) return json({ success: false, error: 'Missing booking date' }, 400)
      shareToken = generateShareToken()
      console.log(`Organiser purchase with share token ${shareToken}`)
    }

    // Generate idempotency keys
    const timestamp = Date.now()
    const rawIdKey = `ticket:${input.customerEmail || input.customerPhone}:${effectiveBookingDate}:${input.ticketQuantity}:${timestamp}`
    const orderIdempotencyKey = await toIdempotencyKey(`order:${rawIdKey}`)
    const paymentIdempotencyKey = await toIdempotencyKey(`payment:${rawIdKey}`)

    // Pricing and Square catalog item variation IDs
    const TICKET_PRICE_CENTS = 1000 // $10 per ticket
    const HIPPIE_BOOKING_VARIATION_ID = 'FI67PB3JEZZ5C2WQP2QNBEGM'

    // Create Square order first (for attendance tracking)
    const { orderId, totalCents: orderTotalCents } = await createSquareOrder({
      locationId: SQUARE_LOCATION_ID,
      accessToken: SQUARE_ACCESS_TOKEN,
      idempotencyKey: orderIdempotencyKey,
      lineItems: [{
        catalogObjectId: HIPPIE_BOOKING_VARIATION_ID,
        quantity: input.ticketQuantity,
        basePriceCents: TICKET_PRICE_CENTS // Pass our price for variable-price item
      }]
    })

    // Charge with Square (linked to order) - use order total from catalog
    const { paymentId } = await chargeSquare({
      amountCents: orderTotalCents,
      token: input.paymentToken,
      idempotencyKey: paymentIdempotencyKey,
      locationId: SQUARE_LOCATION_ID,
      accessToken: SQUARE_ACCESS_TOKEN,
      orderId
    })

    // Wrap booking creation in try-catch to trigger refund on failure
    let booking: { bookingId: string; referenceCode: string; shareToken: string | null }
    let actualGuestListToken: string

    try {
      // Generate guest list token before creating booking
      const tempId = crypto.randomUUID()
      const guestListToken = await generateGuestListToken(tempId, effectiveBookingDate)

      // Create ticket booking row
      const ticketPriceCents = Math.round(orderTotalCents / input.ticketQuantity)
      booking = await createTicketBooking({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        venue: effectiveVenue,
        bookingDate: effectiveBookingDate,
        ticketQuantity: input.ticketQuantity,
        ticketType: input.ticketType,
        ticketPriceCents,
        totalAmount: orderTotalCents / 100,
        squarePaymentId: paymentId,
        guestListToken,
        shareToken,
        parentBookingId,
      }, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Update the guest list token with the actual booking ID
      actualGuestListToken = await generateGuestListToken(booking.bookingId, effectiveBookingDate)

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
    } catch (bookingError) {
      // Booking creation failed - refund the payment
      console.error('Booking creation failed, initiating refund:', bookingError)
      try {
        await refundSquarePayment({
          paymentId,
          amountCents: orderTotalCents,
          accessToken: SQUARE_ACCESS_TOKEN,
          reason: 'Ticket booking creation failed - automatic refund'
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
    // Determine appropriate status code based on error type
    const isClientError = message.includes('Invalid') ||
                          message.includes('Missing') ||
                          message.includes('expired') ||
                          message.includes('not found')
    const status = isClientError ? 400 : 500
    return json({ success: false, error: message }, status)
  }
})

