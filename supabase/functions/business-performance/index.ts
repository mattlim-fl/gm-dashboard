// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1"
// @ts-expect-error - Deno crypto import
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
// @ts-expect-error - Deno encoding import
import { decode as base64Decode, encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-api-key, x-client-info",
}

// =====================================================
// XERO INTEGRATION - Direct API calls
// =====================================================

interface XeroConnection {
  id: string
  tenant_id: string
  access_token: string
  refresh_token_enc: string
  expires_at: string
  scopes: string[]
}

interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

/**
 * Decrypt the encrypted refresh token using AES-256-GCM
 */
async function decryptRefreshToken(encryptedToken: string): Promise<string> {
  const encryptionKey = Deno.env.get('XERO_TOKEN_ENCRYPTION_KEY')
  if (!encryptionKey) {
    throw new Error('XERO_TOKEN_ENCRYPTION_KEY not configured')
  }

  // Get the key (same logic as backend)
  let keyBytes: Uint8Array
  if (/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    // Hex string
    keyBytes = new Uint8Array(encryptionKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  } else {
    // Hash the key
    const encoder = new TextEncoder()
    const keyData = encoder.encode(encryptionKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
    keyBytes = new Uint8Array(hashBuffer)
  }

  // Decode the base64 encrypted data
  const encryptedData = base64Decode(encryptedToken)
  
  // Extract IV (12 bytes), auth tag (16 bytes), and ciphertext
  const iv = encryptedData.slice(0, 12)
  const authTag = encryptedData.slice(12, 28)
  const ciphertext = encryptedData.slice(28)

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Combine ciphertext and auth tag for Web Crypto API
  const combinedCiphertext = new Uint8Array(ciphertext.length + authTag.length)
  combinedCiphertext.set(ciphertext, 0)
  combinedCiphertext.set(authTag, ciphertext.length)

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    combinedCiphertext
  )

  return new TextDecoder().decode(decrypted)
}

/**
 * Encrypt the refresh token using AES-256-GCM (for updating after refresh)
 */
async function encryptRefreshToken(plainToken: string): Promise<string> {
  const encryptionKey = Deno.env.get('XERO_TOKEN_ENCRYPTION_KEY')
  if (!encryptionKey) {
    throw new Error('XERO_TOKEN_ENCRYPTION_KEY not configured')
  }

  // Get the key
  let keyBytes: Uint8Array
  if (/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    keyBytes = new Uint8Array(encryptionKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  } else {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(encryptionKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
    keyBytes = new Uint8Array(hashBuffer)
  }

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  // Encrypt
  const encoder = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(plainToken)
  )

  // Extract ciphertext and auth tag
  const encryptedArray = new Uint8Array(encrypted)
  const ciphertext = encryptedArray.slice(0, -16)
  const authTag = encryptedArray.slice(-16)

  // Combine: iv (12) + authTag (16) + ciphertext
  const result = new Uint8Array(iv.length + authTag.length + ciphertext.length)
  result.set(iv, 0)
  result.set(authTag, 12)
  result.set(ciphertext, 28)

  return base64Encode(result)
}

/**
 * Refresh the Xero access token
 */
async function refreshXeroToken(refreshToken: string): Promise<XeroTokenResponse> {
  const clientId = Deno.env.get('XERO_CLIENT_ID')
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('XERO_CLIENT_ID or XERO_CLIENT_SECRET not configured')
  }

  const credentials = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Xero token refresh failed:', response.status, errorText)
    throw new Error(`Xero token refresh failed: ${response.status}`)
  }

  return await response.json()
}

/**
 * Get Xero connection from database, refreshing token if needed
 */
