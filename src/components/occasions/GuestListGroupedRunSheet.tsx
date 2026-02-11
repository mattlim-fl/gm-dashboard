import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Search, Pencil, Check, X, Star, UserPlus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { MemberWithCheckin } from '@/hooks/useMembers';
import { Member } from '@/services/memberService';

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
  venue?: string;
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
  // Member props
  members?: MemberWithCheckin[];
  showMembers?: boolean;
  onMemberToggleCheckin?: (memberId: string, isChecked: boolean) => void;
  onMemberClick?: (member: Member) => void;
  onAddMember?: () => void;
}

// Unified row type for both guests and members
type UnifiedRow =
  | { type: 'guest'; data: RunSheetGuestItem }
  | { type: 'member'; data: MemberWithCheckin };

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
  members = [],
  showMembers = false,
  onMemberToggleCheckin,
  onMemberClick,
  onAddMember,
}: GuestListGroupedRunSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Create unified list of guests and members
  const unifiedList = useMemo(() => {
    const rows: UnifiedRow[] = [];

    // Add guests
    guests.forEach((guest) => {
      // Filter by search query
      if (searchQuery && !guest.guestName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }
      rows.push({ type: 'guest', data: guest });
    });

    // Add members if enabled
    if (showMembers) {
      members.forEach((member) => {
        // Filter by search query
        if (searchQuery &&
            !member.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !member.phone.includes(searchQuery)) {
          return;
        }
        rows.push({ type: 'member', data: member });
      });
    }

    return rows;
  }, [guests, members, showMembers, searchQuery]);

  const totalCheckedIn = useMemo(() => {
    return unifiedList.filter((row) => {
      if (row.type === 'guest') return row.data.isChecked;
      if (row.type === 'member') return row.data.isCheckedIn;
      return false;
    }).length;
  }, [unifiedList]);

  const guestCount = guests.filter(g => !searchQuery || g.guestName.toLowerCase().includes(searchQuery.toLowerCase())).length;
  const memberCount = showMembers ? members.filter(m => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.phone.includes(searchQuery)).length : 0;

  const renderGuestRow = (guest: RunSheetGuestItem, idx: number) => {
    const venue = guest.booking?.venue || guest.venue || '-';

    return (
      <tr
        key={guest.id}
        className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
          guest.isChecked ? 'opacity-60 bg-muted/20' : ''
        }`}
      >
        <td className="py-3 px-4 text-sm text-muted-foreground">{idx + 1}</td>
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
          <span className="text-sm text-muted-foreground">{guest.organiserName || '-'}</span>
        </td>
        <td className="py-3 px-4">
          <span className="text-sm text-muted-foreground capitalize">{venue}</span>
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

  const renderMemberRow = (member: MemberWithCheckin, idx: number) => {
    return (
      <tr
        key={`member-${member.id}`}
        className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer ${
          member.isCheckedIn ? 'opacity-60 bg-muted/20' : ''
        }`}
        onClick={() => onMemberClick?.(member)}
      >
        <td className="py-3 px-4 text-sm text-muted-foreground">{idx + 1}</td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
            <span className={`text-sm font-medium ${member.isCheckedIn ? 'text-muted-foreground line-through' : ''}`}>
              {member.name}
            </span>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="text-sm text-muted-foreground">-</span>
        </td>
        <td className="py-3 px-4">
          <span className="text-sm text-muted-foreground">-</span>
        </td>
        <td className="py-3 px-4">
          <span className="text-sm text-muted-foreground capitalize">{member.venue}</span>
        </td>
        <td className="py-3 px-4 text-right">
          <Checkbox
            checked={member.isCheckedIn}
            onCheckedChange={(e) => {
              e.stopPropagation?.();
              onMemberToggleCheckin?.(member.id, member.isCheckedIn);
            }}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto"
          />
        </td>
      </tr>
    );
  };

  const renderUnifiedRow = (row: UnifiedRow, idx: number) => {
    if (row.type === 'guest') {
      return renderGuestRow(row.data, idx);
    } else {
      return renderMemberRow(row.data, idx);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Control */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {onAddMember && showMembers && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onAddMember}
          >
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {guestCount} guests{showMembers ? ` + ${memberCount} members` : ''}
        </div>
        <div>
          {totalCheckedIn} / {unifiedList.length} checked in
        </div>
      </div>

      {/* Unified List */}
      {unifiedList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
          {searchQuery ? 'No results match your search' : 'No guests or members found for this date.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-foreground">Guest List</h4>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {unifiedList.length}
              </Badge>
              {totalCheckedIn > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {totalCheckedIn} checked in
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {isExpanded && (
            <table className="w-full">
              <thead className="bg-muted/30 border-t border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground w-12">#</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Reference</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Organiser</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Venue</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {unifiedList.map((row, idx) => renderUnifiedRow(row, idx))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
