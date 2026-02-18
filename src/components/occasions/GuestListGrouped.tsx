import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronUp, Search, Trash2, UserPlus, StickyNote } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface GuestItem {
  name: string;
  invitedBy: string;
  isOrganiser: boolean;
  bookingId: string;
  index: number;
  bookingSource?: string;
  notes?: string;
  guestId?: string;
}

interface GuestListGroupedProps {
  guests: GuestItem[];
  editingGuests: { [key: string]: string };
  organiserName?: string;
  onGuestNameChange: (bookingId: string, index: number, value: string) => void;
  onDeleteGuest?: (bookingId: string, index: number, name: string) => void;
  onAddSingleGuest?: () => void;
  onGuestNotesChange?: (bookingId: string, guestIndex: number, notes: string) => void;
  readOnly?: boolean;
  showActions?: boolean;
  isAtCapacity?: boolean;
}

type SortField = 'name' | 'invitedBy' | 'none';
type SortDirection = 'asc' | 'desc';

interface GroupedGuests {
  organiser: GuestItem[];
  organiserGuests: GuestItem[];
  purchasers: GuestItem[];
}

export default function GuestListGrouped({
  guests,
  editingGuests,
  organiserName = 'Organiser',
  onGuestNameChange,
  onDeleteGuest,
  onAddSingleGuest,
  onGuestNotesChange,
  readOnly = false,
  showActions = true,
  isAtCapacity = false,
}: GuestListGroupedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('none');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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
      const guestName = editingGuests[`${guest.bookingId}-${guest.index}`] || guest.name || '';
      if (searchQuery && !guestName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      // Categorize
      if (guest.isOrganiser) {
        grouped.organiser.push(guest);
      } else if (
        guest.invitedBy === organiserName ||
        guest.bookingSource === 'admin' ||
        guest.invitedBy.toLowerCase().includes('staff') ||
        guest.invitedBy.toLowerCase().includes('walk-in')
      ) {
        grouped.organiserGuests.push(guest);
      } else {
        grouped.purchasers.push(guest);
      }
    });

    // Sort within each group
    const sortGuests = (guestList: GuestItem[]) => {
      if (sortField === 'none') return guestList;

      return [...guestList].sort((a, b) => {
        let aValue = '';
        let bValue = '';

        if (sortField === 'name') {
          aValue = (editingGuests[`${a.bookingId}-${a.index}`] || a.name || '').toLowerCase();
          bValue = (editingGuests[`${b.bookingId}-${b.index}`] || b.name || '').toLowerCase();
        } else if (sortField === 'invitedBy') {
          aValue = a.invitedBy.toLowerCase();
          bValue = b.invitedBy.toLowerCase();
        }

        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    };

    return {
      organiser: sortGuests(grouped.organiser),
      organiserGuests: sortGuests(grouped.organiserGuests),
      purchasers: sortGuests(grouped.purchasers),
    };
  }, [guests, editingGuests, searchQuery, sortField, sortDirection, organiserName]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderGuestRow = (guest: GuestItem, idx: number, globalIdx: number) => {
    const key = `${guest.bookingId}-${guest.index}`;
    const currentValue = editingGuests[key] || '';

    return (
      <tr key={key} className="border-b dark:border-gray-700 last:border-b-0">
        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{globalIdx + 1}</td>
        <td className="py-2 px-4">
          <input
            type="text"
            value={currentValue}
            onChange={(e) => onGuestNameChange(guest.bookingId, guest.index, e.target.value)}
            placeholder={`Guest ${globalIdx + 1} full name`}
            disabled={guest.isOrganiser || readOnly}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-900 dark:disabled:text-gray-100"
          />
        </td>
        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{guest.invitedBy}</td>
        <td className="py-3 px-4">
          {guest.isOrganiser && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Organiser
            </Badge>
          )}
        </td>
        <td className="py-3 px-4">
          {!guest.isOrganiser && onGuestNotesChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <StickyNote className={cn(
                    "h-4 w-4",
                    guest.notes ? "text-blue-500" : "text-gray-300 dark:text-gray-600"
                  )} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <Label>Guest Notes</Label>
                  <Textarea
                    defaultValue={guest.notes || ""}
                    onBlur={(e) => onGuestNotesChange(guest.bookingId, guest.index, e.target.value)}
                    placeholder="e.g., VIP, bar card..."
                    rows={2}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notes are saved automatically when you click away.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </td>
        {showActions && (
          <td className="py-3 px-4 text-right">
            {!guest.isOrganiser && !readOnly && onDeleteGuest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteGuest(guest.bookingId, guest.index, currentValue || `Guest ${globalIdx + 1}`)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </td>
        )}
      </tr>
    );
  };

  const renderGuestSection = (
    title: string,
    guestList: GuestItem[],
    sectionKey: keyof typeof expandedSections,
    startIdx: number
  ) => {
    if (guestList.length === 0 && !searchQuery) return null;

    const isExpanded = expandedSections[sectionKey];

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleSection(sectionKey)} className="mb-4">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-700 dark:text-gray-300">
                {title}
              </h4>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {guestList.length}
              </Badge>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {guestList.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No guests match your search
            </div>
          ) : (
            <div className="overflow-x-auto border dark:border-gray-700 rounded-lg mt-2">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">#</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Guest Name
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Invited By
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Tags</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Notes</th>
                    {showActions && (
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="dark:bg-gray-900">
                  {guestList.map((guest, idx) => renderGuestRow(guest, idx, startIdx + idx))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const totalGuests = guests.length;
  const filteredCount = organiser.length + organiserGuests.length + purchasers.length;

  return (
    <div className="space-y-4">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search guests by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No sorting</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="invitedBy">Invited By</SelectItem>
            </SelectContent>
          </Select>
          {sortField !== 'none' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="px-3"
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </Button>
          )}
        </div>
      </div>

      {/* Results Summary */}
      {searchQuery && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredCount} of {totalGuests} guests
        </div>
      )}

      {/* Guest Sections */}
      {renderGuestSection('ORGANISER', organiser, 'organiser', 0)}
      {renderGuestSection('ORGANISER GUESTS', organiserGuests, 'organiserGuests', organiser.length)}
      {renderGuestSection(
        'GUEST LIST PURCHASERS',
        purchasers,
        'purchasers',
        organiser.length + organiserGuests.length
      )}

      {/* Add Single Guest Button */}
      {!readOnly && onAddSingleGuest && (
        <div className="flex justify-center pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onAddSingleGuest}
            disabled={isAtCapacity}
            title={isAtCapacity ? 'At capacity' : undefined}
            className="text-sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add single guest
          </Button>
        </div>
      )}

      {/* Empty State */}
      {filteredCount === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {searchQuery ? 'No guests match your search' : 'No guests yet'}
        </div>
      )}
    </div>
  );
}
