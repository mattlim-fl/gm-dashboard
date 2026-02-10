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
  }
  yearAgo: {
    barRevenue: number
    doorRevenue: number
    totalRevenue: number
    attendance: number
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
const NOTIFICATION_TYPE = 'weekly_summary'
const EMAIL_TEMPLATE = 'weekly-summary'
const DASHBOARD_URL = 'https://gm-dashboard.getproductbox.com'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function formatCurrency(cents: number): string {
  // Convert cents to dollars (GST-exclusive)
  const dollars = (cents / 100) / 1.1
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
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

  // Calculate spend per head
  const currentSpendPerHead = currentMetrics.attendance > 0 
    ? currentMetrics.revenue / currentMetrics.attendance 
    : 0

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
    },
    yearAgo: {
      barRevenue: yearAgoMetrics.barRevenue,
      doorRevenue: yearAgoMetrics.doorRevenue,
      totalRevenue: yearAgoMetrics.revenue,
      attendance: yearAgoMetrics.attendance,
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
  return `📊 Weekly Summary (${data.period.start} - ${data.period.end})

Bar: ${formatCurrency(data.current.barRevenue)} (${formatPercent(data.changes.barRevenuePercent)})
Door: ${formatCurrency(data.current.doorRevenue)} (${formatPercent(data.changes.doorRevenuePercent)})
Total: ${formatCurrency(data.current.totalRevenue)} (${formatPercent(data.changes.totalRevenuePercent)})
Attendance: ${data.current.attendance.toLocaleString()} (${formatPercent(data.changes.attendancePercent)})
Spend/Head: ${formatCurrency(data.current.spendPerHead)}`
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

  const prompt = `You are a nightlife venue operations analyst providing weekly performance insights. 

Analyze the following weekly data and create a comprehensive HTML email report:

**Current Week (${data.period.start} - ${data.period.end}):**
- Bar Revenue: ${formatCurrency(data.current.barRevenue)}
- Door Revenue: ${formatCurrency(data.current.doorRevenue)}
- Total Revenue: ${formatCurrency(data.current.totalRevenue)}
- Attendance: ${data.current.attendance} people
- Spend per Head: ${formatCurrency(data.current.spendPerHead)}

**Previous Week Comparison:**
- Bar Revenue: ${formatCurrency(data.previousWeek.barRevenue)} (${formatPercent(data.changes.barRevenuePercent)})
- Door Revenue: ${formatCurrency(data.previousWeek.doorRevenue)} (${formatPercent(data.changes.doorRevenuePercent)})
- Total Revenue: ${formatCurrency(data.previousWeek.totalRevenue)} (${formatPercent(data.changes.totalRevenuePercent)})
- Attendance: ${data.previousWeek.attendance} people (${formatPercent(data.changes.attendancePercent)})

**Year-over-Year Comparison (same week last year):**
- Bar Revenue: ${formatCurrency(data.yearAgo.barRevenue)} (${formatPercent(data.changes.barRevenueYoY)})
- Door Revenue: ${formatCurrency(data.yearAgo.doorRevenue)} (${formatPercent(data.changes.doorRevenueYoY)})
- Total Revenue: ${formatCurrency(data.yearAgo.totalRevenue)} (${formatPercent(data.changes.totalRevenueYoY)})
- Attendance: ${data.yearAgo.attendance} people (${formatPercent(data.changes.attendanceYoY)})

CRITICAL: Return ONLY the HTML code with NO markdown code blocks, NO explanations, NO \`\`\`html tags. Start directly with the HTML.

Structure the email as:

1. **Header Section**: 
   - Title: "Weekly Venue Performance Report" (large, bold, black color)
   - Date range subtitle (${data.period.start} - ${data.period.end})

2. **Executive Summary** (2-3 sentences with the most critical insights)

3. **Key Metrics Table** with columns:
   - Metric name
   - Current Week value
   - Last Week value  
   - % Change (with total change in brackets)
   
   Include these rows: Bar Revenue, Door Revenue, Total Revenue, Attendance, Spend per Head

4. **Performance Analysis**
   - What's trending up and why it matters
   - What needs attention and potential causes
   - Notable patterns (e.g., bar vs door revenue mix, spend per head trends)

4. **Strategic Recommendations** (2-3 specific, actionable suggestions)

5. **Call-to-Action Button**: "View Full Dashboard" linking to ${DASHBOARD_URL}

**Styling Guidelines - GM Dashboard Brand:**
- **Background**: #0f172a (dark navy) for body, #1e293b (lighter navy) for cards/containers
- **Text Colors**: 
  - Section Headers (Executive Summary, Key Metrics, etc.): #000000 (black, bold, large)
  - Body text: #cbd5e1 (light gray)
  - Secondary text: #94a3b8 (muted gray)
- **Table Styling**: 
  - Header row: #475569 (slate gray) background with #f1f5f9 (white) text
  - Data rows: Alternating #1e293b and #0f172a backgrounds with #cbd5e1 (light gray) text
  - Borders: #334155 (subtle dark border)
- **Visual Indicators**: ✅ for positive trends, ⚠️ for concerning trends
- **Color Coding for Changes**: 
  - Positive: #22c55e (green)
  - Negative: #ef4444 (red)  
  - Neutral: #94a3b8 (gray)
- **CTA Button**: Gradient from #f97316 to #fb923c (orange gradient), #ffffff (white) text color, rounded corners
- **Primary Accent**: #f97316 (GM Orange) for the CTA button only
- **Typography**: Use system fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)
- Mobile-responsive design
- Keep under 500 words

**Tone:** Professional but energetic. Focus on insights and opportunities.

Remember: Return ONLY HTML code, no markdown formatting or explanations.`

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
            content: 'You are a venue operations analyst. Generate professional HTML email reports with business insights. Return ONLY raw HTML code with no markdown formatting, no code blocks, and no explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
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
      return json({ error: 'Failed to fetch notification settings' }, 500)
    }

    const notificationSettings = settings as NotificationSettings

    if (!notificationSettings.enabled) {
      return json({ message: 'Weekly notifications are disabled', skipped: true })
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
      const subject = `Weekly Summary: ${summaryData.period.start} - ${summaryData.period.end}`

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
      message: 'Weekly summary notifications sent',
      results: {
        whatsapp: whatsappResults,
        email: emailResults,
      },
      data: summaryData,
    })
  } catch (error) {
    console.error('Error in weekly-summary function:', error)
    const message = error instanceof Error ? error.message : String(error)
    return json({ success: false, error: message }, 500)
  }
})

