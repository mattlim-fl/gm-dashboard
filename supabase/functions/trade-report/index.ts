// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1"

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-api-key, x-client-info",
}

interface WeeklySummaryData {
  period: {
    start: string
    end: string
  }
  saturdayLabels: {
    current: string
    previous: string
    yearAgo: string
  }
  current: {
    barRevenue: number
    doorRevenue: number
    totalRevenue: number
    attendance: number
    spendPerHead: number
  }
  previousWeek: {
    barRevenue: number
    doorRevenue: number
    totalRevenue: number
    attendance: number
    spendPerHead: number
  }
  yearAgo: {
    barRevenue: number
    doorRevenue: number
    totalRevenue: number
    attendance: number
    spendPerHead: number
  }
  changes: {
    barRevenuePercent: number
    doorRevenuePercent: number
    totalRevenuePercent: number
    attendancePercent: number
    barRevenueYoY: number
    doorRevenueYoY: number
    totalRevenueYoY: number
    attendanceYoY: number
  }
}

interface NotificationSettings {
  enabled: boolean
  recipient_emails: string[]
  whatsapp_numbers: string[]
}

// Constants
const NOTIFICATION_TYPE = 'trade_report'
const EMAIL_TEMPLATE = 'trade-report'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

/**
 * Find the Saturday within a 7-day date range and format as "Saturday - dd/mm/yyyy"
 */
function getSaturdayLabel(startDate: Date, endDate: Date): string {
  const current = new Date(startDate)
  while (current <= endDate) {
    if (current.getDay() === 6) { // 6 = Saturday
      const day = current.getDate().toString().padStart(2, '0')
      const month = (current.getMonth() + 1).toString().padStart(2, '0')
      const year = current.getFullYear()
      return `Saturday - ${day}/${month}/${year}`
    }
    current.setDate(current.getDate() + 1)
  }
  // Fallback: use end date
  const d = endDate
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `Saturday - ${day}/${month}/${year}`
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentChange(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0
}

/**
 * Fetch revenue and attendance data for a date range using RPC functions
 */
async function fetchPeriodMetrics(
  supabase: any,
  startDate: Date,
  endDate: Date,
  venueFilter: string | null
): Promise<{
  revenue: number
  barRevenue: number
  doorRevenue: number
  attendance: number
  error?: Error
}> {
  const [
    { data: revenue, error: revenueError },
    { data: barRevenue, error: barError },
    { data: doorRevenue, error: doorError },
    { data: attendance, error: attendanceError }
  ] = await Promise.all([
    supabase.rpc('get_revenue_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: venueFilter
    }),
    supabase.rpc('get_bar_revenue_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: venueFilter
    }),
    supabase.rpc('get_door_revenue_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: venueFilter
    }),
    supabase.rpc('get_attendance_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: venueFilter
    })
  ])

  const error = revenueError || barError || doorError || attendanceError
  if (error) {
    return {
      revenue: 0,
      barRevenue: 0,
      doorRevenue: 0,
      attendance: 0,
      error: new Error(`Failed to fetch period metrics: ${error.message || JSON.stringify(error)}`)
    }
  }

  return {
    revenue: revenue || 0,
    barRevenue: barRevenue || 0,
    doorRevenue: doorRevenue || 0,
    attendance: attendance || 0,
  }
}

/**
 * Calculate date ranges for weekly summary (matching dashboard logic)
 * Returns dates for current week, previous week, and year-over-year comparison
 */
function calculateDateRanges(): {
  currentWeekStart: Date
  currentWeekEnd: Date
  previousWeekStart: Date
  previousWeekEnd: Date
  yearAgoStart: Date
  yearAgoEnd: Date
} {
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  
  // Last 7 days includes today (6 days back + today = 7 days)
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(currentWeekStart.getDate() - 6)
  currentWeekStart.setHours(0, 0, 0, 0)
  
  // Previous week: 7 days before current week start
  const previousWeekStart = new Date(currentWeekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  previousWeekStart.setHours(0, 0, 0, 0)
  
  const previousWeekEnd = new Date(currentWeekStart.getTime() - 1)
  
  // Year-over-year: same date range as current week, one year ago
  const yearAgoStart = new Date(currentWeekStart)
  yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1)
  
  const yearAgoEnd = new Date(now)
  yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1)

  return {
    currentWeekStart,
    currentWeekEnd: now,
    previousWeekStart,
    previousWeekEnd,
    yearAgoStart,
    yearAgoEnd,
  }
}