async function getXeroConnection(supabase: any): Promise<{ accessToken: string; tenantId: string } | null> {
  // Fetch the stored connection
  const { data: connection, error } = await supabase
    .from('xero_connections')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !connection) {
    console.error('No Xero connection found:', error?.message)
    return null
  }

  const conn = connection as XeroConnection
  const expiresAt = new Date(conn.expires_at).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  // If token is about to expire (within 5 minutes), refresh it
  if (expiresAt < now + fiveMinutes) {
    console.log('Xero access token expired or expiring soon, refreshing...')
    
    try {
      // Decrypt the refresh token
      const decryptedRefreshToken = await decryptRefreshToken(conn.refresh_token_enc)
      
      // Refresh the access token
      const newTokens = await refreshXeroToken(decryptedRefreshToken)
      
      // Encrypt the new refresh token
      const encryptedRefreshToken = await encryptRefreshToken(newTokens.refresh_token)
      
      // Calculate new expiry
      const newExpiresAt = new Date(now + newTokens.expires_in * 1000).toISOString()
      
      // Update the connection in database
      const { error: updateError } = await supabase
        .from('xero_connections')
        .update({
          access_token: newTokens.access_token,
          refresh_token_enc: encryptedRefreshToken,
          expires_at: newExpiresAt,
          scopes: (newTokens.scope || '').split(/[\s,]+/).filter(Boolean),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', conn.tenant_id)

      if (updateError) {
        console.error('Failed to update Xero connection:', updateError.message)
        throw new Error('Failed to update Xero connection')
      }

      console.log('Xero token refreshed successfully')
      return { accessToken: newTokens.access_token, tenantId: conn.tenant_id }
    } catch (err) {
      console.error('Failed to refresh Xero token:', err)
      // Try using the existing token anyway (might still work)
      return { accessToken: conn.access_token, tenantId: conn.tenant_id }
    }
  }

  return { accessToken: conn.access_token, tenantId: conn.tenant_id }
}

/**
 * Fetch P&L data directly from Xero API
 */
async function fetchPnlFromXero(
  accessToken: string,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const params = new URLSearchParams({
    fromDate: startDate,
    toDate: endDate,
  })
  
  const url = `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?${params.toString()}`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Xero P&L API failed:', response.status, errorText)
    throw new Error(`Xero P&L failed: ${response.status}`)
  }

  return await response.json()
}

/**
 * Parse the Xero P&L response into our normalized format
 * (Same parsing logic as backend)
 */
function parseXeroPnl(data: any, startDate: string, endDate: string): any {
  let incomeTotal = 0
  let expenseTotal = 0
  const categories: Record<string, number> = {}
  const uncategorized: any[] = []

  const rows = (data?.Reports?.[0]?.Rows || []) as any[]

  const parseAmount = (s: any): number => {
    if (s == null) return 0
    const str = String(s).replace(/[,\s]/g, '')
    if (!str) return 0
    const negative = /^\(.*\)$/.test(str)
    const cleaned = str.replace(/[()]/g, '')
    const n = Number(cleaned)
    return negative ? -Math.abs(n) : n
  }

  // Track the current section name for COGS section detection
  function walk(rows: any[], sectionName: string | null) {
    for (const r of rows) {
      if (r.RowType === 'Section') {
        const title = (r.Title || '').toLowerCase()
        // Pass the section title down for context
        walk(r.Rows || [], r.Title || sectionName)
      } else if (r.RowType === 'Row' && r.Cells) {
        const label = (r.Cells[0]?.Value || '').toLowerCase()
        const amount = parseAmount(r.Cells[1]?.Value)

        // Skip summary/total rows
        if (label === 'gross profit' || label === 'net profit' || label.startsWith('total ')) {
          continue
        }

        const sectionL = (sectionName || '').toLowerCase()

        // Same logic as backend: income sections vs everything else (expense)
        const isIncome = sectionL.includes('revenue') || sectionL.includes('income')
        const isExpense = !isIncome && sectionL !== ''

        if (isIncome) {
          incomeTotal += amount
        } else if (isExpense) {
          expenseTotal += Math.abs(amount)

          // Categorize expenses - patterns must match mapping.ts in apps/api/src/xero/
          let category = 'other'
          if (label.includes('w&s') || label.includes('wage') || label.includes('salary') || label.includes('salaries') || label.includes('payroll') || label.includes('staff') || label.includes('superannuation') || label.includes('super ')) {
            category = 'wages'
          } else if (label.includes('cost of goods') || label.includes('cogs') || label.includes('purchases') || label.includes('stock')) {
            category = 'cogs'
          } else if (label.includes('security')) {
            category = 'security'
          }

          // Also check section name for COGS (Direct Costs, Cost of Sales sections)
          // Same as backend routes.ts lines 218-226
          if (category === 'other' &&
              (sectionL.includes('cost of sales') ||
               sectionL.includes('cost of goods') ||
               sectionL.includes('direct costs'))) {
            category = 'cogs'
          }

          categories[category] = (categories[category] || 0) + Math.abs(amount)
          if (category === 'other') {
            uncategorized.push({ label, amount })
          }
        }
      } else if (r.RowType === 'SummaryRow' && r.Cells) {
        // Skip summary rows, we calculate our own totals
      }
    }
  }

  walk(rows, null)

  const netProfit = incomeTotal - expenseTotal

  console.log('Parsed Xero P&L:', {
    incomeTotal,
    expenseTotal,
    netProfit,
    categories,
  })

  return {
    period: { start: startDate, end: endDate },
    totals: {
      revenue: incomeTotal,
      expenses: expenseTotal,
      netProfit,
    },
    categories,
    uncategorized,
  }
}

