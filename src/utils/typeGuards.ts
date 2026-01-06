/**
 * Type guard utilities for better type safety
 * Reduces need for type assertions by providing runtime type checking
 */

import { Venue, BookingType, VenueArea, BookingStatus } from "@/constants/bookingConstants";

/**
 * Type guard for venue values
 */
export const isVenue = (value: unknown): value is Venue => {
  return value === "manor" || value === "hippie";
};

/**
 * Type guard for booking type values
 */
export const isBookingType = (value: unknown): value is BookingType => {
  return value === "venue_hire" || value === "vip_tickets" || value === "karaoke_booking";
};

/**
 * Type guard for venue area values
 */
export const isVenueArea = (value: unknown): value is VenueArea => {
  return value === "upstairs" || value === "downstairs" || value === "full_venue";
};

/**
 * Type guard for booking status values
 */
export const isBookingStatus = (value: unknown): value is BookingStatus => {
  return value === "pending" || value === "confirmed" || value === "cancelled" || value === "completed";
};

/**
 * Safely converts a value to a venue, with fallback
 */
export const toVenue = (value: unknown, fallback: Venue = "manor"): Venue => {
  return isVenue(value) ? value : fallback;
};

/**
 * Safely converts a value to a booking type, with fallback
 */
export const toBookingType = (value: unknown, fallback: BookingType = "venue_hire"): BookingType => {
  return isBookingType(value) ? value : fallback;
};

/**
 * Safely converts a value to a venue area, with fallback
 */
export const toVenueArea = (value: unknown): VenueArea | undefined => {
  return isVenueArea(value) ? value : undefined;
};

/**
 * Safely converts a value to a booking status, with fallback
 */
export const toBookingStatus = (value: unknown, fallback: BookingStatus = "pending"): BookingStatus => {
  return isBookingStatus(value) ? value : fallback;
};

/**
 * Type guard for checking if a value is a valid number
 */
export const isNumber = (value: unknown): value is number => {
  return typeof value === "number" && !isNaN(value);
};

/**
 * Type guard for checking if a value is a non-empty string
 */
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