async function fetchWeeklySummaryData(supabase: any): Promise<WeeklySummaryData> {
  const dateRanges = calculateDateRanges()

  // Use the same RPC functions as the dashboard for consistency
  const venueFilter = null // All venues

  // Fetch all three periods in parallel
  const [currentMetrics, previousMetrics, yearAgoMetrics] = await Promise.all([
    fetchPeriodMetrics(supabase, dateRanges.currentWeekStart, dateRanges.currentWeekEnd, venueFilter),
    fetchPeriodMetrics(supabase, dateRanges.previousWeekStart, dateRanges.previousWeekEnd, venueFilter),
    fetchPeriodMetrics(supabase, dateRanges.yearAgoStart, dateRanges.yearAgoEnd, venueFilter),
  ])

  // Check for errors (consolidated error handling)
  const errors = [
    { period: 'current week', error: currentMetrics.error },
    { period: 'previous week', error: previousMetrics.error },
    { period: 'year ago', error: yearAgoMetrics.error },
  ].filter(e => e.error)

  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.period}: ${e.error?.message}`).join('; ')
    console.error('Error fetching period data:', errorMessages)
    throw errors[0].error || new Error(`Failed to fetch period data: ${errorMessages}`)
  }

  // Calculate spend per head for all periods
  const currentSpendPerHead = currentMetrics.attendance > 0
    ? currentMetrics.revenue / currentMetrics.attendance
    : 0
  const previousSpendPerHead = previousMetrics.attendance > 0
    ? previousMetrics.revenue / previousMetrics.attendance
    : 0
  const yearAgoSpendPerHead = yearAgoMetrics.attendance > 0
    ? yearAgoMetrics.revenue / yearAgoMetrics.attendance
    : 0

  // Calculate Saturday labels for each period
  const saturdayLabels = {
    current: getSaturdayLabel(dateRanges.currentWeekStart, dateRanges.currentWeekEnd),
    previous: getSaturdayLabel(dateRanges.previousWeekStart, dateRanges.previousWeekEnd),
    yearAgo: getSaturdayLabel(dateRanges.yearAgoStart, dateRanges.yearAgoEnd),
  }

  // Calculate percentage changes using helper function
  const barRevenuePercent = calculatePercentChange(currentMetrics.barRevenue, previousMetrics.barRevenue)
  const doorRevenuePercent = calculatePercentChange(currentMetrics.doorRevenue, previousMetrics.doorRevenue)
  const totalRevenuePercent = calculatePercentChange(currentMetrics.revenue, previousMetrics.revenue)
  const attendancePercent = calculatePercentChange(currentMetrics.attendance, previousMetrics.attendance)

  const barRevenueYoY = calculatePercentChange(currentMetrics.barRevenue, yearAgoMetrics.barRevenue)
  const doorRevenueYoY = calculatePercentChange(currentMetrics.doorRevenue, yearAgoMetrics.doorRevenue)
  const totalRevenueYoY = calculatePercentChange(currentMetrics.revenue, yearAgoMetrics.revenue)
  const attendanceYoY = calculatePercentChange(currentMetrics.attendance, yearAgoMetrics.attendance)

  return {
    period: {
      start: formatDate(dateRanges.currentWeekStart),
      end: formatDate(dateRanges.currentWeekEnd),
    },
    saturdayLabels,
    current: {
      barRevenue: currentMetrics.barRevenue,
      doorRevenue: currentMetrics.doorRevenue,
      totalRevenue: currentMetrics.revenue,
      attendance: currentMetrics.attendance,
      spendPerHead: currentSpendPerHead,
    },
    previousWeek: {
      barRevenue: previousMetrics.barRevenue,
      doorRevenue: previousMetrics.doorRevenue,
      totalRevenue: previousMetrics.revenue,
      attendance: previousMetrics.attendance,
      spendPerHead: previousSpendPerHead,
    },
    yearAgo: {
      barRevenue: yearAgoMetrics.barRevenue,
      doorRevenue: yearAgoMetrics.doorRevenue,
      totalRevenue: yearAgoMetrics.revenue,
      attendance: yearAgoMetrics.attendance,
      spendPerHead: yearAgoSpendPerHead,
    },
    changes: {
      barRevenuePercent,
      doorRevenuePercent,
      totalRevenuePercent,
      attendancePercent,
      barRevenueYoY,
      doorRevenueYoY,
      totalRevenueYoY,
      attendanceYoY,
    },
  }
}

function generateWhatsAppMessage(data: WeeklySummaryData): string {
  return `Weekly Trade Report

