/**
 * TypeScript types for Xero API responses
 * These types improve code safety and IDE support when working with Xero data
 */

// ============================================
// Xero Account Types
// ============================================

export interface XeroAccount {
  AccountID: string
  Code?: string
  Name: string
  Type?: string
  Status?: string
  Description?: string
  TaxType?: string
  Class?: string
  EnablePaymentsToAccount?: boolean
  ShowInExpenseClaims?: boolean
  BankAccountNumber?: string
  BankAccountType?: string
  CurrencyCode?: string
  ReportingCode?: string
  ReportingCodeName?: string
  HasAttachments?: boolean
  UpdatedDateUTC?: string
}

export interface XeroAccountsResponse {
  Accounts: XeroAccount[]
}

// ============================================
// Xero P&L Report Types
// ============================================

export interface XeroPnlCell {
  Value?: string | number
  Attributes?: Array<{
    Id?: string
    Value?: string
  }>
}

export interface XeroPnlRow {
  RowType: 'Header' | 'Section' | 'Row' | 'SummaryRow'
  Title?: string
  Cells?: XeroPnlCell[]
  Rows?: XeroPnlRow[]
}

export interface XeroPnlReport {
  ReportID?: string
  ReportName?: string
  ReportType?: string
  ReportTitles?: string[]
  ReportDate?: string
  UpdatedDateUTC?: string
  Rows?: XeroPnlRow[]
}

export interface XeroPnlResponse {
  Reports?: XeroPnlReport[]
}

// ============================================
// Parsed P&L Result Types
// ============================================

export interface PnlPeriod {
  start: string
  end: string
}

export interface PnlTotals {
  income: number
  expenses: number
  netProfit: number
}

export interface UncategorizedItem {
  name: string
  section: string | null
  amount: number
}

export interface PnlResult {
  period: PnlPeriod
  totals: PnlTotals
  categories: Record<string, number>
  uncategorized: UncategorizedItem[]
  raw?: XeroPnlResponse
}

export interface PnlResultWithMeta extends PnlResult {
  meta: {
    cached: boolean
    lastUpdated: string
  }
}

// ============================================
// Token Types
// ============================================

export interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

export interface XeroConnection {
  id: string
  authEventId: string
  tenantId: string
  tenantType: string
  tenantName: string
  createdDateUtc: string
  updatedDateUtc: string
}

// ============================================
// Stored Connection Types
// ============================================

export interface StoredConnection {
  id: string
  tenant_id: string
  access_token: string
  refresh_token_enc: string
  expires_at: string
  scopes: string[]
  created_at?: string
  updated_at?: string
}

// ============================================
// Helper Type Guards
// ============================================

export function isXeroPnlRow(row: unknown): row is XeroPnlRow {
  if (typeof row !== 'object' || row === null) return false
  const r = row as Record<string, unknown>
  return typeof r.RowType === 'string'
}

export function hasValidCells(row: XeroPnlRow): row is XeroPnlRow & { Cells: XeroPnlCell[] } {
  return Array.isArray(row.Cells) && row.Cells.length > 0
}
