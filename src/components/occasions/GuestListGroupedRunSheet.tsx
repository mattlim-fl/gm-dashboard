import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Search, Pencil, Check, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export interface RunSheetGuestItem {
  id: string;
  guestId: string | null;
  guestName: string;
  bookingId: string;
  ticketIndex: number;
  referenceCode: string;
  isChecked: boolean;
  isOrganiser: boolean;
  organiserName: string | null;
  booking: any;
}

interface GuestListGroupedRunSheetProps {
  guests: RunSheetGuestItem[];
  editingGuestId: string | null;
  editingGuestName: string;
  savingGuestName: boolean;
  onStartEditGuest: (id: string, name: string) => void;
  onSaveGuestName: (bookingId: string, ticketIndex: number, id: string, guestId: string | null) => void;
  onCancelEditGuest: () => void;
  onToggleCheckin: (bookingId: string, ticketIndex: number, currentChecked: boolean) => void;
  onSetEditingGuestName: (name: string) => void;
}

interface GroupedGuests {
  organiser: RunSheetGuestItem[];
  organiserGuests: RunSheetGuestItem[];
  purchasers: RunSheetGuestItem[];
}

export default function GuestListGroupedRunSheet({
  guests,
  editingGuestId,
  editingGuestName,
  savingGuestName,
  onStartEditGuest,
  onSaveGuestName,
  onCancelEditGuest,
  onToggleCheckin,
  onSetEditingGuestName,
}: GuestListGroupedRunSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    organiser: true,
    organiserGuests: true,
    purchasers: true,
  });

  // Categorize and filter guests
  const { organiser, organiserGuests, purchasers } = useMemo(() => {
    const grouped: GroupedGuests = {
      organiser: [],
      organiserGuests: [],
      purchasers: [],
    };

    guests.forEach((guest) => {
      // Filter by search query
      if (searchQuery && !guest.guestName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      // Categorize
      if (guest.isOrganiser) {
        grouped.organiser.push(guest);
      } else if (
        guest.organiserName === 'Staff Added' ||
        guest.organiserName?.toLowerCase().includes('staff') ||
        guest.organiserName?.toLowerCase().includes('walk-in')
      ) {
        grouped.organiserGuests.push(guest);
      } else {
        // Check if this guest's booking is from the organiser
        // For now, we'll put all non-staff guests in purchasers
        // You may need to adjust this logic based on your data structure
        grouped.purchasers.push(guest);
      }
    });

    return grouped;
  }, [guests, searchQuery]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderGuestRow = (guest: RunSheetGuestItem, idx: number, globalIdx: number) => {
    return (
      <tr
        key={guest.id}
        className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
          guest.isChecked ? 'opacity-60 bg-muted/20' : ''
        }`}
      >
        <td className="py-3 px-4 text-sm text-muted-foreground">{globalIdx + 1}</td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {editingGuestId === guest.id ? (
              <>
                <Input
                  value={editingGuestName}
                  onChange={(e) => onSetEditingGuestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSaveGuestName(guest.bookingId, guest.ticketIndex, guest.id, guest.guestId);
                    } else if (e.key === 'Escape') {
                      onCancelEditGuest();
                    }
                  }}
                  className="h-8 text-sm flex-1"
                  autoFocus
                  disabled={savingGuestName}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={() => onSaveGuestName(guest.bookingId, guest.ticketIndex, guest.id, guest.guestId)}
                  disabled={savingGuestName}
                >
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={onCancelEditGuest}
                  disabled={savingGuestName}
                >
                  <X className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEditGuest(guest.id, guest.guestName);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <span className={`text-sm font-medium ${guest.isChecked ? 'text-muted-foreground line-through' : ''}`}>
                  {guest.guestName}
                </span>
                {guest.isOrganiser && (
                  <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Organiser
                  </Badge>
                )}
              </>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="text-sm font-mono text-muted-foreground">{guest.referenceCode}</span>
        </td>
        <td className="py-3 px-4">
          <span className="text-sm text-muted-foreground">{guest.organiserName || 'Unknown'}</span>
        </td>
        <td className="py-3 px-4 text-right">
          <Checkbox
            checked={guest.isChecked}
            onCheckedChange={() => onToggleCheckin(guest.bookingId, guest.ticketIndex, guest.isChecked)}
            className="ml-auto"
          />
        </td>
      </tr>
    );
  };

  const renderGuestSection = (
    title: string,
    guestList: RunSheetGuestItem[],
    sectionKey: keyof typeof expandedSections,
    startIdx: number
  ) => {
    if (guestList.length === 0 && !searchQuery) return null;

    const isExpanded = expandedSections[sectionKey];
    const checkedCount = guestList.filter((g) => g.isChecked).length;

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleSection(sectionKey)} className="mb-4">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-foreground">{title}</h4>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {guestList.length}
              </Badge>
              {checkedCount > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {checkedCount} checked in
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {guestList.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No guests match your search</div>
          ) : (
            <div className="border rounded-lg overflow-hidden mt-2">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground w-12">#</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Reference</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Organiser</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Check-in</th>
                  </tr>
                </thead>
                <tbody>{guestList.map((guest, idx) => renderGuestRow(guest, idx, startIdx + idx))}</tbody>
              </table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const totalGuests = guests.length;
  const filteredCount = organiser.length + organiserGuests.length + purchasers.length;
  const totalCheckedIn = guests.filter((g) => g.isChecked).length;

  return (
    <div className="space-y-4">
      {/* Search Control */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search guests by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {searchQuery ? `Showing ${filteredCount} of ${totalGuests} guests` : `${totalGuests} total guests`}
        </div>
        <div>
          {totalCheckedIn} / {totalGuests} checked in
        </div>
      </div>

      {/* Guest Sections */}
      {renderGuestSection('ORGANISER', organiser, 'organiser', 0)}
      {renderGuestSection('ORGANISER GUESTS', organiserGuests, 'organiserGuests', organiser.length)}
      {renderGuestSection(
        'GUEST LIST PURCHASERS',
        purchasers,
        'purchasers',
        organiser.length + organiserGuests.length
      )}

      {/* Empty State */}
      {filteredCount === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? 'No guests match your search' : 'No guests found for this date.'}
        </div>
      )}
    </div>
  );
}