${data.saturdayLabels.current}
Bar Revenue - ${formatCurrency(data.current.barRevenue)} (ex GST)
Door Revenue - ${formatCurrency(data.current.doorRevenue)} (ex GST)
Total Revenue - ${formatCurrency(data.current.totalRevenue)} (ex GST)
Attendance - ${data.current.attendance.toLocaleString()}
Spend Per Head - ${formatCurrency(data.current.spendPerHead)}

${data.saturdayLabels.previous}
Bar Revenue - ${formatCurrency(data.previousWeek.barRevenue)}
Door Revenue - ${formatCurrency(data.previousWeek.doorRevenue)}
Total Revenue - ${formatCurrency(data.previousWeek.totalRevenue)}
Attendance - ${data.previousWeek.attendance.toLocaleString()}
Spend Per Head - ${formatCurrency(data.previousWeek.spendPerHead)}

${data.saturdayLabels.yearAgo}
Bar Revenue - ${formatCurrency(data.yearAgo.barRevenue)}
Door Revenue - ${formatCurrency(data.yearAgo.doorRevenue)}
Total Revenue - ${formatCurrency(data.yearAgo.totalRevenue)}
Attendance - ${data.yearAgo.attendance.toLocaleString()}
Spend Per Head - ${formatCurrency(data.yearAgo.spendPerHead)}`
}

async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_BUSINESS_API_KEY')
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

  if (!WHATSAPP_API_KEY || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log('WhatsApp credentials not configured - skipping WhatsApp notification')
    return false
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: message,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('WhatsApp API error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return false
  }
}

async function generateAIEmail(data: WeeklySummaryData): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const prompt = `Format the following venue performance data as a clean HTML email table.

Title: "Weekly Trade Report"

Data to display in a table with 3 columns:

Column headers: ${data.saturdayLabels.current} | ${data.saturdayLabels.previous} | ${data.saturdayLabels.yearAgo}

Rows:
- Bar Revenue (ex GST): ${formatCurrency(data.current.barRevenue)} | ${formatCurrency(data.previousWeek.barRevenue)} | ${formatCurrency(data.yearAgo.barRevenue)}
- Door Revenue (ex GST): ${formatCurrency(data.current.doorRevenue)} | ${formatCurrency(data.previousWeek.doorRevenue)} | ${formatCurrency(data.yearAgo.doorRevenue)}
- Total Revenue (ex GST): ${formatCurrency(data.current.totalRevenue)} | ${formatCurrency(data.previousWeek.totalRevenue)} | ${formatCurrency(data.yearAgo.totalRevenue)}
- Attendance: ${data.current.attendance.toLocaleString()} | ${data.previousWeek.attendance.toLocaleString()} | ${data.yearAgo.attendance.toLocaleString()}
- Spend Per Head: ${formatCurrency(data.current.spendPerHead)} | ${formatCurrency(data.previousWeek.spendPerHead)} | ${formatCurrency(data.yearAgo.spendPerHead)}

CRITICAL: Return ONLY the HTML code. No markdown, no code blocks, no explanations.

Requirements:
- Title "Weekly Trade Report" as a header
- A single data table with the rows and columns above
- The first column in the table should be the metric name (Bar Revenue, Door Revenue, etc.)
- NO executive summary, NO analysis, NO recommendations, NO commentary, NO CTA button
- NO date range subtitle, NO descriptive text
- Just the title and the data table, nothing else

Styling:
- Background: #ffffff
- Title: #1e293b, bold, large, centered
- Table header row: #475569 background, #ffffff text, font-size 13px
- Data rows: alternating #f8fafc and #ffffff, text #334155
- Metric name column: bold
- Borders: #e2e8f0
- Typography: system fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)
- Mobile-responsive (table width 100%)
- Clean, minimal design
- Padding: 12px in cells

Return ONLY HTML code.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a data formatter. Generate clean, simple HTML email tables displaying venue performance data. Return ONLY raw HTML code with no markdown formatting, no code blocks, and no explanations. Do NOT include any analysis, commentary, recommendations, or insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to generate AI email')
    }

    const result = await response.json()
    let htmlContent = result.choices[0].message.content
    
    // Clean up any markdown artifacts
    htmlContent = htmlContent.replace(/^```html\n?/i, '')  // Remove opening ```html
    htmlContent = htmlContent.replace(/\n?```\s*$/i, '')   // Remove closing ```
    htmlContent = htmlContent.trim()
    
    return htmlContent
  } catch (error) {
    console.error('Error generating AI email:', error)
    throw error
  }
}

async function sendEmail(supabase: any, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html,
        from: 'GM Dashboard <phil@manorleederville.com>',
        template: EMAIL_TEMPLATE, // Prevent triggering venue-confirmation internal notification
      },
    })

    if (error) {
      console.error('Error sending email:', error)
      return false
    }

    return data?.success === true
  } catch (error) {
    console.error('Error invoking send-email function:', error)
    return false
  }
}

