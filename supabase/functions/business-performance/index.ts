// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1"
import { findSaturdayInRange, getSameSaturdayLastYear } from "../_shared/saturday-utils.ts"
import { config } from "../_shared/config.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-api-key, x-client-info",
}

// =====================================================
// XERO INTEGRATION - Delegates to API server
// =====================================================

// Default venue for Xero P&L (uses organization-level credentials)
const DEFAULT_VENUE_FOR_XERO = 'manor'

interface BusinessPerformanceData {
  period: {
    start: string
    end: string
  }
  saturdayLabels: {
    current: string
    previous: string
  }
  current: {
    revenue: number
    wages: number
    wagesPercent: number
    cogs: number
    cogsPercent: number
    security: number
    securityPercent: number
    attendance: number
    spendPerHead: number
  }
  previous: {
    revenue: number
    wages: number
    wagesPercent: number
    cogs: number
    cogsPercent: number
    security: number
    securityPercent: number
    attendance: number
    spendPerHead: number
  }
  fourWeekAvg: {
    revenue: number
    wages: number
    wagesPercent: number
    cogs: number
    cogsPercent: number
    security: number
    securityPercent: number
    attendance: number
    spendPerHead: number
  }
  yearAgo: {
    revenue: number
    wages: number
    wagesPercent: number
    cogs: number
    cogsPercent: number
    security: number
    securityPercent: number
    attendance: number
    spendPerHead: number
  }
  changes: {
    revenuePercent: number
    revenueVsAvg: number
    revenueYoY: number
    wagesPercentChange: number
    wagesVsAvg: number
    wagesYoY: number
    cogsPercentChange: number
    cogsVsAvg: number
    cogsYoY: number
    securityPercentChange: number
    securityVsAvg: number
    securityYoY: number
    attendancePercent: number
    attendanceVsAvg: number
    attendanceYoY: number
    spendPerHeadPercent: number
    spendPerHeadVsAvg: number
    spendPerHeadYoY: number
  }
}

interface NotificationSettings {
  enabled: boolean
  recipient_emails: string[]
  whatsapp_numbers: string[]
}

// Constants
const NOTIFICATION_TYPE = 'business_performance'
const EMAIL_TEMPLATE = 'business-performance'

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

function calculatePercentChange(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0
}

/**
 * Calculate date ranges for 7-day period
 * Returns current week, previous week, year-ago, and 4 weeks for averaging
 */
function calculateDateRanges(): {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
  yearAgoStart: Date
  yearAgoEnd: Date
  avgWeeks: Array<{ start: Date; end: Date }>
} {
  const now = new Date()
  now.setHours(23, 59, 59, 999)

  // Last 7 days (matches dashboard's getPeriodDates logic)
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - 7)
  currentStart.setHours(0, 0, 0, 0)

  // Previous 7 days
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - 7)
  previousStart.setHours(0, 0, 0, 0)

  const previousEnd = new Date(currentStart.getTime() - 1)

  // Year-over-Year: same Saturday number from the previous year
  // e.g., "Saturday #15 of 2026" compares to "Saturday #15 of 2025"
  // This is more meaningful for Saturday-only trading businesses
  const currentSaturday = findSaturdayInRange(currentStart, now)
  const yearAgoSaturday = currentSaturday ? getSameSaturdayLastYear(currentSaturday) : null

  // Calculate the YoY comparison period (7 days centered around the year-ago Saturday)
  let yearAgoStart: Date
  let yearAgoEnd: Date

  if (yearAgoSaturday) {
    // Use the same relative position within the 7-day window
    yearAgoEnd = new Date(yearAgoSaturday)
    yearAgoEnd.setHours(23, 59, 59, 999)
    yearAgoStart = new Date(yearAgoEnd)
    yearAgoStart.setDate(yearAgoStart.getDate() - 7)
    yearAgoStart.setHours(0, 0, 0, 0)
  } else {
    // Fallback: 52 weeks ago
    yearAgoStart = new Date(currentStart.getTime() - (52 * 7 * 24 * 60 * 60 * 1000))
    yearAgoEnd = new Date(now.getTime() - (52 * 7 * 24 * 60 * 60 * 1000))
  }

  // 4-week average: weeks 2, 3, 4, 5 (excluding current week which is week 1)
  const avgWeeks: Array<{ start: Date; end: Date }> = []
  for (let i = 1; i <= 4; i++) {
    const weekStart = new Date(currentStart)
    weekStart.setDate(weekStart.getDate() - (7 * i))
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() - (7 * i))
    avgWeeks.push({ start: weekStart, end: weekEnd })
  }

  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd,
    yearAgoStart,
    yearAgoEnd,
    avgWeeks,
  }
}

