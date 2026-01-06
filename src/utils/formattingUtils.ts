/**
 * Unified formatting utilities for booking-related data
 * Consolidates formatting logic used across booking components
 */

/**
 * Formats venue name for display
 */
export const formatVenue = (venue: string): string => {
  return venue === 'manor' ? 'Manor' : 'Hippie Club';
};

/**
 * Formats booking type for display
 * Handles karaoke bookings (both new and legacy formats)
 */
export const formatBookingType = (type: string, venueArea?: string | null): string => {
  if (type === 'karaoke_booking') {
    return 'Karaoke Booking';
  }
  if (type === 'venue_hire' && venueArea === 'karaoke') {
    return 'Karaoke Booking'; // Fallback for old records
  }
  return type === 'venue_hire' ? 'Venue Hire' : 'VIP Tickets';
};

/**
 * Formats booking type using generic replacement (for simple cases)
 */
export const formatBookingTypeSimple = (type: string | null): string => {
  if (!type) return 'N/A';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Formats venue area for display
 */
export const formatVenueArea = (area: string | null): string => {
  if (!area) return '';
  if (area === 'karaoke') return 'Karaoke';
  return area.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Gets status badge color classes for booking status
 * Returns Tailwind CSS classes for status badges
 */
export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'confirmed': 
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200';
    case 'pending': 
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200';
    case 'cancelled': 
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200';
    case 'completed': 
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200';
    case 'no-show':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: 
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gm-neutral-800 dark:text-gm-neutral-200';
  }
};

/**
 * Formats duration for display
 * Handles both durationHours and time range formats
 */
export const formatDuration = (
  durationHours: number | null, 
  startTime: string | null, 
  endTime: string | null
): string => {
  if (durationHours) {
    return `${durationHours}h`;
  }
  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  }
  return 'All day';
};

/**
 * Capitalizes the first letter of a status string
 */
export const capitalizeStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

