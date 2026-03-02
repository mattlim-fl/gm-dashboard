import { Checkbox } from '@/components/ui/checkbox';
import { ALL_VENUES, VENUE_LABELS, Venue } from '@/contexts/VenueContext';

interface VenueCheckboxListProps {
  selectedVenues: Venue[];
  onVenueToggle: (venue: Venue, checked: boolean | 'indeterminate') => void;
  idPrefix?: string;
}

export function VenueCheckboxList({
  selectedVenues,
  onVenueToggle,
  idPrefix = 'venue',
}: VenueCheckboxListProps) {
  return (
    <div className="space-y-2">
      {ALL_VENUES.map((venue) => (
        <div key={venue} className="flex items-center space-x-2">
          <Checkbox
            id={`${idPrefix}-${venue}`}
            checked={selectedVenues.includes(venue)}
            onCheckedChange={(checked) => onVenueToggle(venue, checked)}
          />
          <label
            htmlFor={`${idPrefix}-${venue}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {VENUE_LABELS[venue]}
          </label>
        </div>
      ))}
    </div>
  );
}
