/**
 * Zod schemas for API response validation
 * Ensures runtime type safety for external API responses
 */

// @ts-expect-error - Deno remote import
import { z } from "https://esm.sh/zod@3.22.4"

// Re-export z for convenience
export { z }

// ============================================
// Square API Schemas
// ============================================

/**
 * Square Money object schema
 */
export const SquareMoneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
})

export type SquareMoney = z.infer<typeof SquareMoneySchema>

/**
 * Square Payment status enum
 */
export const SquarePaymentStatusSchema = z.enum([
  "APPROVED",
  "PENDING",
  "COMPLETED",
  "CANCELED",
  "FAILED",
])

export type SquarePaymentStatus = z.infer<typeof SquarePaymentStatusSchema>

/**
 * Square Payment object schema
 */
export const SquarePaymentSchema = z.object({
  id: z.string(),
  status: SquarePaymentStatusSchema.optional(),
  amount_money: SquareMoneySchema.optional(),
  total_money: SquareMoneySchema.optional(),
  source_type: z.string().optional(),
  card_details: z.object({
    card: z.object({
      card_brand: z.string().optional(),
      last_4: z.string().optional(),
    }).optional(),
  }).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  location_id: z.string().optional(),
  order_id: z.string().optional(),
})

export type SquarePayment = z.infer<typeof SquarePaymentSchema>

/**
 * Square Payments API response schema
 */
export const SquarePaymentResponseSchema = z.object({
  payment: SquarePaymentSchema.optional(),
  errors: z.array(z.object({
    category: z.string(),
    code: z.string(),
    detail: z.string().optional(),
    field: z.string().optional(),
  })).optional(),
})

export type SquarePaymentResponse = z.infer<typeof SquarePaymentResponseSchema>

/**
 * Square Refund status enum
 */
export const SquareRefundStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FAILED",
])

export type SquareRefundStatus = z.infer<typeof SquareRefundStatusSchema>

/**
 * Square Refund object schema
 */
export const SquareRefundSchema = z.object({
  id: z.string(),
  status: SquareRefundStatusSchema.optional(),
  amount_money: SquareMoneySchema.optional(),
  payment_id: z.string().optional(),
  reason: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  location_id: z.string().optional(),
})

export type SquareRefund = z.infer<typeof SquareRefundSchema>

/**
 * Square Refunds API response schema
 */
export const SquareRefundResponseSchema = z.object({
  refund: SquareRefundSchema.optional(),
  errors: z.array(z.object({
    category: z.string(),
    code: z.string(),
    detail: z.string().optional(),
    field: z.string().optional(),
  })).optional(),
})

export type SquareRefundResponse = z.infer<typeof SquareRefundResponseSchema>

/**
 * Square Order line item schema
 */
export const SquareOrderLineItemSchema = z.object({
  uid: z.string().optional(),
  name: z.string().optional(),
  quantity: z.string(),
  base_price_money: SquareMoneySchema.optional(),
  total_money: SquareMoneySchema.optional(),
})

export type SquareOrderLineItem = z.infer<typeof SquareOrderLineItemSchema>

/**
 * Square Order object schema
 */
