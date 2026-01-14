import { format } from 'date-fns';

/**
 * Unified date formatting utilities
 * Consolidates all date formatting needs across the application
 */

/**
 * Formats a date to a full readable string (e.g., "Monday, January 15, 2024")
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formats a date to ISO format (YYYY-MM-DD) without timezone conversion
 * Useful for form inputs and database storage
 */
export function formatDateToISO(date: Date): string {
  // Return local date in YYYY-MM-DD without timezone conversion to avoid off-by-one issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date to a short readable string (e.g., "Jan 15, 2024")
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Formats a date string to UK format (e.g., "15 Jan 2024")
 * Used in booking tables and details
 */
export function formatDateUK(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Formats a date to short format using date-fns (e.g., "15/01")
 * Used in booking history
 */
export function formatDateCompact(dateString: string): string {
  return format(new Date(dateString), 'dd/MM');
}

/**
 * Formats a date to full readable format using date-fns (e.g., "Monday, January 15, 2024")
 * Used in booking history
 */
export function formatDateFull(dateString: string): string {
  return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
}

/**
 * Formats a time string (assumes HH:mm format)
 * Returns null if timeString is null/undefined
 */
export function formatTime(timeString: string | null | undefined): string | null {
  if (!timeString) return null;
  // Assuming time is in HH:mm format
  return timeString;
}

/**
 * Formats an hour (0-23) to 12-hour format with AM/PM
 * Used for scheduling and time display
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

/**
 * Formats a schedule with day of week and hour in AWST
 * Returns a human-readable schedule string
 */
export function formatSchedule(dayOfWeek: number | null, hourAwst: number | null): string {
  if (dayOfWeek === null || hourAwst === null) {
    return 'Not scheduled';
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = dayNames[dayOfWeek] || 'Unknown';
  const hour = formatHour(hourAwst);
  return `${day} at ${hour} AWST`;
} 