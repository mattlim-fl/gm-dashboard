// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1"
import { findSaturdayInRange, getSameSaturdayLastYear } from "../_shared/saturday-utils.ts"

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
  fourWeekAvg: {
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
    spendPerHeadPercent: number
    barRevenueVsAvg: number
    doorRevenueVsAvg: number
    totalRevenueVsAvg: number
    attendanceVsAvg: number
    spendPerHeadVsAvg: number
    barRevenueYoY: number
    doorRevenueYoY: number
    totalRevenueYoY: number
    attendanceYoY: number
    spendPerHeadYoY: number
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
  // Convert cents to dollars (GST-exclusive)
  const dollars = (cents / 100) / 1.1
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
 * Calculate date ranges for Saturday trade report
 * Returns dates for current Saturday (6am-6am AWST), previous Saturday, and 4 weeks for averaging
 * AWST = UTC+8, so Saturday 6am AWST = Friday 22:00 UTC
 */
function calculateDateRanges(): {
  currentWeekStart: Date
  currentWeekEnd: Date
  previousWeekStart: Date
  previousWeekEnd: Date
  yearAgoStart: Date
  yearAgoEnd: Date
  // 4 weeks for averaging (weeks 2, 3, 4, 5 - excluding current week)
  avgWeeks: Array<{ start: Date; end: Date }>
} {
  const now = new Date()

  // Find the most recent Saturday using 6am AWST boundaries
  // Trading runs Saturday 6pm - Sunday 6am, so we capture Saturday 6am - Sunday 6am
  // AWST is UTC+8, so Saturday 6am AWST = Friday 22:00 UTC
  const currentSaturdayStart = new Date(now)

  // Get current day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = currentSaturdayStart.getUTCDay()

  // Calculate days since last Saturday
  // If today is Sunday (0), Saturday was 1 day ago
  // If today is Saturday (6), use today
  const daysSinceSaturday = dayOfWeek === 6 ? 0 : (dayOfWeek + 1)

  // Go back to Saturday
  currentSaturdayStart.setUTCDate(currentSaturdayStart.getUTCDate() - daysSinceSaturday)

  // Set to Friday 22:00 UTC (= Saturday 6am AWST)
  currentSaturdayStart.setUTCDate(currentSaturdayStart.getUTCDate() - 1)
  currentSaturdayStart.setUTCHours(22, 0, 0, 0)

  // End is 24 hours later (Saturday 22:00 UTC = Sunday 6am AWST)
  const currentSaturdayEnd = new Date(currentSaturdayStart.getTime() + 24 * 60 * 60 * 1000)

  // If the current Saturday hasn't ended yet, use the previous Saturday
  if (currentSaturdayEnd > now) {
    currentSaturdayStart.setUTCDate(currentSaturdayStart.getUTCDate() - 7)
    currentSaturdayEnd.setUTCDate(currentSaturdayEnd.getUTCDate() - 7)
  }

  // Previous Saturday: 7 days before current
  const previousSaturdayStart = new Date(currentSaturdayStart)
  previousSaturdayStart.setUTCDate(previousSaturdayStart.getUTCDate() - 7)

  const previousSaturdayEnd = new Date(currentSaturdayEnd)
  previousSaturdayEnd.setUTCDate(previousSaturdayEnd.getUTCDate() - 7)

  // Year-over-Year: same Saturday number from the previous year
  // e.g., "Saturday #15 of 2026" compares to "Saturday #15 of 2025"
  // This is more meaningful than 52-week lookback for Saturday-only trading businesses
  const currentSaturday = findSaturdayInRange(currentSaturdayStart, currentSaturdayEnd)
  const yearAgoSaturday = currentSaturday ? getSameSaturdayLastYear(currentSaturday) : null

  // Calculate the YoY comparison period boundaries (Saturday 6am - Sunday 6am AWST)
  // If we couldn't find the corresponding Saturday, fall back to 52-week lookback
  let yearAgoStart: Date
  let yearAgoEnd: Date

  if (yearAgoSaturday) {
    // Set to Friday 22:00 UTC (= Saturday 6am AWST) of the year-ago Saturday
    yearAgoStart = new Date(yearAgoSaturday)
    yearAgoStart.setUTCDate(yearAgoSaturday.getUTCDate() - 1)
    yearAgoStart.setUTCHours(22, 0, 0, 0)
    yearAgoEnd = new Date(yearAgoStart.getTime() + 24 * 60 * 60 * 1000)
  } else {
    // Fallback: 52 weeks ago
    yearAgoStart = new Date(currentSaturdayStart.getTime() - (52 * 7 * 24 * 60 * 60 * 1000))
    yearAgoEnd = new Date(currentSaturdayEnd.getTime() - (52 * 7 * 24 * 60 * 60 * 1000))
  }

  // 4-week average: weeks 2, 3, 4, 5 (excluding current week which is week 1)
  const avgWeeks: Array<{ start: Date; end: Date }> = []
  for (let i = 1; i <= 4; i++) {
    const weekStart = new Date(currentSaturdayStart)
    weekStart.setUTCDate(weekStart.getUTCDate() - (7 * i))
    const weekEnd = new Date(currentSaturdayEnd)
    weekEnd.setUTCDate(weekEnd.getUTCDate() - (7 * i))
    avgWeeks.push({ start: weekStart, end: weekEnd })
  }

  return {
    currentWeekStart: currentSaturdayStart,
    currentWeekEnd: currentSaturdayEnd,
    previousWeekStart: previousSaturdayStart,
    previousWeekEnd: previousSaturdayEnd,
    yearAgoStart,
    yearAgoEnd,
    avgWeeks,
  }
}

async function fetchWeeklySummaryData(supabase: any): Promise<WeeklySummaryData> {
  const dateRanges = calculateDateRanges()

  // Use the same RPC functions as the dashboard for consistency
  const venueFilter = null // All venues

  // Fetch current, previous, year-ago week, plus 4 weeks for averaging
  const [currentMetrics, previousMetrics, yearAgoMetrics, ...avgWeekMetrics] = await Promise.all([
    fetchPeriodMetrics(supabase, dateRanges.currentWeekStart, dateRanges.currentWeekEnd, venueFilter),
    fetchPeriodMetrics(supabase, dateRanges.previousWeekStart, dateRanges.previousWeekEnd, venueFilter),
    fetchPeriodMetrics(supabase, dateRanges.yearAgoStart, dateRanges.yearAgoEnd, venueFilter),
    ...dateRanges.avgWeeks.map(week =>
      fetchPeriodMetrics(supabase, week.start, week.end, venueFilter)
    ),
  ])

  // Check for errors (consolidated error handling) - year-ago errors are non-fatal
  const errors = [
    { period: 'current week', error: currentMetrics.error },
    { period: 'previous week', error: previousMetrics.error },
    ...avgWeekMetrics.map((m, i) => ({ period: `avg week ${i + 1}`, error: m.error })),
  ].filter(e => e.error)

  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.period}: ${e.error?.message}`).join('; ')
    console.error('Error fetching period data:', errorMessages)
    throw errors[0].error || new Error(`Failed to fetch period data: ${errorMessages}`)
  }

  // Calculate 4-week averages
  const validWeeks = avgWeekMetrics.filter(m => !m.error)
  const weekCount = validWeeks.length || 1 // Avoid division by zero

  const avgBarRevenue = validWeeks.reduce((sum, m) => sum + m.barRevenue, 0) / weekCount
  const avgDoorRevenue = validWeeks.reduce((sum, m) => sum + m.doorRevenue, 0) / weekCount
  const avgTotalRevenue = validWeeks.reduce((sum, m) => sum + m.revenue, 0) / weekCount
  const avgAttendance = validWeeks.reduce((sum, m) => sum + m.attendance, 0) / weekCount

  // For spend per head, calculate average of individual weeks' spend per head
  const avgSpendPerHead = validWeeks.reduce((sum, m) => {
    const spendPerHead = m.attendance > 0 ? m.revenue / m.attendance : 0
    return sum + spendPerHead
  }, 0) / weekCount

  // Calculate spend per head for current, previous, and year-ago periods
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
  }

  // Calculate percentage changes vs previous week
  const barRevenuePercent = calculatePercentChange(currentMetrics.barRevenue, previousMetrics.barRevenue)
  const doorRevenuePercent = calculatePercentChange(currentMetrics.doorRevenue, previousMetrics.doorRevenue)
  const totalRevenuePercent = calculatePercentChange(currentMetrics.revenue, previousMetrics.revenue)
  const attendancePercent = calculatePercentChange(currentMetrics.attendance, previousMetrics.attendance)
  const spendPerHeadPercent = calculatePercentChange(currentSpendPerHead, previousSpendPerHead)

  // Calculate percentage changes vs 4-week average
  const barRevenueVsAvg = calculatePercentChange(currentMetrics.barRevenue, avgBarRevenue)
  const doorRevenueVsAvg = calculatePercentChange(currentMetrics.doorRevenue, avgDoorRevenue)
  const totalRevenueVsAvg = calculatePercentChange(currentMetrics.revenue, avgTotalRevenue)
  const attendanceVsAvg = calculatePercentChange(currentMetrics.attendance, avgAttendance)
  const spendPerHeadVsAvg = calculatePercentChange(currentSpendPerHead, avgSpendPerHead)

  // Calculate Year-over-Year percentage changes
  const barRevenueYoY = calculatePercentChange(currentMetrics.barRevenue, yearAgoMetrics.barRevenue)
  const doorRevenueYoY = calculatePercentChange(currentMetrics.doorRevenue, yearAgoMetrics.doorRevenue)
  const totalRevenueYoY = calculatePercentChange(currentMetrics.revenue, yearAgoMetrics.revenue)
  const attendanceYoY = calculatePercentChange(currentMetrics.attendance, yearAgoMetrics.attendance)
  const spendPerHeadYoY = calculatePercentChange(currentSpendPerHead, yearAgoSpendPerHead)

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
    fourWeekAvg: {
      barRevenue: avgBarRevenue,
      doorRevenue: avgDoorRevenue,
      totalRevenue: avgTotalRevenue,
      attendance: avgAttendance,
      spendPerHead: avgSpendPerHead,
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
      spendPerHeadPercent,
      barRevenueVsAvg,
      doorRevenueVsAvg,
      totalRevenueVsAvg,
      attendanceVsAvg,
      spendPerHeadVsAvg,
      barRevenueYoY,
      doorRevenueYoY,
      totalRevenueYoY,
      attendanceYoY,
      spendPerHeadYoY,
    },
  }
}

function generateWhatsAppMessage(data: WeeklySummaryData): string {
  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  return `Saturday Trade Report

${data.saturdayLabels.current}
Bar Revenue - ${formatCurrency(data.current.barRevenue)} (${formatChange(data.changes.barRevenueVsAvg)} vs avg)
Door Revenue - ${formatCurrency(data.current.doorRevenue)} (${formatChange(data.changes.doorRevenueVsAvg)} vs avg)
Total Revenue - ${formatCurrency(data.current.totalRevenue)} (${formatChange(data.changes.totalRevenueVsAvg)} vs avg)
Attendance - ${data.current.attendance.toLocaleString()} (${formatChange(data.changes.attendanceVsAvg)} vs avg)
Spend Per Head - ${formatCurrency(data.current.spendPerHead)} (${formatChange(data.changes.spendPerHeadVsAvg)} vs avg)

Previous Saturday
Bar Revenue - ${formatCurrency(data.previousWeek.barRevenue)}
Door Revenue - ${formatCurrency(data.previousWeek.doorRevenue)}
Total Revenue - ${formatCurrency(data.previousWeek.totalRevenue)}
Attendance - ${data.previousWeek.attendance.toLocaleString()}
Spend Per Head - ${formatCurrency(data.previousWeek.spendPerHead)}

4-Week Average
Bar Revenue - ${formatCurrency(data.fourWeekAvg.barRevenue)}
Door Revenue - ${formatCurrency(data.fourWeekAvg.doorRevenue)}
Total Revenue - ${formatCurrency(data.fourWeekAvg.totalRevenue)}
Attendance - ${Math.round(data.fourWeekAvg.attendance).toLocaleString()}
Spend Per Head - ${formatCurrency(data.fourWeekAvg.spendPerHead)}`
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

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

/**
 * Get the Saturday date from a period's date range and format as "Saturday 17th January 2026"
 */
function formatSaturdaySubtitle(startDate: Date, endDate: Date): string {
  const current = new Date(startDate)
  while (current <= endDate) {
    if (current.getDay() === 6) {
      const day = current.getDate()
      const suffix = getOrdinalSuffix(day)
      const month = current.toLocaleDateString('en-AU', { month: 'long' })
      const year = current.getFullYear()
      return `Saturday ${day}${suffix} ${month} ${year}`
    }
    current.setDate(current.getDate() + 1)
  }
  // Fallback
  const d = endDate
  const day = d.getDate()
  const suffix = getOrdinalSuffix(day)
  const month = d.toLocaleDateString('en-AU', { month: 'long' })
  const year = d.getFullYear()
  return `Saturday ${day}${suffix} ${month} ${year}`
}

/**
 * Generate a directional indicator HTML snippet
 * @param change - The change value (%)
 * @param isAvailable - Whether comparison data is available
 */
function generateIndicator(change: number, isAvailable: boolean): string {
  if (!isAvailable) {
    return `<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:#f1f5f9;color:#94a3b8;text-align:center;line-height:20px;font-size:12px;vertical-align:middle;">&#8211;</span><span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#94a3b8;margin-left:6px;vertical-align:middle;">n/a</span>`
  }

  const isPositive = change > 0
  const isNegative = change < 0
  const isNeutral = change === 0

  let arrowChar: string
  let arrowBg: string
  let arrowColor: string

  if (isNeutral) {
    arrowChar = '&#8211;'
    arrowBg = '#f1f5f9'
    arrowColor = '#94a3b8'
  } else if (isPositive) {
    arrowChar = '&#8593;'
    arrowBg = '#dcfce7'
    arrowColor = '#16a34a'
  } else {
    arrowChar = '&#8595;'
    arrowBg = '#fee2e2'
    arrowColor = '#dc2626'
  }

  const sign = change > 0 ? '+' : ''
  const displayValue = `${sign}${change.toFixed(1)}%`

  return `<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${arrowBg};color:${arrowColor};text-align:center;line-height:20px;font-size:12px;vertical-align:middle;">${arrowChar}</span><span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#1a1a2e;margin-left:6px;vertical-align:middle;">${displayValue}</span>`
}

