/**
 * Centralized URL configuration
 * All external URLs should be defined here
 */

import type { Venue } from '@/types/venue';

/**
 * Public website URLs for each venue (production)
 */
export const VENUE_WEBSITE_URLS: Record<Venue, string> = {
  manor: 'https://manorleederville.com',
  hippie: 'https://hippieclub.com',
  daisys: 'https://daisyssocialclub.com',
};

/**
 * Local development project names for each venue UI
 */
const VENUE_DEV_PROJECT_NAMES: Record<Exclude<Venue, 'daisys'>, string> = {
  manor: 'manor-perth-nightlife-ui',
  hippie: 'hippie-club-ui',
};

/**
 * Check if we're running in local development
 */
function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Get the public website URL for a venue
 * In dev mode, returns localhost URL for the venue's UI project
 */
export function getVenueWebsiteUrl(venue: Venue): string {
  if (isLocalDev() && venue !== 'daisys') {
    const devProjectName = VENUE_DEV_PROJECT_NAMES[venue as Exclude<Venue, 'daisys'>];
    return window.location.origin.replace('gm-dashboard', devProjectName);
  }
  return VENUE_WEBSITE_URLS[venue];
}

/**
 * Get the guest list URL for a venue with an optional token
 */
export function getGuestListUrl(venue: Venue, token?: string): string {
  const baseUrl = getVenueWebsiteUrl(venue);
  if (token) {
    return `${baseUrl}/guest-list?token=${token}`;
  }
  return `${baseUrl}/guest-list`;
}
