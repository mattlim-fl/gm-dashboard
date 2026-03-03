// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1"
import { getResendCredentials } from "../_shared/credentials.ts"
import { config } from "../_shared/config.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-api-key, x-client-info, x-action",
}


type TemplatePayload = {
  template?: string
  data?: Record<string, unknown>
  to?: string
  subject?: string
  from?: string
  replyTo?: string
  // legacy support
  emailData?: Record<string, unknown>
  html?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function get(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, data)
}

function formatDateAU(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(String(iso))
    return d.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return String(iso)
  }
}

function getGuestListBaseUrl(overrideOrigin?: string | null): string {
  // Allow caller to override (e.g. for local dev)
  if (overrideOrigin && typeof overrideOrigin === 'string' && overrideOrigin.trim()) {
    return overrideOrigin.trim().replace(/\/$/, '')
  }
  const fromEnv =
    (Deno?.env?.get?.('GUEST_LIST_BASE_URL') as string | undefined) ||
    (Deno?.env?.get?.('MANOR_FRONTEND_URL') as string | undefined) ||
    ''
  const trimmed = (fromEnv || '').trim()
  if (!trimmed) return 'https://manorleederville.com'
  return trimmed.replace(/\/$/, '')
}

function generateGuestListLinkFromToken(token?: string | null, overrideOrigin?: string | null): string | null {
  if (!token) return null
  const base = getGuestListBaseUrl(overrideOrigin)
  return `${base}/guest-list?token=${encodeURIComponent(String(token))}`
}