function generateEmailHtml(data: WeeklySummaryData): string {
  const dateRanges = calculateDateRanges()
  const subtitle = formatSaturdaySubtitle(dateRanges.currentWeekStart, dateRanges.currentWeekEnd)

  // 4-week average is always available (we have the data)
  const avgDataAvailable = data.fourWeekAvg.totalRevenue > 0 || data.current.totalRevenue === 0
  // YoY data may not be available if no data from a year ago
  const yoyDataAvailable = data.yearAgo.totalRevenue > 0 || data.current.totalRevenue === 0

  // Build table rows - all metrics are "positive = good"
  const rows = [
    {
      metric: 'Bar Revenue',
      value: formatCurrency(data.current.barRevenue),
      wow: generateIndicator(data.changes.barRevenuePercent, true),
      vsAvg: generateIndicator(data.changes.barRevenueVsAvg, avgDataAvailable),
      yoy: generateIndicator(data.changes.barRevenueYoY, yoyDataAvailable),
    },
    {
      metric: 'Door Revenue',
      value: formatCurrency(data.current.doorRevenue),
      wow: generateIndicator(data.changes.doorRevenuePercent, true),
      vsAvg: generateIndicator(data.changes.doorRevenueVsAvg, avgDataAvailable),
      yoy: generateIndicator(data.changes.doorRevenueYoY, yoyDataAvailable),
    },
    {
      metric: 'Total Revenue',
      value: formatCurrency(data.current.totalRevenue),
      wow: generateIndicator(data.changes.totalRevenuePercent, true),
      vsAvg: generateIndicator(data.changes.totalRevenueVsAvg, avgDataAvailable),
      yoy: generateIndicator(data.changes.totalRevenueYoY, yoyDataAvailable),
    },
    {
      metric: 'Attendance',
      value: data.current.attendance.toLocaleString(),
      wow: generateIndicator(data.changes.attendancePercent, true),
      vsAvg: generateIndicator(data.changes.attendanceVsAvg, avgDataAvailable),
      yoy: generateIndicator(data.changes.attendanceYoY, yoyDataAvailable),
    },
    {
      metric: 'Spend Per Head',
      value: formatCurrency(data.current.spendPerHead),
      wow: generateIndicator(data.changes.spendPerHeadPercent, true),
      vsAvg: generateIndicator(data.changes.spendPerHeadVsAvg, avgDataAvailable),
      yoy: generateIndicator(data.changes.spendPerHeadYoY, yoyDataAvailable),
    },
  ]

  const tableRows = rows.map((row, index) => {
    const isLast = index === rows.length - 1
    const borderStyle = isLast ? 'border:none;' : 'border-bottom:1px solid #f1f5f9;'
    return `<tr>
      <td style="padding:14px 16px;${borderStyle}font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:600;font-size:14px;color:#1a1a2e;">${row.metric}</td>
      <td style="padding:14px 16px;${borderStyle}font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:500;color:#1a1a2e;">${row.value}</td>
      <td style="padding:14px 16px;${borderStyle}">${row.wow}</td>
      <td style="padding:14px 16px;${borderStyle}">${row.vsAvg}</td>
      <td style="padding:14px 16px;${borderStyle}">${row.yoy}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f2f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="800" cellspacing="0" cellpadding="0" style="max-width:800px;width:100%;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 8px 24px rgba(0,0,0,0.04);">
<tr><td style="padding:32px;">

<h1 style="margin:0 0 8px 0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:20px;font-weight:700;color:#1a1a2e;">Saturday Trade Report</h1>
<p style="margin:0 0 24px 0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;font-weight:500;color:#94a3b8;">${subtitle}</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
<thead>
<tr style="background-color:#f8fafc;">
  <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:#64748b;border-bottom:2px solid #e2e8f0;">Metric</th>
  <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:#64748b;border-bottom:2px solid #e2e8f0;">This Week</th>
  <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:#64748b;border-bottom:2px solid #e2e8f0;">vs Last Week</th>
  <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:#64748b;border-bottom:2px solid #e2e8f0;">vs 4-Week Avg</th>
  <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:#64748b;border-bottom:2px solid #e2e8f0;">vs Last Year</th>
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials for send-email')
      return false
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        from: 'GM Dashboard <phil@manorleederville.com>',
        template: EMAIL_TEMPLATE, // Prevent triggering venue-confirmation internal notification
      }),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error('Error sending email:', res.status, errorText)
      return false
    }

    const data = await res.json()
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
    const testRecipient = typeof body.test_recipient === 'string' ? body.test_recipient : null
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
      const emailHtml = generateEmailHtml(summaryData)
      
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
    const emailRecipients = testRecipient ? [testRecipient] : (notificationSettings.recipient_emails || [])
    if (!testWhatsAppOnly && emailRecipients.length > 0) {
      console.log('Generating email content...')
      const emailHtml = generateEmailHtml(summaryData)
      const subject = `Saturday Trade Report - ${summaryData.saturdayLabels.current.replace('Saturday - ', '')}`

      for (const email of emailRecipients) {
        console.log(`Sending email to ${email}...`)
        const success = await sendEmail(email, subject, emailHtml)
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

