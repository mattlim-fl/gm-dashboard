/**
 * Centralized venue type definitions
 * Import from here instead of defining venue types locally
 */

export type Venue = 'manor' | 'hippie' | 'daisy';
export type VenueSelection = Venue | 'all';

export const ALL_VENUES: Venue[] = ['manor', 'hippie', 'daisy'];

export const VENUE_LABELS: Record<Venue, string> = {
  manor: 'Manor',
  hippie: 'Hippie Club',
  daisy: 'Daisy',
};

export const VENUE_OPTIONS = [
  { value: 'manor' as const, label: 'Manor' },
  { value: 'hippie' as const, label: 'Hippie Club' },
  { value: 'daisy' as const, label: 'Daisy' },
] as const;

/**
 * Get display label for a venue
 */
export function getVenueLabel(venue: Venue): string {
  return VENUE_LABELS[venue] || venue;
}