function renderVenueConfirmationHTML(data: Record<string, unknown>): string {
  const venue = String(get(data, 'venue') ?? 'manor')
  const venueDisplayName = venue === 'manor' ? 'Manor' : 'Hippie'
  const area = String(get(data, 'venueArea') ?? '')
  const areaName = String(get(data, 'venueAreaName') ?? '')
  const areaDisplayName = areaName || (area === 'downstairs' ? 'Downstairs' : area === 'upstairs' ? 'Upstairs' : (area || 'Full Venue'))
  const bookingDate = formatDateAU(String(get(data, 'bookingDate') ?? ''))
  const startTime = String(get(data, 'startTime') ?? '')
  const endTime = String(get(data, 'endTime') ?? '')
  const guestCount = String(get(data, 'guestCount') ?? '')
  const customerName = String(get(data, 'customerName') ?? '')
  const referenceCode = String(get(data, 'referenceCode') ?? '')
  const customerEmail = String(get(data, 'customerEmail') ?? '')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - Manor Perth</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #8B4513; margin-bottom: 10px; }
        .reference-code { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 2px solid #dee2e6; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }
        .reference-code-label { font-size: 14px; font-weight: 600; color: #6c757d; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .reference-code-value { font-size: 24px; font-weight: bold; font-family: 'Courier New', monospace; color: #495057; letter-spacing: 2px; }
        .booking-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e9ecef; }
        .detail-row:last-child { border-bottom: none; margin-bottom: 0; }
        .detail-label { font-weight: 600; color: #495057; }
        .detail-value { color: #6c757d; }
        .message { background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; }
        .contact-info { margin-top: 15px; }
        .contact-info a { color: #007bff; text-decoration: none; }
        .contact-info a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">MANOR</div>
          <h1 style="margin: 0; color: #333; font-size: 24px;">Booking Enquiry Received</h1>
        </div>

        <p>Hi ${customerName},</p>

        <p>Thank you for your venue booking enquiry with Manor Perth! We've received your request and our team will review it within the next two business days.</p>

        <div class="reference-code">
          <div class="reference-code-label">Reference Code</div>
          <div class="reference-code-value">${referenceCode}</div>
        </div>

        <div class="booking-details">
          <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
          <div class="detail-row"><span class="detail-label">Venue:</span><span class="detail-value">${venueDisplayName}</span></div>
          <div class="detail-row"><span class="detail-label">Area:</span><span class="detail-value">${areaDisplayName}</span></div>
          <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${bookingDate}</span></div>
          <div class="detail-row"><span class="detail-label">Time:</span><span class="detail-value">${startTime} - ${endTime}</span></div>
          <div class="detail-row"><span class="detail-label">Guests:</span><span class="detail-value">${guestCount} people</span></div>
        </div>

        <div class="message">
          <strong>What happens next?</strong><br>
          Our team will review your enquiry and get in touch within the next two business days to discuss availability, pricing, and confirm your booking details.
        </div>

        <p>Please keep your reference code handy for any future correspondence about this booking.</p>

        <div class="footer">
          <p><strong>Manor Perth</strong></p>
          <div class="contact-info">
            <p>📍 123 Murray Street, Perth WA 6000</p>
            <p>📧 <a href="mailto:bookings@manorperth.com.au">bookings@manorperth.com.au</a></p>
            <p>📞 <a href="tel:+61812345678">(08) 1234 5678</a></p>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
            This email was sent to ${customerEmail} in response to your booking enquiry.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

function renderKaraokeConfirmationHTML(data: Record<string, unknown>): string {
  const customerName = String(get(data, 'customerName') ?? '')
  const customerEmail = String(get(data, 'customerEmail') ?? '')
  const referenceCode = String(get(data, 'referenceCode') ?? '')
  const bookingDate = String(get(data, 'bookingDate') ?? '')
  const startTime = String(get(data, 'startTime') ?? '')
  const endTime = String(get(data, 'endTime') ?? '')
  const guestCount = String(get(data, 'guestCount') ?? '')
  const boothName = String(get(data, 'boothName') ?? '')
  const guestListUrl = String(get(data, 'guestListUrl') ?? '') || ''

  // Venue-specific values (case-insensitive comparison)
  const venue = String(get(data, 'venue') ?? 'manor').toLowerCase()
  const venueDisplayName = venue === 'manor' ? 'Manor' : 'Hippie Club'
  const instagramHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth'
  const facebookHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth'

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Karaoke Booking Confirmation - ${venueDisplayName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1);">

        <!-- Subtle header -->
        <div style="text-align: center; color: #6c757d; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;">
          ${venueDisplayName} Karaoke
        </div>

        <!-- Single confirmation message -->
        <h1 style="margin: 0 0 8px 0; color: #333; font-size: 24px; font-weight: 600; text-align: center;">
          You're all set, ${customerName}!
        </h1>
        <p style="text-align: center; color: #495057; font-size: 16px; margin: 0 0 32px 0;">
          Your karaoke booth is confirmed for ${bookingDate}.
        </p>

        <!-- Primary CTA: Add Guest Names -->
        ${guestListUrl ? `
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; color: white; font-size: 18px; font-weight: 600;">
            Who's joining you?
          </p>
          <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            Add your guests now so they're on the door list when they arrive.
          </p>
          <a href="${guestListUrl}" style="display: inline-block; background: white; color: #ee5a24; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
            Add Guest Names
          </a>
        </div>
        ` : ''}

        <!-- Booking Details -->
        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Date</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${bookingDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Time</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${startTime} - ${endTime}</td>
            </tr>
            ${boothName ? `
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Booth</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${boothName}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Guests</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">Up to ${guestCount} people</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6c757d; font-size: 13px;">Reference</td>
              <td style="padding: 10px 0; color: #6c757d; font-size: 13px; text-align: right; font-family: 'Courier New', monospace;">${referenceCode}</td>
            </tr>
          </table>
        </div>

        <!-- On the day instructions -->
        <div style="margin: 0 0 32px 0;">
          <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">
            On the day
          </h3>
          <div style="background: #fff8e6; border-radius: 8px; padding: 20px; border-left: 4px solid #ffc107;">
            <p style="margin: 0 0 12px 0; color: #495057;">
              <strong>1.</strong> Arrive 10 minutes before your booking time
            </p>
            <p style="margin: 0 0 12px 0; color: #495057;">
              <strong>2.</strong> Head to the bar upstairs at ${venueDisplayName} to check in
            </p>
            <p style="margin: 0; color: #495057;">
              <strong>3.</strong> Collect your wristbands and you're ready to sing!
            </p>
          </div>
        </div>

        <!-- Tip about guest list entries -->
        <p style="color: #6c757d; font-size: 14px; margin: 0 0 32px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <strong>Tip:</strong> If you purchased guest list entries, they'll arrive by email the day before. Don't want to queue? Message us on Instagram.
        </p>

        <!-- Friendly sign-off -->
        <div style="text-align: center; margin: 0 0 32px 0;">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px 0;">
            See you soon! 🎤
          </p>
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            The ${venueDisplayName} Team
          </p>
        </div>

        <!-- Footer with linked socials -->
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0 0 12px 0;">
            <a href="https://instagram.com/${instagramHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
              Instagram
            </a>
            <span style="color: #dee2e6;">|</span>
            <a href="https://facebook.com/${facebookHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
              Facebook
            </a>
          </p>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #adb5bd;">
            This confirmation was sent to ${customerEmail}
          </p>
        </div>
      </div>
    </body>
  </html>`
}

function renderTicketConfirmationHTML(data: Record<string, unknown>): string {
  const customerName = String(get(data, 'customerName') ?? '')
  const customerEmail = String(get(data, 'customerEmail') ?? '')
  const referenceCode = String(get(data, 'referenceCode') ?? '')
  const bookingDate = String(get(data, 'bookingDate') ?? '')
  const ticketQuantity = String(get(data, 'ticketQuantity') ?? '1')
  const guestListUrl = String(get(data, 'guestListUrl') ?? '') || ''
  const occasionName = String(get(data, 'occasionName') ?? '')

  // Venue-specific values (case-insensitive comparison)
  const venue = String(get(data, 'venue') ?? 'manor').toLowerCase()
  const venueDisplayName = venue === 'manor' ? 'Manor' : 'Hippie Club'
  const instagramHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth'
  const facebookHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth'

  const ticketLabel = Number(ticketQuantity) === 1 ? 'ticket' : 'tickets'

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Ticket Confirmation - ${venueDisplayName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1);">

        <!-- Subtle header -->
        <div style="text-align: center; color: #6c757d; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;">
          ${venueDisplayName}
        </div>

        <!-- Single confirmation message -->
        <h1 style="margin: 0 0 8px 0; color: #333; font-size: 24px; font-weight: 600; text-align: center;">
          You're on the list, ${customerName}!
        </h1>
        <p style="text-align: center; color: #495057; font-size: 16px; margin: 0 0 32px 0;">
          Your ${ticketQuantity} ${ticketLabel} ${Number(ticketQuantity) === 1 ? 'is' : 'are'} confirmed for ${bookingDate}.
        </p>

        <!-- Primary CTA: Add Guest Names -->
        ${guestListUrl ? `
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; color: white; font-size: 18px; font-weight: 600;">
            Who's coming with you?
          </p>
          <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            Add your guest names now so they're on the door list when they arrive.
          </p>
          <a href="${guestListUrl}" style="display: inline-block; background: white; color: #ee5a24; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
            Add Guest Names
          </a>
        </div>
        ` : ''}

        <!-- Booking Details -->
        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            ${occasionName ? `
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Event</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${occasionName}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Date</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${bookingDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Tickets</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${ticketQuantity}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6c757d; font-size: 13px;">Reference</td>
              <td style="padding: 10px 0; color: #6c757d; font-size: 13px; text-align: right; font-family: 'Courier New', monospace;">${referenceCode}</td>
            </tr>
          </table>
        </div>

        <!-- On the day instructions -->
        <div style="margin: 0 0 32px 0;">
          <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">
            On the night
          </h3>
          <div style="background: #fff8e6; border-radius: 8px; padding: 20px; border-left: 4px solid #ffc107;">
            <p style="margin: 0 0 12px 0; color: #495057;">
              <strong>1.</strong> Head to ${venueDisplayName} on the night of your event
            </p>
            <p style="margin: 0 0 12px 0; color: #495057;">
              <strong>2.</strong> Give your name at the door - you're on the guest list!
            </p>
            <p style="margin: 0; color: #495057;">
              <strong>3.</strong> Enjoy your night!
            </p>
          </div>
        </div>

        <!-- Tip -->
        <p style="color: #6c757d; font-size: 14px; margin: 0 0 32px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <strong>Tip:</strong> Make sure all your guests are added to the list before the event. They'll need to give their name at the door.
        </p>

        <!-- Friendly sign-off -->
        <div style="text-align: center; margin: 0 0 32px 0;">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px 0;">
            See you there! 🎉
          </p>
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            The ${venueDisplayName} Team
          </p>
        </div>

        <!-- Footer with linked socials -->
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0 0 12px 0;">
            <a href="https://instagram.com/${instagramHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
              Instagram
            </a>
            <span style="color: #dee2e6;">|</span>
            <a href="https://facebook.com/${facebookHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
              Facebook
            </a>
          </p>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #adb5bd;">
            This confirmation was sent to ${customerEmail}
          </p>
        </div>
      </div>
    </body>
  </html>`
}

function renderVenueInternalNotificationHTML(data: Record<string, unknown>): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <h2>New Venue Hire Enquiry</h2>
    <p><strong>Name:</strong> ${String(get(data, 'customerName') ?? '')}</p>
    <p><strong>Email:</strong> ${String(get(data, 'customerEmail') ?? '')}</p>
    <p><strong>Phone:</strong> ${String(get(data, 'customerPhone') ?? '')}</p>
    <p><strong>Reference:</strong> ${String(get(data, 'referenceCode') ?? '')}</p>
    <p><strong>Venue:</strong> ${String(get(data, 'venue') ?? '')}</p>
    <p><strong>Area:</strong> ${String(get(data, 'venueArea') ?? '')}</p>
    <p><strong>Date:</strong> ${formatDateAU(String(get(data, 'bookingDate') ?? ''))}</p>
    <p><strong>Time:</strong> ${String(get(data, 'startTime') ?? '')} - ${String(get(data, 'endTime') ?? '')}</p>
    <p><strong>Guests:</strong> ${String(get(data, 'guestCount') ?? '')}</p>
    ${get(data, 'specialRequests') ? `<p><strong>Special Requests:</strong> ${String(get(data, 'specialRequests'))}</p>` : ''}
  </body></html>`
}

function renderOccasionOrganiserConfirmationHTML(data: Record<string, unknown>): string {
  const organiserName = String(get(data, 'organiserName') ?? '')
  const organiserEmail = String(get(data, 'organiserEmail') ?? '')
  const occasionName = String(get(data, 'occasionName') ?? '')
  const occasionDate = formatDateAU(String(get(data, 'occasionDate') ?? ''))
  const venue = String(get(data, 'venue') ?? 'Manor')
  const capacity = String(get(data, 'capacity') ?? '')
  const organiserUrl = String(get(data, 'organiserUrl') ?? '')
  const ticketPrice = String(get(data, 'ticketPrice') ?? '')
  const shareUrl = String(get(data, 'shareUrl') ?? '')

  const instagramHandle = venue.toLowerCase() === 'manor' ? 'manorleederville' : 'hipeclubperth'
  const facebookHandle = venue.toLowerCase() === 'manor' ? 'manorleederville' : 'hipeclubperth'

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your Occasion is Confirmed - ${venue}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1);">

        <!-- Subtle header -->
        <div style="text-align: center; color: #6c757d; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;">
          ${venue}
        </div>

        <!-- Confirmation message -->
        <h1 style="margin: 0 0 8px 0; color: #333; font-size: 24px; font-weight: 600; text-align: center;">
          Your occasion is confirmed!
        </h1>
        <p style="text-align: center; color: #495057; font-size: 16px; margin: 0 0 32px 0;">
          Hi ${organiserName}, everything is set for <strong>${occasionName}</strong>.
        </p>

        <!-- Primary CTA: Manage Occasion -->
        <div style="background: linear-gradient(135deg, #E59D50 0%, #d4873a 100%); border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; color: white; font-size: 18px; font-weight: 600;">
            Manage your occasion
          </p>
          <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            View your guest list, share with friends, and manage your event.
          </p>
          <a href="${organiserUrl}" style="display: inline-block; background: white; color: #d4873a; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
            Open Organiser Dashboard
          </a>
        </div>

        <!-- Occasion Details -->
        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Event</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${occasionName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Date</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${occasionDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Venue</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${venue}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Capacity</td>
              <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${capacity} guests</td>
            </tr>
            ${ticketPrice ? `
            <tr>
              <td style="padding: 10px 0; color: #495057; font-weight: 600;">Ticket Price</td>
              <td style="padding: 10px 0; color: #333; text-align: right;">${ticketPrice}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- What's next instructions -->
        <div style="margin: 0 0 32px 0;">
          <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">
            What's next?
          </h3>
          <div style="background: #fff8e6; border-radius: 8px; padding: 20px; border-left: 4px solid #ffc107;">
            <p style="margin: 0 0 12px 0; color: #495057;">
              <strong>1.</strong> Share the invite link with your friends so they can purchase tickets
            </p>
            <p style="margin: 0 0 12px 0; color: #495057;">
              <strong>2.</strong> Keep track of RSVPs from your organiser dashboard
            </p>
            <p style="margin: 0; color: #495057;">
              <strong>3.</strong> Add guest names to the door list before your event
            </p>
          </div>
        </div>

        <!-- Important note -->
        <p style="color: #6c757d; font-size: 14px; margin: 0 0 32px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <strong>Important:</strong> Save this email! Your organiser link is unique and gives you access to manage your occasion.
        </p>

        <!-- Friendly sign-off -->
        <div style="text-align: center; margin: 0 0 32px 0;">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px 0;">
            Can't wait to see you! 🎉
          </p>
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            The ${venue} Team
          </p>
        </div>

        <!-- Footer with linked socials -->
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0 0 12px 0;">
            <a href="https://instagram.com/${instagramHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
              Instagram
            </a>
            <span style="color: #dee2e6;">|</span>
            <a href="https://facebook.com/${facebookHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
              Facebook
            </a>
          </p>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #adb5bd;">
            This confirmation was sent to ${organiserEmail}
          </p>
        </div>
      </div>
    </body>
  </html>`
}

function renderStaffInviteHTML(data: Record<string, unknown>): string {
  const inviteEmail = String(get(data, 'inviteEmail') ?? '')
  const inviteUrl = String(get(data, 'inviteUrl') ?? '')
  const invitedBy = String(get(data, 'invitedBy') ?? '')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're invited to GM Staff Portal</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px; background-color: #1e293b; border-radius: 16px;">
              <tr>
                <td style="padding: 40px 32px; text-align: center;">
                  <!-- Logo -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom: 24px;">
                    <tr>
                      <td style="width: 48px; height: 48px; background-color: #fb923c; border-radius: 12px; text-align: center; vertical-align: middle;">
                        <span style="color: #ffffff; font-size: 18px; font-weight: 700; line-height: 48px;">GM</span>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Title -->
                  <h1 style="margin: 0 0 32px 0; color: #f1f5f9; font-size: 24px; font-weight: 600; line-height: 1.3;">
                    You're invited to the<br>GM Staff Portal
                  </h1>
                  
                  <!-- Content Card -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; border-radius: 12px; border: 1px solid #334155;">
                    <tr>
                      <td style="padding: 24px;">
                        <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 15px; line-height: 1.6; text-align: left;">
                          Hi there,
                        </p>
                        <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px; line-height: 1.6; text-align: left;">
                          ${invitedBy ? `<strong style="color: #e2e8f0;">${invitedBy}</strong> has` : 'You have'} invited you to access the GM Staff Portal. This is where your team manages bookings, operations, and reporting.
                        </p>
                        <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6; text-align: left;">
                          Click the button below to create your account and set a password.
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
                          <tr>
                            <td style="background: linear-gradient(135deg, #fb923c 0%, #f97316 100%); border-radius: 8px;">
                              <a href="${inviteUrl || '#'}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">
                                Create your account
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Footer -->
                  <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                    If you did not expect this email, you can safely ignore it.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const SUPABASE_URL = config.supabaseUrl
    const SUPABASE_SERVICE_ROLE_KEY = config.supabaseServiceKey

    // Auth verification: accept user JWTs, service role key, or internal secret
    const authHeader = req.headers.get("Authorization")
    const internalSecret = req.headers.get("X-Internal-Secret")

    // Check for internal secret (for edge function to edge function calls)
    const isInternalCall = internalSecret === config.credentialsEncryptionKey

    if (!isInternalCall) {
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ success: false, error: "Unauthorized: missing auth token" }, 401)
      }
      const token = authHeader.slice(7)

      // Check if it's the service role key
      const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY

      // If not service role, verify as user JWT
      if (!isServiceRole) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
          return json({ success: false, error: "Unauthorized: invalid token" }, 401)
        }
      }
    }

    // Get Resend credentials from DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    console.log("Fetching Resend credentials...")
    const resendCreds = await getResendCredentials(supabase)
    console.log("Resend credentials found:", resendCreds ? "yes" : "no")
    const RESEND_API_KEY = resendCreds?.apiKey
    if (!RESEND_API_KEY) {
      console.error("No Resend API key configured")
      return json({ success: false, error: "RESEND_API_KEY is not configured" }, 500)
    }
    console.log("Using Resend API key:", RESEND_API_KEY.substring(0, 8) + "...")

    const body = (await req.json()) as TemplatePayload

    // Normalize legacy shape
    const payload: TemplatePayload = {
      template: body.template ?? "venue-confirmation",
      data: body.data ?? body.emailData ?? {},
      to: body.to,
      subject: body.subject,
      from: body.from,
      replyTo: body.replyTo,
      html: body.html,
    }

    // Derive recipient from data.customerEmail / inviteEmail / organiserEmail when not explicitly provided
    if (!payload.to) {
      const customerEmail = get(payload.data || {}, 'customerEmail') as string | undefined
      const inviteEmail = get(payload.data || {}, 'inviteEmail') as string | undefined
      const organiserEmail = get(payload.data || {}, 'organiserEmail') as string | undefined
      const derived = customerEmail || inviteEmail || organiserEmail
      if (derived && typeof derived === 'string' && derived.includes('@')) {
        payload.to = derived
      }
    }

    if (!payload.to) return json({ success: false, error: "Missing recipient email" }, 400)

    const tplName = String(payload.template || '').toLowerCase()
    const subject = payload.subject ?? (
      tplName === 'staff-invite'
        ? "You've been invited to GM Staff Portal"
        : "Booking Confirmation - Manor Perth"
    )
    // Use verified manorleederville.com domain for all emails
    const defaultFrom = tplName === 'staff-invite'
      ? "GM Staff Portal <phil@manorleederville.com>"
      : "Manor Perth <phil@manorleederville.com>"
    const from = payload.from ?? defaultFrom
    const replyTo = payload.replyTo

    // For karaoke-confirmation and ticket emails, ensure we have a guestListUrl derived from token when present
    if ((tplName === 'karaoke-confirmation' || tplName === 'priority-ticket-confirmation') && payload.data) {
      const token = get(payload.data as Record<string, unknown>, 'guestListToken') as string | undefined
      const explicitUrl = get(payload.data as Record<string, unknown>, 'guestListUrl') as string | undefined
      const siteOrigin = get(payload.data as Record<string, unknown>, 'siteOrigin') as string | undefined
      if (!explicitUrl && token) {
        const url = generateGuestListLinkFromToken(token, siteOrigin)
        if (url) {
          payload.data = { ...(payload.data || {}), guestListUrl: url }
        }
      }
    }

    // Prepare HTML (inline templates)
    let html = payload.html ?? ""
    if (!html) {
      if (tplName === 'venue-confirmation' || tplName === '' ) {
        html = renderVenueConfirmationHTML(payload.data || {})
      } else if (tplName === 'karaoke-confirmation') {
        html = renderKaraokeConfirmationHTML(payload.data || {})
      } else if (tplName === 'venue-internal-notification') {
        html = renderVenueInternalNotificationHTML(payload.data || {})
      } else if (tplName === 'staff-invite') {
        html = renderStaffInviteHTML(payload.data || {})
      } else if (tplName === 'priority-ticket-confirmation') {
        html = renderTicketConfirmationHTML(payload.data || {})
      } else if (tplName === 'occasion-organiser-confirmation') {
        html = renderOccasionOrganiserConfirmationHTML(payload.data || {})
      }
    }
    if (!html) return json({ success: false, error: "Missing email HTML content" }, 400)

    // Send email
    console.log("Sending email via Resend:", { from, to: payload.to, template: tplName })
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject ?? (
          tplName === 'karaoke-confirmation'
            ? 'Karaoke Booking Confirmation - Manor Perth'
            : tplName === 'priority-ticket-confirmation'
              ? 'Your Tickets are Confirmed!'
              : tplName === 'staff-invite'
                ? "You've been invited to GM Staff Portal"
                : tplName === 'occasion-organiser-confirmation'
                  ? 'Your Occasion is Confirmed!'
                  : 'Booking Confirmation - Manor Perth'
        ),
        html,
        reply_to: replyTo,
      }),
    })

    const result = await res.json()
    console.log("Resend response:", { status: res.status, ok: res.ok, result })
    if (!res.ok) {
      console.error("Resend error:", result)
      return json(
        { success: false, error: result?.error?.message || result?.message || JSON.stringify(result) },
        res.status,
      )
    }

    // Optional: internal notification for venue-confirmation
    let internalStatus: "sent" | "skipped" | "failed" = "skipped"
    if (String(payload.template).toLowerCase() === 'venue-confirmation') {
      try {
        const internalTo = "matt@getproductbox.com"
        const internalHtml = renderVenueInternalNotificationHTML(payload.data || {})
        const internalSubject = `New Venue Enquiry: ${String(get(payload.data || {}, 'customerName') || 'Customer')} (${String(get(payload.data || {}, 'referenceCode') || 'ref')})`
        const res2 = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: internalTo,
            subject: internalSubject,
            html: internalHtml,
            reply_to: replyTo ?? String(get(payload.data || {}, 'customerEmail') || ''),
          }),
        })
        if (!res2.ok) {
          internalStatus = "failed"
        } else {
          internalStatus = "sent"
        }
      } catch {
        internalStatus = "failed"
      }
    }

    return json({ success: true, data: result, internal: internalStatus }, 200)
  } catch (err) {
    console.error("send-email error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return json({ success: false, error: message }, 500)
  }
})