interface BusinessPerformanceData {
  period: {
    start: string
    end: string
  }
  current: {
    revenue: number
    netProfit: number
    netProfitMargin: number
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
    netProfit: number
    netProfitMargin: number
    wages: number
    wagesPercent: number
    cogs: number
    cogsPercent: number
    security: number
    securityPercent: number
  }
  changes: {
    revenuePercent: number
    netProfitPercent: number
    wagesPercentChange: number
    cogsPercentChange: number
    securityPercentChange: number
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
const DASHBOARD_URL = 'https://gm-dashboard.getproductbox.com'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

function calculatePercentChange(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0
}

/**
 * Calculate date ranges for 7-day period
 */
function calculateDateRanges(): {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
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

  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd,
  }
}

/**
 * Fetch P&L data directly from Xero API
 */
async function fetchPnlData(supabase: any, startDate: Date, endDate: Date): Promise<any> {
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]
  
  try {
    console.log(`Fetching P&L data from Xero: ${startDateStr} to ${endDateStr}`)
    
    // Get Xero connection (will refresh token if needed)
    const xeroConnection = await getXeroConnection(supabase)
    
    if (!xeroConnection) {
      console.error('No Xero connection available')
      return null
    }
    
    // Fetch raw P&L from Xero
    const rawPnl = await fetchPnlFromXero(
      xeroConnection.accessToken,
      xeroConnection.tenantId,
      startDateStr,
      endDateStr
    )
    
    // Parse into our format
    const parsedPnl = parseXeroPnl(rawPnl, startDateStr, endDateStr)
    
    console.log('P&L data parsed:', JSON.stringify(parsedPnl))
    return parsedPnl
  } catch (error) {
    console.error('Error fetching P&L data from Xero:', error)
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

  // Fetch P&L data for both periods (direct from Xero)
  const [currentPnl, previousPnl, currentMetrics, previousMetrics] = await Promise.all([
    fetchPnlData(supabase, dateRanges.currentStart, dateRanges.currentEnd),
    fetchPnlData(supabase, dateRanges.previousStart, dateRanges.previousEnd),
    fetchRevenueAndAttendance(supabase, dateRanges.currentStart, dateRanges.currentEnd),
    fetchRevenueAndAttendance(supabase, dateRanges.previousStart, dateRanges.previousEnd),
  ])

  // Revenue from Square is in cents GST-inclusive
  const currentRevenueCents = currentMetrics.revenue
  const previousRevenueCents = previousMetrics.revenue
  
  // Convert to GST-exclusive dollars (same as dashboard/financialService)
  const currentRevenue = (currentRevenueCents / 100) / 1.1
  const previousRevenue = (previousRevenueCents / 100) / 1.1

  // P&L data from Xero is already in dollars GST-exclusive (parsed via parseXeroPnl)
  // Use Xero revenue if available, otherwise use Square revenue
  const currentXeroRevenue = currentPnl?.totals?.revenue || 0
  const previousXeroRevenue = previousPnl?.totals?.revenue || 0
  
  // For display, prefer Xero revenue if available as it may be more accurate
  const displayCurrentRevenue = currentXeroRevenue > 0 ? currentXeroRevenue : currentRevenue
  const displayPreviousRevenue = previousXeroRevenue > 0 ? previousXeroRevenue : previousRevenue

  const currentWages = currentPnl?.categories?.wages || 0
  const currentCogs = currentPnl?.categories?.cogs || 0
  const currentSecurity = currentPnl?.categories?.security || 0
  const currentExpenses = currentPnl?.totals?.expenses || 0
  const currentNetProfitFromXero = currentPnl?.totals?.netProfit

  const previousWages = previousPnl?.categories?.wages || 0
  const previousCogs = previousPnl?.categories?.cogs || 0
  const previousSecurity = previousPnl?.categories?.security || 0
  const previousExpenses = previousPnl?.totals?.expenses || 0
  const previousNetProfitFromXero = previousPnl?.totals?.netProfit

  // Use Xero's net profit if available, otherwise calculate from revenue - expenses
  const currentNetProfit = currentNetProfitFromXero !== undefined && currentNetProfitFromXero !== 0
    ? currentNetProfitFromXero 
    : displayCurrentRevenue - currentExpenses
  const previousNetProfit = previousNetProfitFromXero !== undefined && previousNetProfitFromXero !== 0
    ? previousNetProfitFromXero 
    : displayPreviousRevenue - previousExpenses

  const currentNetProfitMargin = displayCurrentRevenue > 0 ? (currentNetProfit / displayCurrentRevenue) * 100 : 0
  const previousNetProfitMargin = displayPreviousRevenue > 0 ? (previousNetProfit / displayPreviousRevenue) * 100 : 0

  // Calculate cost percentages (costs as % of revenue)
  const currentWagesPercent = displayCurrentRevenue > 0 ? (currentWages / displayCurrentRevenue) * 100 : 0
  const currentCogsPercent = displayCurrentRevenue > 0 ? (currentCogs / displayCurrentRevenue) * 100 : 0
  const currentSecurityPercent = displayCurrentRevenue > 0 ? (currentSecurity / displayCurrentRevenue) * 100 : 0

  const previousWagesPercent = displayPreviousRevenue > 0 ? (previousWages / displayPreviousRevenue) * 100 : 0
  const previousCogsPercent = displayPreviousRevenue > 0 ? (previousCogs / displayPreviousRevenue) * 100 : 0
  const previousSecurityPercent = displayPreviousRevenue > 0 ? (previousSecurity / displayPreviousRevenue) * 100 : 0

  // Spend per head in dollars (GST-inclusive for customer-facing metric)
  const currentSpendPerHead = currentMetrics.attendance > 0 
    ? (currentRevenueCents / 100) / currentMetrics.attendance 
    : 0

  // Calculate changes
  const revenuePercent = calculatePercentChange(displayCurrentRevenue, displayPreviousRevenue)
  const netProfitPercent = calculatePercentChange(currentNetProfit, previousNetProfit)
  const wagesPercentChange = currentWagesPercent - previousWagesPercent  // Absolute change in percentage points
  const cogsPercentChange = currentCogsPercent - previousCogsPercent
  const securityPercentChange = currentSecurityPercent - previousSecurityPercent

  console.log('Business Performance Data:', {
    displayCurrentRevenue,
    currentNetProfit,
    currentWages,
    currentCogs,
    currentSecurity,
    currentWagesPercent,
    currentCogsPercent,
    currentSecurityPercent
  })

  return {
    period: {
      start: formatDate(dateRanges.currentStart),
      end: formatDate(dateRanges.currentEnd),
    },
    current: {
      revenue: Math.round(displayCurrentRevenue * 100), // Store as cents for formatCurrency
      netProfit: Math.round(currentNetProfit * 100),
      netProfitMargin: currentNetProfitMargin,
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
      netProfit: Math.round(previousNetProfit * 100),
      netProfitMargin: previousNetProfitMargin,
      wages: Math.round(previousWages * 100),
      wagesPercent: previousWagesPercent,
      cogs: Math.round(previousCogs * 100),
      cogsPercent: previousCogsPercent,
      security: Math.round(previousSecurity * 100),
      securityPercent: previousSecurityPercent,
    },
    changes: {
      revenuePercent,
      netProfitPercent,
      wagesPercentChange,
      cogsPercentChange,
      securityPercentChange,
    },
  }
}

function generateWhatsAppMessage(data: BusinessPerformanceData): string {
  return `📊 Business Performance (${data.period.start} - ${data.period.end})

Revenue: ${formatCurrency(data.current.revenue)} (${formatPercent(data.changes.revenuePercent)})
Net Profit: ${formatCurrency(data.current.netProfit)} (${data.current.netProfitMargin.toFixed(1)}% margin)
Wages: ${data.current.wagesPercent.toFixed(1)}% of revenue
COGS: ${data.current.cogsPercent.toFixed(1)}% of revenue
Security: ${data.current.securityPercent.toFixed(1)}% of revenue`
}

async function generateAIEmail(data: BusinessPerformanceData): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const prompt = `You are a nightlife venue financial analyst providing weekly business performance insights.

Analyze the following P&L data and create a comprehensive HTML email report:

**Current Week (${data.period.start} - ${data.period.end}):**
- Revenue: ${formatCurrency(data.current.revenue)}
- Net Profit: ${formatCurrency(data.current.netProfit)} (${data.current.netProfitMargin.toFixed(1)}% margin)
- Wages: ${formatCurrency(data.current.wages)} (${data.current.wagesPercent.toFixed(1)}% of revenue)
- COGS: ${formatCurrency(data.current.cogs)} (${data.current.cogsPercent.toFixed(1)}% of revenue)
- Security: ${formatCurrency(data.current.security)} (${data.current.securityPercent.toFixed(1)}% of revenue)
- Attendance: ${data.current.attendance} people
- Spend per Head: ${formatCurrency(data.current.spendPerHead)}

**Previous Week Comparison:**
- Revenue: ${formatCurrency(data.previous.revenue)} (${formatPercent(data.changes.revenuePercent)})
- Net Profit: ${formatCurrency(data.previous.netProfit)} (${data.previous.netProfitMargin.toFixed(1)}% margin, ${formatPercent(data.changes.netProfitPercent)})
- Wages: ${data.previous.wagesPercent.toFixed(1)}% of revenue (${formatPercent(data.changes.wagesPercentChange)})
- COGS: ${data.previous.cogsPercent.toFixed(1)}% of revenue (${formatPercent(data.changes.cogsPercentChange)})
- Security: ${data.previous.securityPercent.toFixed(1)}% of revenue (${formatPercent(data.changes.securityPercentChange)})

CRITICAL: Return ONLY the HTML code with NO markdown code blocks, NO explanations, NO \`\`\`html tags. Start directly with the HTML.

Structure the email as:

1. **Header Section**: 
   - Title: "Weekly Business Performance Report" (large, bold, black color)
   - Date range subtitle (${data.period.start} - ${data.period.end})

2. **Executive Summary** (2-3 sentences on overall financial health and key trends)

3. **P&L Metrics Table** with columns:
   - Metric name
   - Current Week value
   - % of Revenue (for costs)
   - Previous Week comparison
   - Change indicator
   
   Include these rows: Revenue, Net Profit (with margin %), Wages, COGS, Security

4. **Cost Efficiency Analysis**
   - Are wages/COGS/security percentages trending well?
   - Which costs are under control vs need attention?
   - Profit margin health assessment

5. **Operational Insights**
   - Attendance vs revenue relationship
   - Spend per head trends
   - Overall business efficiency

6. **Strategic Recommendations** (2-3 specific, actionable suggestions for cost management or revenue optimization)

7. **Call-to-Action Button**: "View Full Dashboard" linking to ${DASHBOARD_URL}

**Styling Guidelines - Clean Professional Look:**
- **Background**: #ffffff (white) for body
- **Text Colors**: 
  - Section Headers: #1e293b (dark slate, bold, large)
  - Body text: #334155 (slate gray)
  - Secondary text: #64748b (muted gray)
- **Table Styling**: 
  - Header row: #475569 (slate gray) background with #ffffff (white) text
  - Data rows: Alternating #f8fafc and #ffffff backgrounds with #334155 text
  - Borders: #e2e8f0 (light gray border)
- **Visual Indicators**: ✅ for positive trends, ⚠️ for concerning trends
- **Color Coding for Changes**: 
  - Positive (revenue/profit up, costs down): #16a34a (green)
  - Negative (revenue/profit down, costs up): #dc2626 (red)  
  - Neutral: #64748b (gray)
- **CTA Button**: Background #f97316 (orange), #ffffff (white) text color, rounded corners, no gradient
- **Typography**: Use system fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)
- Mobile-responsive design
- Keep under 500 words
- DO NOT use dark backgrounds

**Tone:** Professional and analytical. Focus on financial efficiency and cost management insights.

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
            content: 'You are a venue financial analyst. Generate professional HTML email reports with P&L insights and cost analysis. Return ONLY raw HTML code with no markdown formatting, no code blocks, and no explanations.',
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
    htmlContent = htmlContent.replace(/^```html\n?/i, '')
    htmlContent = htmlContent.replace(/\n?```\s*$/i, '')
    htmlContent = htmlContent.trim()
    
    return htmlContent
  } catch (error) {
    console.error('Error generating AI email:', error)
    throw error
  }
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
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html,
        from: 'GM Dashboard <phil@manorleederville.com>',
        template: EMAIL_TEMPLATE,
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
      const emailHtml = await generateAIEmail(performanceData)
      
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
      console.log('Generating AI email content...')
      const emailHtml = await generateAIEmail(performanceData)
      const subject = `Business Performance Report: ${performanceData.period.start} - ${performanceData.period.end}`

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
