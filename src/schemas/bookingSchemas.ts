/**
 * Shared Zod schemas for booking forms
 * Consolidates validation logic across all booking-related forms
 */

import * as z from "zod";

/**
 * Base booking schema with common fields
 * Can be extended for create/update/quick forms
 */
export const baseBookingSchema = z.object({
  customerName: z.string().min(2, "Customer name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  customerPhone: z.string().optional().or(z.literal("")),
  bookingType: z.enum(["venue_hire", "vip_tickets", "karaoke_booking"], {
    required_error: "Please select a booking type"
  }),
  venue: z.enum(["manor", "hippie"], {
    required_error: "Please select a venue"
  }),
  venueArea: z.enum(["upstairs", "downstairs", "full_venue"]).optional(),
  karaokeBoothId: z.string().optional(),
  bookingDate: z.string().min(1, "Please select a date"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  guestCount: z.string().optional(),
  ticketQuantity: z.string().optional(),
  specialRequests: z.string().optional(),
  totalAmount: z.string().optional(),
  costPerTicket: z.string().optional(),
  staffNotes: z.string().optional(),
});

/**
 * Schema for creating a new booking
 * Includes all validation rules for booking creation
 */
export const createBookingSchema = baseBookingSchema
  .refine((data) => {
    // At least one contact method required
    return data.customerEmail || data.customerPhone;
  }, {
    message: "Please provide either email or phone number",
    path: ["customerEmail"],
  })
  .refine((data) => {
    // Venue area required for venue hire
    if (data.bookingType === "venue_hire" && !data.venueArea) {
      return false;
    }
    return true;
  }, {
    message: "Please select a venue area for venue hire bookings",
    path: ["venueArea"],
  })
  .refine((data) => {
    // Ticket quantity required for VIP tickets
    if (data.bookingType === "vip_tickets" && !data.ticketQuantity) {
      return false;
    }
    return true;
  }, {
    message: "Please specify ticket quantity for VIP ticket bookings",
    path: ["ticketQuantity"],
  })
  .refine((data) => {
    // Guest count required for venue hire
    if (data.bookingType === "venue_hire" && !data.guestCount) {
      return false;
    }
    return true;
  }, {
    message: "Please specify number of guests for venue hire bookings",
    path: ["guestCount"],
  })
  .refine((data) => {
    // Karaoke booth required for karaoke bookings
    if (data.bookingType === "karaoke_booking" && !data.karaokeBoothId) {
      return false;
    }
    return true;
  }, {
    message: "Please select a karaoke booth for karaoke bookings",
    path: ["karaokeBoothId"],
  });

/**
 * Schema for unified booking side panel
 * Allows optional customerId and makes some fields optional for progressive form filling
 */
export const unifiedBookingSchema = baseBookingSchema
  .extend({
    customerId: z.string().optional(),
    customerName: z.string().min(2, "Customer name must be at least 2 characters").optional(),
  })
  .refine((data) => {
    // Venue is required
    return data.venue !== undefined;
  }, {
    message: "Please select a venue",
    path: ["venue"],
  })
  .refine((data) => {
    // Booking type is required
    return data.bookingType !== undefined;
  }, {
    message: "Please select a booking type",
    path: ["bookingType"],
  })
  .refine((data) => {
    // Either customerId or customerName must be provided
    return data.customerId || (data.customerName && data.customerName.length >= 2);
  }, {
    message: "Please select a customer or enter customer name",
    path: ["customerName"],
  })
  .refine((data) => {
    // At least one contact method required (unless customerId is provided)
    if (data.customerId) return true;
    return data.customerEmail || data.customerPhone;
  }, {
    message: "Please provide either email or phone number",
    path: ["customerEmail"],
  })
  .refine((data) => {
    // Venue area required for venue hire
    if (data.bookingType === "venue_hire" && !data.venueArea) {
      return false;
    }
    return true;
  }, {
    message: "Please select a venue area for venue hire bookings",
    path: ["venueArea"],
  })
  .refine((data) => {
    // Ticket quantity required for VIP tickets
    if (data.bookingType === "vip_tickets" && !data.ticketQuantity) {
      return false;
    }
    return true;
  }, {
    message: "Please specify ticket quantity for VIP ticket bookings",
    path: ["ticketQuantity"],
  })
  .refine((data) => {
    // Guest count required for venue hire and karaoke
    if ((data.bookingType === "venue_hire" || data.bookingType === "karaoke_booking") && !data.guestCount) {
      return false;
    }
    return true;
  }, {
    message: "Please specify number of guests",
    path: ["guestCount"],
  })
  .refine((data) => {
    // Karaoke booth required for karaoke bookings
    if (data.bookingType === "karaoke_booking" && !data.karaokeBoothId) {
      return false;
    }
    return true;
  }, {
    message: "Please select a karaoke booth for karaoke bookings",
    path: ["karaokeBoothId"],
  });

/**
 * Schema for updating an existing booking
 * Includes status field and makes venue/bookingType required
 * Note: venueArea includes "karaoke" for backward compatibility with old records
 */
export const updateBookingSchema = baseBookingSchema
  .extend({
    status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
    venueArea: z.enum(["upstairs", "downstairs", "full_venue", "karaoke"]).optional(),
  })
  .refine((data) => {
    return data.customerEmail || data.customerPhone;
  }, {
    message: "Please provide either email or phone number",
    path: ["customerEmail"],
  });

/**
 * Schema for quick booking form
 * Simplified schema for fast booking entry
 */
export const quickBookingSchema = z.object({
  customerName: z.string().min(2, "Name required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  bookingType: z.enum(["vip_tickets", "karaoke_booking", "venue_hire"]),
  venue: z.enum(["manor", "hippie"]),
  quantity: z.string().min(1, "Required"),
  bookingDate: z.string().optional(),
}).refine((data) => {
  // Either email or phone must be provided
  return data.customerEmail || data.customerPhone;
}, {
  message: "Email or Phone required",
  path: ["customerEmail"],
});

// Type exports
export type CreateBookingFormValues = z.infer<typeof createBookingSchema>;
export type UnifiedBookingFormValues = z.infer<typeof unifiedBookingSchema>;
export type UpdateBookingFormValues = z.infer<typeof updateBookingSchema>;
export type QuickBookingFormValues = z.infer<typeof quickBookingSchema>;

