import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { VENUE_OPTIONS } from '@/constants/bookingConstants';

interface VenueCredentialSelectorProps {
  value: string;
  onChange: (venue: string) => void;
}

export function VenueCredentialSelector({ value, onChange }: VenueCredentialSelectorProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Label htmlFor="venue-select" className="text-sm font-medium whitespace-nowrap">
        Configure for:
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="venue-select" className="w-48">
          <SelectValue placeholder="Select venue" />
        </SelectTrigger>
        <SelectContent>
          {VENUE_OPTIONS.map((venue) => (
            <SelectItem key={venue.value} value={venue.value}>
              {venue.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