/**
 * Fetch P&L data via the API server's /xero/pnl endpoint
 * This avoids duplicating P&L parsing logic between edge functions and the API server
 */
async function fetchPnlData(_supabase: any, startDate: Date, endDate: Date): Promise<any> {
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const apiBaseUrl = config.apiBaseUrl
  if (!apiBaseUrl) {
    console.error('API_BASE_URL not configured, cannot fetch P&L data')
    return null
  }

  try {
    console.log(`Fetching P&L data via API server: ${startDateStr} to ${endDateStr}`)

    const response = await fetch(`${apiBaseUrl}/xero/pnl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: startDateStr,
        endDate: endDateStr,
        refresh: true,
        venue: DEFAULT_VENUE_FOR_XERO,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API server P&L request failed:', response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log('P&L data received from API server:', JSON.stringify(data))
    return data
  } catch (error) {
    console.error('Error fetching P&L data from API server:', error)
    return null
  }
}

/**
 * Fetch revenue and attendance data
 */
async function fetchRevenueAndAttendance(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<{ revenue: number; attendance: number }> {
  const [
    { data: revenue, error: revenueError },
    { data: attendance, error: attendanceError }
  ] = await Promise.all([
    supabase.rpc('get_revenue_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: null
    }),
    supabase.rpc('get_attendance_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: null
    })
  ])

  if (revenueError || attendanceError) {
    throw new Error('Failed to fetch revenue/attendance data')
  }

  return {
    revenue: revenue || 0,
    attendance: attendance || 0,
  }
}

async function fetchBusinessPerformanceData(supabase: any): Promise<BusinessPerformanceData> {
  const dateRanges = calculateDateRanges()

  // Fetch P&L and revenue/attendance for current, previous, year-ago, and 4 averaging weeks
  const [currentPnl, previousPnl, yearAgoPnl, currentMetrics, previousMetrics, yearAgoMetrics, ...avgData] = await Promise.all([
    fetchPnlData(supabase, dateRanges.currentStart, dateRanges.currentEnd),
    fetchPnlData(supabase, dateRanges.previousStart, dateRanges.previousEnd),
    fetchPnlData(supabase, dateRanges.yearAgoStart, dateRanges.yearAgoEnd),
    fetchRevenueAndAttendance(supabase, dateRanges.currentStart, dateRanges.currentEnd),
    fetchRevenueAndAttendance(supabase, dateRanges.previousStart, dateRanges.previousEnd),
    fetchRevenueAndAttendance(supabase, dateRanges.yearAgoStart, dateRanges.yearAgoEnd),
    // Fetch P&L and metrics for each of the 4 weeks
    ...dateRanges.avgWeeks.flatMap(week => [
      fetchPnlData(supabase, week.start, week.end),
      fetchRevenueAndAttendance(supabase, week.start, week.end),
    ]),
  ])

  // Parse the avgData array (alternating pnl, metrics for each week)
  const avgWeekData: Array<{ pnl: any; metrics: { revenue: number; attendance: number } }> = []
  for (let i = 0; i < 4; i++) {
    avgWeekData.push({
      pnl: avgData[i * 2],
      metrics: avgData[i * 2 + 1] as { revenue: number; attendance: number },
    })
  }

  // Revenue from Square is in cents GST-inclusive
  const currentRevenueCents = currentMetrics.revenue
  const previousRevenueCents = previousMetrics.revenue
  const yearAgoRevenueCents = yearAgoMetrics.revenue

  // Convert cents to dollars (GST-inclusive / net sales)
  const currentRevenue = currentRevenueCents / 100
  const previousRevenue = previousRevenueCents / 100
  const yearAgoRevenue = yearAgoRevenueCents / 100

  // Always use Square revenue for display metrics
  // Square is the authoritative source for revenue; Xero P&L may return incomplete data
  // Xero is only used for expense categories (wages, COGS, security)
  const displayCurrentRevenue = currentRevenue
  const displayPreviousRevenue = previousRevenue
  const displayYearAgoRevenue = yearAgoRevenue

  const currentWages = currentPnl?.categories?.wages || 0
  const currentCogs = currentPnl?.categories?.cogs || 0
  const currentSecurity = currentPnl?.categories?.security || 0

  const previousWages = previousPnl?.categories?.wages || 0
  const previousCogs = previousPnl?.categories?.cogs || 0
  const previousSecurity = previousPnl?.categories?.security || 0

  const yearAgoWages = yearAgoPnl?.categories?.wages || 0
  const yearAgoCogs = yearAgoPnl?.categories?.cogs || 0
  const yearAgoSecurity = yearAgoPnl?.categories?.security || 0

  // Calculate 4-week averages
  const validWeeks = avgWeekData.filter(w => w.pnl || w.metrics.revenue > 0)
  const weekCount = validWeeks.length || 1

  // Always use Square revenue for average (consistent with display metrics)
  const avgRevenue = validWeeks.reduce((sum, w) => {
    return sum + (w.metrics.revenue / 100)
  }, 0) / weekCount

  const avgWages = validWeeks.reduce((sum, w) => sum + (w.pnl?.categories?.wages || 0), 0) / weekCount
  const avgCogs = validWeeks.reduce((sum, w) => sum + (w.pnl?.categories?.cogs || 0), 0) / weekCount
  const avgSecurity = validWeeks.reduce((sum, w) => sum + (w.pnl?.categories?.security || 0), 0) / weekCount
  const avgAttendance = validWeeks.reduce((sum, w) => sum + w.metrics.attendance, 0) / weekCount

  // Average spend per head
  const avgSpendPerHead = validWeeks.reduce((sum, w) => {
    const spendPerHead = w.metrics.attendance > 0 ? (w.metrics.revenue / 100) / w.metrics.attendance : 0
    return sum + spendPerHead
  }, 0) / weekCount

  // Calculate cost percentages (costs as % of revenue)
  const currentWagesPercent = displayCurrentRevenue > 0 ? (currentWages / displayCurrentRevenue) * 100 : 0
  const currentCogsPercent = displayCurrentRevenue > 0 ? (currentCogs / displayCurrentRevenue) * 100 : 0
  const currentSecurityPercent = displayCurrentRevenue > 0 ? (currentSecurity / displayCurrentRevenue) * 100 : 0

  const previousWagesPercent = displayPreviousRevenue > 0 ? (previousWages / displayPreviousRevenue) * 100 : 0
  const previousCogsPercent = displayPreviousRevenue > 0 ? (previousCogs / displayPreviousRevenue) * 100 : 0
  const previousSecurityPercent = displayPreviousRevenue > 0 ? (previousSecurity / displayPreviousRevenue) * 100 : 0

  const yearAgoWagesPercent = displayYearAgoRevenue > 0 ? (yearAgoWages / displayYearAgoRevenue) * 100 : 0
  const yearAgoCogsPercent = displayYearAgoRevenue > 0 ? (yearAgoCogs / displayYearAgoRevenue) * 100 : 0
  const yearAgoSecurityPercent = displayYearAgoRevenue > 0 ? (yearAgoSecurity / displayYearAgoRevenue) * 100 : 0

  const avgWagesPercent = avgRevenue > 0 ? (avgWages / avgRevenue) * 100 : 0
  const avgCogsPercent = avgRevenue > 0 ? (avgCogs / avgRevenue) * 100 : 0
  const avgSecurityPercent = avgRevenue > 0 ? (avgSecurity / avgRevenue) * 100 : 0

  // Spend per head in dollars (stored as GST-inclusive, displayed as GST-exclusive via formatCurrency)
  const currentSpendPerHead = currentMetrics.attendance > 0
    ? (currentRevenueCents / 100) / currentMetrics.attendance
    : 0
  const previousSpendPerHead = previousMetrics.attendance > 0
    ? (previousRevenueCents / 100) / previousMetrics.attendance
    : 0
  const yearAgoSpendPerHead = yearAgoMetrics.attendance > 0
    ? (yearAgoRevenueCents / 100) / yearAgoMetrics.attendance
    : 0

  // Calculate week-over-week changes
  const revenuePercent = calculatePercentChange(displayCurrentRevenue, displayPreviousRevenue)
  const wagesPercentChange = currentWagesPercent - previousWagesPercent
  const cogsPercentChange = currentCogsPercent - previousCogsPercent
  const securityPercentChange = currentSecurityPercent - previousSecurityPercent
  const attendancePercent = calculatePercentChange(currentMetrics.attendance, previousMetrics.attendance)
  const spendPerHeadPercent = calculatePercentChange(currentSpendPerHead, previousSpendPerHead)

  // Calculate vs 4-week average changes
  const revenueVsAvg = calculatePercentChange(displayCurrentRevenue, avgRevenue)
  const wagesVsAvg = currentWagesPercent - avgWagesPercent
  const cogsVsAvg = currentCogsPercent - avgCogsPercent
  const securityVsAvg = currentSecurityPercent - avgSecurityPercent
  const attendanceVsAvg = calculatePercentChange(currentMetrics.attendance, avgAttendance)
  const spendPerHeadVsAvg = calculatePercentChange(currentSpendPerHead, avgSpendPerHead)

  // Calculate Year-over-Year changes
  const revenueYoY = calculatePercentChange(displayCurrentRevenue, displayYearAgoRevenue)
  const wagesYoY = currentWagesPercent - yearAgoWagesPercent
  const cogsYoY = currentCogsPercent - yearAgoCogsPercent
  const securityYoY = currentSecurityPercent - yearAgoSecurityPercent
  const attendanceYoY = calculatePercentChange(currentMetrics.attendance, yearAgoMetrics.attendance)
  const spendPerHeadYoY = calculatePercentChange(currentSpendPerHead, yearAgoSpendPerHead)

  // Calculate Saturday labels for each period
  const saturdayLabels = {
    current: getSaturdayLabel(dateRanges.currentStart, dateRanges.currentEnd),
    previous: getSaturdayLabel(dateRanges.previousStart, dateRanges.previousEnd),
  }

  console.log('Business Performance Data:', {
    displayCurrentRevenue,
    currentWages,
    currentCogs,
    currentSecurity,
    avgRevenue,
    avgWages,
    avgCogs,
    avgSecurity,
  })

  return {
    period: {
      start: formatDate(dateRanges.currentStart),
      end: formatDate(dateRanges.currentEnd),
    },
    saturdayLabels,
    current: {
      revenue: Math.round(displayCurrentRevenue * 100), // Store as cents for formatCurrency
      wages: Math.round(currentWages * 100),
      wagesPercent: currentWagesPercent,
      cogs: Math.round(currentCogs * 100),
      cogsPercent: currentCogsPercent,
      security: Math.round(currentSecurity * 100),
      securityPercent: currentSecurityPercent,
      attendance: currentMetrics.attendance,
      spendPerHead: Math.round(currentSpendPerHead * 100),
    },
    previous: {
      revenue: Math.round(displayPreviousRevenue * 100),
      wages: Math.round(previousWages * 100),
      wagesPercent: previousWagesPercent,
      cogs: Math.round(previousCogs * 100),
      cogsPercent: previousCogsPercent,
      security: Math.round(previousSecurity * 100),
      securityPercent: previousSecurityPercent,
      attendance: previousMetrics.attendance,
      spendPerHead: Math.round(previousSpendPerHead * 100),
    },
    fourWeekAvg: {
      revenue: Math.round(avgRevenue * 100),
      wages: Math.round(avgWages * 100),
      wagesPercent: avgWagesPercent,
      cogs: Math.round(avgCogs * 100),
      cogsPercent: avgCogsPercent,
      security: Math.round(avgSecurity * 100),
      securityPercent: avgSecurityPercent,
      attendance: Math.round(avgAttendance),
      spendPerHead: Math.round(avgSpendPerHead * 100),
    },
    yearAgo: {
      revenue: Math.round(displayYearAgoRevenue * 100),
      wages: Math.round(yearAgoWages * 100),
      wagesPercent: yearAgoWagesPercent,
      cogs: Math.round(yearAgoCogs * 100),
      cogsPercent: yearAgoCogsPercent,
      security: Math.round(yearAgoSecurity * 100),
      securityPercent: yearAgoSecurityPercent,
      attendance: yearAgoMetrics.attendance,
      spendPerHead: Math.round(yearAgoSpendPerHead * 100),
    },
    changes: {
      revenuePercent,
      revenueVsAvg,
      revenueYoY,
      wagesPercentChange,
      wagesVsAvg,
      wagesYoY,
      cogsPercentChange,
      cogsVsAvg,
      cogsYoY,
      securityPercentChange,
      securityVsAvg,
      securityYoY,
      attendancePercent,
      attendanceVsAvg,
      attendanceYoY,
      spendPerHeadPercent,
      spendPerHeadVsAvg,
      spendPerHeadYoY,
    },
  }
}

function generateWhatsAppMessage(data: BusinessPerformanceData): string {
  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  return `Weekly Performance Report

${data.saturdayLabels.current}
Revenue - ${formatCurrency(data.current.revenue)} (${formatChange(data.changes.revenueVsAvg)} vs avg)
Wages - ${formatCurrency(data.current.wages)} (${data.current.wagesPercent.toFixed(1)}%, ${formatChange(data.changes.wagesVsAvg)} vs avg)
COGS - ${formatCurrency(data.current.cogs)} (${data.current.cogsPercent.toFixed(1)}%, ${formatChange(data.changes.cogsVsAvg)} vs avg)
Security - ${formatCurrency(data.current.security)} (${data.current.securityPercent.toFixed(1)}%, ${formatChange(data.changes.securityVsAvg)} vs avg)
Attendance - ${data.current.attendance.toLocaleString()} (${formatChange(data.changes.attendanceVsAvg)} vs avg)
Spend Per Head - ${formatCurrency(data.current.spendPerHead)} (${formatChange(data.changes.spendPerHeadVsAvg)} vs avg)

Previous Week
Revenue - ${formatCurrency(data.previous.revenue)}
Wages - ${formatCurrency(data.previous.wages)} (${data.previous.wagesPercent.toFixed(1)}%)
COGS - ${formatCurrency(data.previous.cogs)} (${data.previous.cogsPercent.toFixed(1)}%)
Security - ${formatCurrency(data.previous.security)} (${data.previous.securityPercent.toFixed(1)}%)
Attendance - ${data.previous.attendance.toLocaleString()}
Spend Per Head - ${formatCurrency(data.previous.spendPerHead)}

4-Week Average
Revenue - ${formatCurrency(data.fourWeekAvg.revenue)}
Wages - ${formatCurrency(data.fourWeekAvg.wages)} (${data.fourWeekAvg.wagesPercent.toFixed(1)}%)
COGS - ${formatCurrency(data.fourWeekAvg.cogs)} (${data.fourWeekAvg.cogsPercent.toFixed(1)}%)
Security - ${formatCurrency(data.fourWeekAvg.security)} (${data.fourWeekAvg.securityPercent.toFixed(1)}%)
Attendance - ${data.fourWeekAvg.attendance.toLocaleString()}
Spend Per Head - ${formatCurrency(data.fourWeekAvg.spendPerHead)}`
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
 * @param invertDirection - If true, negative change = good (for cost metrics)
 * @param isAvailable - Whether comparison data is available
 */
function generateIndicator(change: number, invertDirection: boolean, isAvailable: boolean): string {
  if (!isAvailable) {
    return `<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:#f1f5f9;color:#94a3b8;text-align:center;line-height:20px;font-size:12px;vertical-align:middle;">&#8211;</span><span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#94a3b8;margin-left:6px;vertical-align:middle;">n/a</span>`
  }

  const isPositiveChange = change > 0
  const isNegativeChange = change < 0
  const isNeutral = change === 0

  // Determine if this change is "good" or "bad"
  let isGood: boolean
  if (isNeutral) {
    isGood = true // neutral
  } else if (invertDirection) {
    // For costs: decrease = good, increase = bad
    isGood = isNegativeChange
  } else {
    // For revenue/attendance: increase = good, decrease = bad
    isGood = isPositiveChange
  }

  let arrowChar: string
  let arrowBg: string
  let arrowColor: string

  if (isNeutral) {
    arrowChar = '&#8211;'
    arrowBg = '#f1f5f9'
    arrowColor = '#94a3b8'
  } else if (isGood) {
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

function generateEmailHtml(data: BusinessPerformanceData): string {
  const dateRanges = calculateDateRanges()
  const subtitle = formatSaturdaySubtitle(dateRanges.currentStart, dateRanges.currentEnd)

  // Determine data availability for 4-week average (if avg revenue is 0 and current isn't, likely no data)
  const avgRevenueAvailable = data.fourWeekAvg.revenue > 0 || data.current.revenue === 0
  const avgAttendanceAvailable = data.fourWeekAvg.attendance > 0 || data.current.attendance === 0
  const avgSpendAvailable = data.fourWeekAvg.spendPerHead > 0 || data.current.spendPerHead === 0
  // For cost metrics, check if avg revenue exists (needed for percentage calculation)
  const avgCostDataAvailable = avgRevenueAvailable
  // YoY data availability
  const yoyRevenueAvailable = data.yearAgo.revenue > 0 || data.current.revenue === 0
  const yoyAttendanceAvailable = data.yearAgo.attendance > 0 || data.current.attendance === 0
  const yoySpendAvailable = data.yearAgo.spendPerHead > 0 || data.current.spendPerHead === 0
  const yoyCostDataAvailable = yoyRevenueAvailable

  // Build table rows
  const rows = [
    {
      metric: 'Revenue',
      value: formatCurrency(data.current.revenue),
      valueSuffix: '',
      wow: generateIndicator(data.changes.revenuePercent, false, true),
      vsAvg: generateIndicator(data.changes.revenueVsAvg, false, avgRevenueAvailable),
      yoy: generateIndicator(data.changes.revenueYoY, false, yoyRevenueAvailable),
    },
    {
      metric: 'Wages',
      value: formatCurrency(data.current.wages),
      valueSuffix: ` <span style="color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:13px;">(${data.current.wagesPercent.toFixed(1)}%)</span>`,
      wow: generateIndicator(data.changes.wagesPercentChange, true, true),
      vsAvg: generateIndicator(data.changes.wagesVsAvg, true, avgCostDataAvailable),
      yoy: generateIndicator(data.changes.wagesYoY, true, yoyCostDataAvailable),
    },
    {
      metric: 'COGS',
      value: formatCurrency(data.current.cogs),
      valueSuffix: ` <span style="color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:13px;">(${data.current.cogsPercent.toFixed(1)}%)</span>`,
      wow: generateIndicator(data.changes.cogsPercentChange, true, true),
      vsAvg: generateIndicator(data.changes.cogsVsAvg, true, avgCostDataAvailable),
      yoy: generateIndicator(data.changes.cogsYoY, true, yoyCostDataAvailable),
    },
    {
      metric: 'Security',
      value: formatCurrency(data.current.security),
      valueSuffix: ` <span style="color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:13px;">(${data.current.securityPercent.toFixed(1)}%)</span>`,
      wow: generateIndicator(data.changes.securityPercentChange, true, true),
      vsAvg: generateIndicator(data.changes.securityVsAvg, true, avgCostDataAvailable),
      yoy: generateIndicator(data.changes.securityYoY, true, yoyCostDataAvailable),
    },
    {
      metric: 'Attendance',
      value: data.current.attendance.toLocaleString(),
      valueSuffix: '',
      wow: generateIndicator(data.changes.attendancePercent, false, true),
      vsAvg: generateIndicator(data.changes.attendanceVsAvg, false, avgAttendanceAvailable),
      yoy: generateIndicator(data.changes.attendanceYoY, false, yoyAttendanceAvailable),
    },
    {
      metric: 'Spend Per Head',
      value: formatCurrency(data.current.spendPerHead),
      valueSuffix: '',
      wow: generateIndicator(data.changes.spendPerHeadPercent, false, true),
      vsAvg: generateIndicator(data.changes.spendPerHeadVsAvg, false, avgSpendAvailable),
      yoy: generateIndicator(data.changes.spendPerHeadYoY, false, yoySpendAvailable),
    },
  ]

  const tableRows = rows.map((row, index) => {
    const isLast = index === rows.length - 1
    const borderStyle = isLast ? 'border:none;' : 'border-bottom:1px solid #f1f5f9;'
    return `<tr>
      <td style="padding:14px 16px;${borderStyle}font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:600;font-size:14px;color:#1a1a2e;">${row.metric}</td>
      <td style="padding:14px 16px;${borderStyle}font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:500;color:#1a1a2e;">${row.value}${row.valueSuffix}</td>
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

<h1 style="margin:0 0 8px 0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:20px;font-weight:700;color:#1a1a2e;">Weekly Performance Report</h1>
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

async function sendEmail(supabase: any, to: string, subject: string, html: string): Promise<boolean> {
  try {
    // Import Resend credentials directly instead of calling send-email function
    // (workaround for corrupted SUPABASE_SERVICE_ROLE_KEY/ANON_KEY secrets)
    const { getResendCredentials } = await import("../_shared/credentials.ts")

    console.log('Fetching Resend credentials for direct send...')
    const resendCreds = await getResendCredentials(supabase)

    if (!resendCreds?.apiKey) {
      console.error('No Resend API key configured')
      return false
    }

    console.log('Sending email directly via Resend to:', to)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendCreds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GM Dashboard <phil@manorleederville.com>',
        to,
        subject,
        html,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('Resend error:', result)
      return false
    }

    console.log('Email sent successfully:', result?.id)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
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
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
    
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
      return json({ message: 'Business performance notifications are disabled', skipped: true })
    }

    // Fetch business performance data
    console.log('Fetching business performance data...')
    const performanceData = await fetchBusinessPerformanceData(supabase)

    // Generate content once (used for both preview and sending)
    const whatsappMessage = generateWhatsAppMessage(performanceData)
    
    // If preview mode, generate email content and return without sending
    if (previewOnly) {
      console.log('Preview mode - generating content without sending...')
      const emailHtml = generateEmailHtml(performanceData)
      
      return json({
        success: true,
        preview: {
          whatsapp_message: whatsappMessage,
          email_html: emailHtml,
        },
        data: performanceData,
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
      console.log('Generating email HTML...')
      const emailHtml = generateEmailHtml(performanceData)
      const subject = `Weekly Performance Report - ${performanceData.saturdayLabels.current.replace('Saturday - ', '')}`

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
      message: 'Business performance notifications sent',
      results: {
        whatsapp: whatsappResults,
        email: emailResults,
      },
      data: performanceData,
    })
  } catch (error) {
    console.error('Error in business-performance function:', error)
    const message = error instanceof Error ? error.message : String(error)
    return json({ success: false, error: message }, 500)
  }
})
