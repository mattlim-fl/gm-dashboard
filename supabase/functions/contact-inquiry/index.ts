// Contact Inquiry Edge Function
// Handles multi-venue contact form submissions with category-based email routing
// Email recipients are configured in notification_settings table (managed via GM Dashboard)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getResendCredentials } from '../_shared/credentials.ts'
import { config } from '../_shared/config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactInquiryRequest {
  venue: 'manor' | 'hippie' | 'daisys'
  category: 'lost_property' | 'skantech' | 'function_inquiry' | 'business_hours' | 'something_else'
  name: string
  email: string
  phone?: string
  inquiryData: Record<string, unknown>
}

interface NotificationSettings {
  recipient_emails: string[]
  enabled: boolean
}

// Generate unique reference code
function generateReferenceCode(venue: string, category: string): string {
  const prefix = {
    lost_property: 'LP',
    skantech: 'SK',
    function_inquiry: 'FI',
    business_hours: 'BH',
    something_else: 'GI',
  }[category] || 'CI'

  const venueCode = venue.substring(0, 2).toUpperCase()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()

  return `${prefix}-${venueCode}-${timestamp}${random}`
}

// Get venue display name
function getVenueDisplayName(venue: string): string {
  const names: Record<string, string> = {
    manor: 'Manor Perth',
    hippie: 'Hippie Club',
    daisys: "Daisy's Social Club",
  }
  return names[venue] || venue
}

// Get category display name
function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    lost_property: 'Lost Property',
    skantech: 'Scantech Inquiry',
    function_inquiry: 'Function Inquiry',
    business_hours: 'Business Hours',
    something_else: 'General Inquiry',
  }
  return names[category] || category
}

// Map category to notification type suffix
function getCategoryNotificationType(category: string): string {
  const mapping: Record<string, string> = {
    lost_property: 'contact_lost_property',
    skantech: 'contact_scantech',
    business_hours: 'contact_general',
    something_else: 'contact_general',
  }
  return mapping[category] || 'contact_general'
}

// Get email recipients from database
async function getEmailRecipients(
  supabase: ReturnType<typeof createClient>,
  venue: string,
  category: string
): Promise<string[]> {
  const notificationType = `${venue}_${getCategoryNotificationType(category)}`

  const { data, error } = await supabase
    .from('notification_settings')
    .select('recipient_emails, enabled')
    .eq('notification_type', notificationType)
    .single()

  if (error || !data) {
    console.warn(`No notification settings found for ${notificationType}:`, error?.message)
    return []
  }

  if (!data.enabled) {
    console.log(`Notifications disabled for ${notificationType}`)
    return []
  }

  return data.recipient_emails || []
}

