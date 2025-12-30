// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types are not available in this toolchain
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
// Minimal declaration for Deno global used for env access in Edge Functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-api-key, x-client-info",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// Generate a user-friendly reference code
function generateReferenceCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const shortId = Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
  const year = new Date().getFullYear().toString().slice(-2)
  return `OCC-${year}-${shortId}`
}

// Generate guest list token (HMAC-based)
function generateGuestListToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const SQUARE_ACCESS_TOKEN = Deno.env.get("SQUARE_ACCESS_TOKEN")
    const SQUARE_LOCATION_ID = Deno.env.get("SQUARE_LOCATION_ID")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ success: false, error: "Supabase configuration missing" }, 500)
    }

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      return json({ success: false, error: "Square configuration missing" }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const {
      shareToken,
      customerName,
      customerEmail,
      customerPhone,
      ticketQuantity,
      paymentToken,
    } = body

    // Validation
    if (!shareToken) return json({ success: false, error: "Share token is required" }, 400)
    if (!customerName?.trim()) return json({ success: false, error: "Customer name is required" }, 400)
    if (!customerEmail && !customerPhone) return json({ success: false, error: "Email or phone is required" }, 400)
    if (!ticketQuantity || ticketQuantity <= 0) return json({ success: false, error: "Valid ticket quantity required" }, 400)
    if (!paymentToken) return json({ success: false, error: "Payment token is required" }, 400)

    // 1. Fetch organiser booking by share_token
    const { data: organiserBooking, error: organiserError } = await supabase
      .from('bookings')
      .select('*')
      .eq('share_token', shareToken)
      .eq('booking_type', 'occasion')
      .eq('is_occasion_organiser', true)
      .eq('status', 'confirmed')
      .single()

    if (organiserError || !organiserBooking) {
      return json({ success: false, error: "Invalid or inactive occasion" }, 400)
    }

    // 2. Check capacity
    const { data: childBookings } = await supabase
      .from('bookings')
      .select('ticket_quantity')
      .eq('parent_booking_id', organiserBooking.id)
      .neq('status', 'cancelled')

    const currentTotal = (childBookings || []).reduce((sum: number, b: any) => sum + (b.ticket_quantity || 0), 0)
    const remaining = organiserBooking.capacity - currentTotal

    if (ticketQuantity > remaining) {
      return json({ 
        success: false, 
        error: `Only ${remaining} spots remaining. Requested ${ticketQuantity}.` 
      }, 400)
    }

    // 3. Process Square payment
    const amountCents = organiserBooking.ticket_price_cents * ticketQuantity
    const squarePaymentBody = {
      source_id: paymentToken,
      idempotency_key: crypto.randomUUID(),
      amount_money: {
        amount: amountCents,
        currency: 'AUD',
      },
      location_id: SQUARE_LOCATION_ID,
      autocomplete: true,
    }

    const squareResponse = await fetch('https://connect.squareup.com/v2/payments', {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(squarePaymentBody),
    })

    const squareResult = await squareResponse.json()

    if (!squareResponse.ok || !squareResult.payment) {
      console.error('Square payment failed:', squareResult)
      return json({ 
        success: false, 
        error: squareResult.errors?.[0]?.detail || 'Payment processing failed' 
      }, 400)
    }

    const paymentId = squareResult.payment.id

    // 4. Create child booking
    const referenceCode = generateReferenceCode()
    const guestListToken = generateGuestListToken()

    const bookingData = {
      customer_name: customerName.trim(),
      customer_email: customerEmail?.trim() || null,
      customer_phone: customerPhone?.trim() || null,
      booking_type: 'occasion',
      is_occasion_organiser: false,
      venue: organiserBooking.venue,
      booking_date: organiserBooking.booking_date,
      ticket_quantity: ticketQuantity,
      ticket_price_cents: organiserBooking.ticket_price_cents,
      total_amount: amountCents / 100,
      status: 'confirmed',
      payment_status: 'paid',
      square_payment_id: paymentId,
      payment_completed_at: new Date().toISOString(),
      reference_code: referenceCode,
      guest_list_token: guestListToken,
      parent_booking_id: organiserBooking.id,
      booking_source: 'website_direct',
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single()

    if (bookingError) {
      console.error('Booking creation failed:', bookingError)
      return json({ success: false, error: 'Failed to create booking' }, 500)
    }

    // 5. Create organiser guest entry
    const { error: guestError } = await supabase
      .from('booking_guests')
      .insert({
        booking_id: booking.id,
        guest_name: customerName.trim(),
        is_organiser: true,
      })

    if (guestError) {
      console.warn('Failed to create guest entry:', guestError)
    }

    // 6. Send confirmation email
    try {
      const origin = req.headers.get('origin') || (organiserBooking.venue === 'manor' ? 'https://manorleederville.com' : 'https://hippie-club.com')
      const guestListUrl = `${origin}/guest-list?token=${encodeURIComponent(guestListToken)}`

      await supabase.functions.invoke('send-email', {
        body: {
          template: 'occasion-ticket-confirmation',
          data: {
            customerName,
            customerEmail,
            customerPhone,
            referenceCode,
            occasionName: organiserBooking.occasion_name,
            occasionDate: organiserBooking.booking_date,
            venue: organiserBooking.venue === 'manor' ? 'Manor' : 'Hippie Club',
            ticketQuantity,
            ticketPrice: (organiserBooking.ticket_price_cents / 100).toFixed(2),
            totalAmount: (amountCents / 100).toFixed(2),
            guestListUrl,
            organiserName: organiserBooking.customer_name,
          }
        }
      })
    } catch (e) {
      console.warn('Non-blocking: failed to send confirmation email', e)
    }

    return json({
      success: true,
      bookingId: booking.id,
      referenceCode,
      guestListToken,
      paymentId,
    })

  } catch (err) {
    console.error("occasion-pay-and-book error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return json({ success: false, error: message }, 500)
  }
})