export const SquareOrderSchema = z.object({
  id: z.string(),
  location_id: z.string().optional(),
  line_items: z.array(SquareOrderLineItemSchema).optional(),
  total_money: SquareMoneySchema.optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type SquareOrder = z.infer<typeof SquareOrderSchema>

/**
 * Square Orders API response schema
 */
export const SquareOrderResponseSchema = z.object({
  order: SquareOrderSchema.optional(),
  errors: z.array(z.object({
    category: z.string(),
    code: z.string(),
    detail: z.string().optional(),
    field: z.string().optional(),
  })).optional(),
})

export type SquareOrderResponse = z.infer<typeof SquareOrderResponseSchema>

/**
 * Square Error schema (for all API responses)
 */
export const SquareErrorSchema = z.object({
  category: z.string(),
  code: z.string(),
  detail: z.string().optional(),
  field: z.string().optional(),
})

export type SquareError = z.infer<typeof SquareErrorSchema>

// ============================================
// Validation Helpers
// ============================================

/**
 * Safely parse a Square payment response
 */
export function parseSquarePaymentResponse(data: unknown): SquarePaymentResponse {
  return SquarePaymentResponseSchema.parse(data)
}

/**
 * Safely parse a Square refund response
 */
export function parseSquareRefundResponse(data: unknown): SquareRefundResponse {
  return SquareRefundResponseSchema.parse(data)
}

/**
 * Safely parse a Square order response
 */
export function parseSquareOrderResponse(data: unknown): SquareOrderResponse {
  return SquareOrderResponseSchema.parse(data)
}

/**
 * Extract error message from Square API response
 */
export function extractSquareError(data: unknown): string | null {
  try {
    const parsed = z.object({
      errors: z.array(SquareErrorSchema).optional(),
      message: z.string().optional(),
    }).parse(data)

    if (parsed.errors && parsed.errors.length > 0) {
      return parsed.errors[0].detail || parsed.errors[0].code
    }
    if (parsed.message) {
      return parsed.message
    }
    return null
  } catch {
    return null
  }
}

// ============================================
// Booking Schemas (for Supabase responses)
// ============================================

/**
 * Booking response from Supabase
 */
export const BookingResponseSchema = z.object({
  id: z.string().uuid(),
  reference_code: z.string().optional(),
  share_token: z.string().optional().nullable(),
})

export type BookingResponse = z.infer<typeof BookingResponseSchema>

/**
 * Parse booking response (handles array or single object)
 */
export function parseBookingResponse(data: unknown): BookingResponse {
  const arrayOrObject = z.union([
    z.array(BookingResponseSchema),
    BookingResponseSchema,
  ]).parse(data)

  if (Array.isArray(arrayOrObject)) {
    if (arrayOrObject.length === 0) {
      throw new Error("Empty booking response")
    }
    return arrayOrObject[0]
  }
  return arrayOrObject
}

// ============================================
// Xero API Schemas
// ============================================

/**
 * Xero P&L Report Cell schema
 */
export const XeroPnlCellSchema = z.object({
  Value: z.union([z.string(), z.number()]).optional(),
  Attributes: z.array(z.object({
    Id: z.string().optional(),
    Value: z.string().optional(),
  })).optional(),
})

export type XeroPnlCell = z.infer<typeof XeroPnlCellSchema>

/**
 * Xero P&L Report Row schema
 */
export const XeroPnlRowSchema: z.ZodType<{
  RowType: string
  Title?: string
  Cells?: z.infer<typeof XeroPnlCellSchema>[]
  Rows?: unknown[]
}> = z.object({
  RowType: z.string(),
  Title: z.string().optional(),
  Cells: z.array(XeroPnlCellSchema).optional(),
  Rows: z.array(z.lazy(() => XeroPnlRowSchema)).optional(),
})

export type XeroPnlRow = z.infer<typeof XeroPnlRowSchema>

/**
 * Xero P&L Report schema
 */
export const XeroPnlReportSchema = z.object({
  ReportID: z.string().optional(),
  ReportName: z.string().optional(),
  ReportType: z.string().optional(),
  ReportTitles: z.array(z.string()).optional(),
  ReportDate: z.string().optional(),
  UpdatedDateUTC: z.string().optional(),
  Rows: z.array(XeroPnlRowSchema).optional(),
})

export type XeroPnlReport = z.infer<typeof XeroPnlReportSchema>

/**
 * Xero Reports API response schema
 */
export const XeroReportsResponseSchema = z.object({
  Reports: z.array(XeroPnlReportSchema).optional(),
})

export type XeroReportsResponse = z.infer<typeof XeroReportsResponseSchema>

/**
 * Parse Xero P&L report response
 */
export function parseXeroReportsResponse(data: unknown): XeroReportsResponse {
  return XeroReportsResponseSchema.parse(data)
}