async function logNotification(
  supabase: any,
  notificationType: string,
  deliveryMethod: string,
  recipient: string,
  status: string,
  errorMessage?: string,
  metadata?: any
) {
  try {
    await supabase.from('notification_logs').insert({
      notification_type: notificationType,
      delivery_method: deliveryMethod,
      recipient,
      status,
      error_message: errorMessage,
      metadata,
    })
  } catch (error) {
    console.error('Error logging notification:', error)
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Supabase credentials not configured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Parse request body for test mode flags
    const body = await req.json().catch(() => ({}))
    const testEmailOnly = body.test_email_only === true
    const testWhatsAppOnly = body.test_whatsapp_only === true
    const previewOnly = body.preview_only === true

    // Fetch notification settings
    const { data: settings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('notification_type', NOTIFICATION_TYPE)
      .single()

    if (settingsError || !settings) {
      console.error('Error fetching notification settings:', settingsError)
      return json({ error: 'Failed to fetch notification settings', details: settingsError?.message }, 500)
    }

    const notificationSettings = settings as NotificationSettings

    if (!notificationSettings.enabled) {
      return json({ message: 'Trade report notifications are disabled', skipped: true })
    }

    // Fetch weekly summary data
    console.log('Fetching weekly summary data...')
    const summaryData = await fetchWeeklySummaryData(supabase)

    // Generate content once (used for both preview and sending)
    const whatsappMessage = generateWhatsAppMessage(summaryData)
    
    // If preview mode, generate email content and return without sending
    if (previewOnly) {
      console.log('Preview mode - generating content without sending...')
      const emailHtml = await generateAIEmail(summaryData)
      
      return json({
        success: true,
        preview: {
          whatsapp_message: whatsappMessage,
          email_html: emailHtml,
        },
        data: summaryData,
      })
    }

    // Send WhatsApp messages (only if not in email-only test mode)
    const whatsappResults: { recipient: string; success: boolean }[] = []
    if (!testEmailOnly) {
      const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_BUSINESS_API_KEY')
      const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
      
      if (WHATSAPP_API_KEY && WHATSAPP_PHONE_NUMBER_ID && 
          notificationSettings.whatsapp_numbers && notificationSettings.whatsapp_numbers.length > 0) {
        
        for (const phoneNumber of notificationSettings.whatsapp_numbers) {
          console.log(`Sending WhatsApp to ${phoneNumber}...`)
          const success = await sendWhatsAppMessage(phoneNumber, whatsappMessage)
          whatsappResults.push({ recipient: phoneNumber, success })
          
          await logNotification(
            supabase,
            NOTIFICATION_TYPE,
            'whatsapp',
            phoneNumber,
            success ? 'success' : 'failed',
            success ? undefined : 'Failed to send WhatsApp message',
            { message: whatsappMessage }
          )
        }
      } else if (notificationSettings.whatsapp_numbers && notificationSettings.whatsapp_numbers.length > 0) {
        console.log('WhatsApp numbers configured but API credentials missing - skipping WhatsApp notifications')
      }
    }

    // Generate and send emails (only if not in WhatsApp-only test mode)
    const emailResults: { recipient: string; success: boolean }[] = []
    if (!testWhatsAppOnly && notificationSettings.recipient_emails && notificationSettings.recipient_emails.length > 0) {
      console.log('Generating AI email content...')
      const emailHtml = await generateAIEmail(summaryData)
      const subject = `Weekly Trade Report - ${summaryData.saturdayLabels.current.replace('Saturday - ', '')}`

      for (const email of notificationSettings.recipient_emails) {
        console.log(`Sending email to ${email}...`)
        const success = await sendEmail(supabase, email, subject, emailHtml)
        emailResults.push({ recipient: email, success })
        
        await logNotification(
          supabase,
          NOTIFICATION_TYPE,
          'email',
          email,
          success ? 'success' : 'failed',
          success ? undefined : 'Failed to send email',
          { subject, html_length: emailHtml.length }
        )
      }
    }

    // Update last_sent_at timestamp
    await supabase
      .from('notification_settings')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('notification_type', NOTIFICATION_TYPE)

    return json({
      success: true,
      message: 'Trade report notifications sent',
      results: {
        whatsapp: whatsappResults,
        email: emailResults,
      },
      data: summaryData,
    })
  } catch (error) {
    console.error('Error in trade-report function:', error)
    const message = error instanceof Error ? error.message : String(error)
    return json({ success: false, error: message }, 500)
  }
})

