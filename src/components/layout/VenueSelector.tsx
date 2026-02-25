import React from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useVenue, VENUE_LABELS, VenueSelection, Venue } from '@/contexts/VenueContext';

export function VenueSelector() {
  const { accessibleVenues, selectedVenue, setSelectedVenue, loading, hasMultipleVenues } = useVenue();

  // Don't render if loading, no venues, or only one venue
  if (loading || accessibleVenues.length === 0) {
    return null;
  }

  // If only one venue, show it as a static badge instead of a dropdown
  if (!hasMultipleVenues) {
    const singleVenue = accessibleVenues[0];
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gm-neutral-600 bg-gm-neutral-100 rounded-md">
        <Building2 className="h-4 w-4" />
        <span>{VENUE_LABELS[singleVenue]}</span>
      </div>
    );
  }

  const getLabel = (venue: VenueSelection) => {
    if (venue === 'all') return 'All Venues';
    return VENUE_LABELS[venue];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>{getLabel(selectedVenue)}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => setSelectedVenue('all')}
          className="flex items-center justify-between"
        >
          <span>All Venues</span>
          {selectedVenue === 'all' && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        {accessibleVenues.map((venue) => (
          <DropdownMenuItem
            key={venue}
            onClick={() => setSelectedVenue(venue)}
            className="flex items-center justify-between"
          >
            <span>{VENUE_LABELS[venue]}</span>
            {selectedVenue === venue && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