// Generate customer confirmation email HTML
function generateCustomerConfirmationHTML(
  venue: string,
  category: string,
  referenceCode: string,
  name: string,
  inquiryData: Record<string, unknown>
): string {
  const venueName = getVenueDisplayName(venue)
  const categoryName = getCategoryDisplayName(category)

  let additionalInfo = ''

  // Category-specific content
  if (category === 'skantech') {
    additionalInfo = `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <strong>What happens next?</strong><br>
        Your inquiry has been logged and will be reviewed by our security team. We aim to respond within 5-7 business days.
        Please note that we take all inquiries seriously and will conduct a thorough review.
      </div>
    `
  } else if (category === 'lost_property') {
    additionalInfo = `
      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <strong>What happens next?</strong><br>
        Our team will check our lost property storage and get back to you within 2-3 business days.
        If your item is found, we'll arrange collection or return.
      </div>
    `
  } else if (category === 'business_hours') {
    additionalInfo = `
      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <strong>Our Hours</strong><br>
        Friday: 9pm - 3am<br>
        Saturday: 9pm - 3am<br>
        <br>
        We're also available for private functions on other days.
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Inquiry Received - ${venueName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #333; font-size: 24px;">${venueName}</h1>
          <p style="color: #6c757d; margin: 10px 0 0;">Inquiry Received</p>
        </div>

        <p>Hi ${name},</p>

        <p>Thank you for contacting ${venueName}. We've received your ${categoryName.toLowerCase()} and our team will review it shortly.</p>

        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 2px solid #dee2e6; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
          <div style="font-size: 14px; font-weight: 600; color: #6c757d; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Reference Code</div>
          <div style="font-size: 24px; font-weight: bold; font-family: 'Courier New', monospace; color: #495057; letter-spacing: 2px;">${referenceCode}</div>
        </div>

        ${additionalInfo}

        <p>Please keep this reference code for your records. If you need to follow up, simply reply to this email with your reference code.</p>

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px;">
          <p><strong>${venueName}</strong></p>
          <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
            This is an automated confirmation email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Generate internal notification email HTML
function generateInternalNotificationHTML(
  venue: string,
  category: string,
  referenceCode: string,
  name: string,
  email: string,
  phone: string | undefined,
  inquiryData: Record<string, unknown>
): string {
  const venueName = getVenueDisplayName(venue)
  const categoryName = getCategoryDisplayName(category)

  // Build inquiry details
  let details = ''
  for (const [key, value] of Object.entries(inquiryData)) {
    if (value) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      details += `<tr><td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: 600;">${label}</td><td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${String(value)}</td></tr>`
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #333;">New ${categoryName}</h2>
        <p style="margin: 5px 0 0; color: #6c757d;">Reference: ${referenceCode} | Venue: ${venueName}</p>
      </div>

      <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Contact Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: 600; width: 120px;">Name</td><td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: 600;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e9ecef;"><a href="mailto:${email}">${email}</a></td></tr>
        ${phone ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: 600;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #e9ecef;"><a href="tel:${phone}">${phone}</a></td></tr>` : ''}
      </table>

      ${details ? `
        <h3 style="color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; margin-top: 30px;">Inquiry Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${details}
        </table>
      ` : ''}

      <div style="margin-top: 30px; padding: 15px; background: #e7f3ff; border-radius: 8px;">
        <p style="margin: 0;"><strong>Reply directly to this email to respond to the customer.</strong></p>
      </div>
    </body>
    </html>
  `
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: ContactInquiryRequest = await req.json()
    const { venue, category, name, email, phone, inquiryData } = body

    // Validate required fields
    if (!venue || !category || !name || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate reference code
    const referenceCode = generateReferenceCode(venue, category)

    // Initialize Supabase client with service role for database access
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)

    // Store inquiry in database
    const { error: dbError } = await supabase
      .from('contact_inquiries')
      .insert({
        venue,
        category,
        reference_code: referenceCode,
        name,
        email,
        phone,
        inquiry_data: inquiryData || {},
        status: 'pending',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save inquiry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend credentials from database
    const resendCreds = await getResendCredentials(supabase)
    let emailsSent = { customer: false, internal: false }

    if (resendCreds?.apiKey) {
      const venueName = getVenueDisplayName(venue)
      const fromEmail = resendCreds.fromEmail || 'phil@manorleederville.com'

      // Get internal recipients from database
      const internalRecipients = await getEmailRecipients(supabase, venue, category)

      // Send customer confirmation
      try {
        const customerRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendCreds.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${venueName} <${fromEmail}>`,
            to: email,
            subject: `Your inquiry has been received - ${referenceCode}`,
            html: generateCustomerConfirmationHTML(venue, category, referenceCode, name, inquiryData || {}),
            reply_to: internalRecipients[0] || fromEmail,
          }),
        })
        if (customerRes.ok) {
          emailsSent.customer = true
        } else {
          const errData = await customerRes.json()
          console.error('Failed to send customer confirmation:', errData)
        }
      } catch (emailError) {
        console.error('Failed to send customer confirmation:', emailError)
      }

      // Send internal notification (only if we have recipients and it's not just showing info)
      const shouldNotifyInternal =
        internalRecipients.length > 0 &&
        (category !== 'business_hours' || inquiryData?.needsFollowUp)

      if (shouldNotifyInternal) {
        try {
          const internalRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendCreds.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${venueName} Contact Form <${fromEmail}>`,
              to: internalRecipients,
              subject: `[${referenceCode}] New ${getCategoryDisplayName(category)} from ${name}`,
              html: generateInternalNotificationHTML(venue, category, referenceCode, name, email, phone, inquiryData || {}),
              reply_to: email,
            }),
          })
          if (internalRes.ok) {
            emailsSent.internal = true
          } else {
            const errData = await internalRes.json()
            console.error('Failed to send internal notification:', errData)
          }
        } catch (emailError) {
          console.error('Failed to send internal notification:', emailError)
        }
      }
    } else {
      console.error('No Resend credentials found - emails will not be sent')
    }

    return new Response(
      JSON.stringify({
        success: true,
        referenceCode,
        emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing contact inquiry:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
