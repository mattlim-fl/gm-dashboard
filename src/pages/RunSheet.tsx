import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useBookings } from "@/hooks/useBookings";
import { updateVipTicketCheckins, BookingRow } from "@/services/bookingService";
import { formatDateToISO } from "@/utils/dateUtils";
import { CheckCheck, Search, Users, Mic2, Calendar, ArrowLeft, UserPlus, Star, Pencil } from "lucide-react";
import { QuickAddBookingDialog } from "@/components/bookings/QuickAddBookingDialog";
import { BookingDetailsSidebar } from "@/components/bookings/BookingDetailsSidebar";
import { customerService, CustomerRow } from "@/services/customerService";
import { AddMemberDialog } from "@/components/members/AddMemberDialog";
import { MemberProfileDialog } from "@/components/members/MemberProfileDialog";
import { supabase } from "@/integrations/supabase/client";

type VenueFilter = 'all' | 'manor' | 'hippie';

interface AttendanceState {
  vip: Record<string, boolean[]>;
  karaoke: Record<string, boolean[]>; // Changed to arrays to track individual guests
}

const getStorageKey = (dateISO: string) => `runSheetAttendance:${dateISO}`;

export default function RunSheet() {
  const [activeTab, setActiveTab] = useState<'guests' | 'karaoke' | 'members'>('guests');
  const [selectedDate, setSelectedDate] = useState<string>(formatDateToISO(new Date()));
  const [search, setSearch] = useState<string>("");
  const [venue, setVenue] = useState<VenueFilter>('all');
  const [attendance, setAttendance] = useState<AttendanceState>({ vip: {}, karaoke: {} });
  const [showCheckedOff, setShowCheckedOff] = useState<boolean>(false);
  const [members, setMembers] = useState<CustomerRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Guest lists for all bookings (both VIP and karaoke)
  // Now stores structured guest data with is_organiser flag
  interface GuestEntry {
    id: string;
    guest_name: string;
    is_organiser: boolean;
  }
  const [guestLists, setGuestLists] = useState<Record<string, GuestEntry[]>>({});
  const [loadingGuestLists, setLoadingGuestLists] = useState(false);
  
  // Booth names lookup
  const [boothNames, setBoothNames] = useState<Record<string, string>>({});

  // Editing
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [isEditSidebarOpen, setIsEditSidebarOpen] = useState(false);
  
  // Member management
  const [selectedMember, setSelectedMember] = useState<CustomerRow | null>(null);
  const [isMemberProfileOpen, setIsMemberProfileOpen] = useState(false);

  // Guest name editing
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingGuestName, setEditingGuestName] = useState<string>("");

  // Load/save attendance
  useEffect(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(selectedDate));
      if (raw) {
        const parsed = JSON.parse(raw);
        const migratedVip: Record<string, boolean[]> = {};
        if (parsed.vip) {
          Object.entries(parsed.vip).forEach(([bookingId, value]) => {
            if (Array.isArray(value)) migratedVip[bookingId] = value as boolean[];
            else if (typeof value === 'number') migratedVip[bookingId] = Array(Math.max(0, value)).fill(true);
          });
        }
        
        // Migrate karaoke from old boolean format to array format
        const migratedKaraoke: Record<string, boolean[]> = {};
        if (parsed.karaoke) {
          Object.entries(parsed.karaoke).forEach(([bookingId, value]) => {
            if (Array.isArray(value)) {
              migratedKaraoke[bookingId] = value as boolean[];
            } else if (typeof value === 'boolean' && value) {
              // Old format: single boolean true means all checked
              // We'll initialize with empty array, will be populated when guest list loads
              migratedKaraoke[bookingId] = [];
            } else {
              migratedKaraoke[bookingId] = [];
            }
          });
        }
        
        setAttendance({ vip: migratedVip, karaoke: migratedKaraoke });
      } else {
        setAttendance({ vip: {}, karaoke: {} });
      }
    } catch {
      setAttendance({ vip: {}, karaoke: {} });
    }
  }, [selectedDate]);

  useEffect(() => {
    localStorage.setItem(getStorageKey(selectedDate), JSON.stringify(attendance));
  }, [attendance, selectedDate]);

  // Fetch Members when tab is active
  const fetchMembers = async () => {
    if (activeTab === 'members') {
      setLoadingMembers(true);
      try {
        const membersData = await customerService.getMembers(search);
        setMembers(membersData);
      } catch (_error) {
        // Silent fail for member fetch
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeTab, search]); // Re-fetch on search change for server-side search

  const guestFilters = useMemo(() => ({
    bookingType: 'vip_tickets',
    venue: venue === 'all' ? undefined : venue,
    dateFrom: selectedDate,
    dateTo: selectedDate,
    search: search || undefined,
  }), [venue, selectedDate, search]);

  const karaokeFilters = useMemo(() => ({
    bookingType: 'karaoke_booking',
    venue: venue === 'all' ? undefined : venue,
    dateFrom: selectedDate,
    dateTo: selectedDate,
    search: search || undefined,
  }), [venue, selectedDate, search]);

  const occasionFilters = useMemo(() => ({
    bookingType: 'occasion',
    venue: venue === 'all' ? undefined : venue,
    dateFrom: selectedDate,
    dateTo: selectedDate,
    search: search || undefined,
  }), [venue, selectedDate, search]);

  const { data: vipBookings = [], isLoading: loadingVip } = useBookings(guestFilters as any);
  const { data: karaokeBookings = [], isLoading: loadingKaraoke } = useBookings(karaokeFilters as any);
  const { data: occasionBookings = [], isLoading: loadingOccasions } = useBookings(occasionFilters as any);

  // Fetch guest lists for all bookings (VIP, karaoke, and occasions)
  // booking_guests is now the source of truth for who needs entry
  useEffect(() => {
    const fetchGuestLists = async () => {
      const allBookings = [...vipBookings, ...karaokeBookings, ...occasionBookings];
      if (allBookings.length === 0) {
        setGuestLists({});
        return;
      }

      setLoadingGuestLists(true);
      try {
        const bookingIds = allBookings.map(b => b.id);
        const { data: guestRows, error } = await supabase
          .from("booking_guests")
          .select("id, booking_id, guest_name, is_organiser")
          .in("booking_id", bookingIds)
          .order("is_organiser", { ascending: false })
          .order("created_at");

        if (error) throw error;

        // Group guests by booking_id
        const lists: Record<string, GuestEntry[]> = {};
        bookingIds.forEach(id => {
          lists[id] = [];
        });

        if (guestRows) {
          guestRows.forEach((row) => {
            if (row.booking_id) {
              if (!lists[row.booking_id]) {
                lists[row.booking_id] = [];
              }
              lists[row.booking_id].push({
                id: row.id,
                guest_name: row.guest_name || '',
                is_organiser: row.is_organiser || false,
              });
            }
          });
        }

        setGuestLists(lists);
      } catch (_error) {
        // Silent fail for guest lists fetch
      } finally {
        setLoadingGuestLists(false);
      }
    };

    fetchGuestLists();
  }, [vipBookings, karaokeBookings, occasionBookings]);

  // Fetch booth names for karaoke bookings
  useEffect(() => {
    const fetchBoothNames = async () => {
      const boothIds = karaokeBookings
        .map(b => b.karaoke_booth_id)
        .filter((id): id is string => !!id);
      
      if (boothIds.length === 0) return;

      const uniqueIds = [...new Set(boothIds)];
      const { data: booths, error } = await supabase
        .from("karaoke_booths")
        .select("id, name")
        .in("id", uniqueIds);

      if (error) {
        return;
      }

      const namesMap: Record<string, string> = {};
      booths?.forEach(booth => {
        namesMap[booth.id] = booth.name;
      });
      setBoothNames(namesMap);
    };

    fetchBoothNames();
  }, [karaokeBookings]);

  // Stats - combine VIP tickets, karaoke guests, and occasion guests
  // Use booking_guests as source of truth
  const totalVipTickets = useMemo(() => {
    return vipBookings.reduce((sum, b) => {
      const guests = guestLists[b.id] || [];
      return sum + guests.length;
    }, 0);
  }, [vipBookings, guestLists]);
  const checkedVipTickets = useMemo(() => {
    return vipBookings.reduce((sum, b) => {
      const local = attendance.vip[b.id];
      if (Array.isArray(local)) return sum + local.filter(Boolean).length;
      const stored = ((b as any).ticket_checkins as (string | null)[] | undefined) || [];
      return sum + stored.filter(Boolean).length;
    }, 0);
  }, [vipBookings, attendance.vip]);

  // Calculate karaoke stats based on booking_guests entries (source of truth)
  const totalKaraokeGuests = useMemo(() => {
    return karaokeBookings.reduce((sum, b) => {
      const guests = guestLists[b.id] || [];
      return sum + guests.length;
    }, 0);
  }, [karaokeBookings, guestLists]);

  const checkedKaraokeGuests = useMemo(() => {
    return karaokeBookings.reduce((sum, b) => {
      const checkins = attendance.karaoke[b.id] || [];
      return sum + checkins.filter(Boolean).length;
    }, 0);
  }, [karaokeBookings, attendance.karaoke]);

  // Calculate occasion stats based on booking_guests entries (source of truth)
  const totalOccasionGuests = useMemo(() => {
    return occasionBookings.reduce((sum, b) => {
      const guests = guestLists[b.id] || [];
      return sum + guests.length;
    }, 0);
  }, [occasionBookings, guestLists]);

  const checkedOccasionGuests = useMemo(() => {
    return occasionBookings.reduce((sum, b) => {
      const checkins = attendance.karaoke[b.id] || []; // Use karaoke attendance for occasions
      if (Array.isArray(checkins)) return sum + checkins.filter(Boolean).length;
      return sum;
    }, 0);
  }, [occasionBookings, attendance.karaoke]);

  // Calculate karaoke booking stats (for Karaoke tab - counts bookings, not guests)
  const checkedKaraokeBookings = useMemo(() => {
    return karaokeBookings.filter(b => {
      const checkins = attendance.karaoke[b.id] || [];
      return checkins[0] === true; // First element indicates booking-level check-in
    }).length;
  }, [karaokeBookings, attendance.karaoke]);

  // Combined stats for Guests tab
  const totalGuests = totalVipTickets + totalKaraokeGuests + totalOccasionGuests;
  const checkedGuests = checkedVipTickets + checkedKaraokeGuests + checkedOccasionGuests;
  const guestsPercent = totalGuests > 0 ? Math.round((checkedGuests / totalGuests) * 100) : 0;
  
  const vipPercent = totalVipTickets > 0 ? Math.round((checkedVipTickets / totalVipTickets) * 100) : 0;
  const karaokeBookingsPercent = karaokeBookings.length > 0 ? Math.round((checkedKaraokeBookings / karaokeBookings.length) * 100) : 0;

  // Flatten all guests into a simple list for table display
  // booking_guests is the source of truth - one row per entry
  const allGuestRows = useMemo(() => {
    const rows: Array<{
      id: string; // unique row id (booking_guests.id)
      guestEntryId: string; // the actual booking_guests.id
      guestName: string;
      isOrganiser: boolean;
      reference: string;
      bookingId: string;
      guestIndex: number;
      isVip: boolean;
      booking: BookingRow;
    }> = [];

    // Add VIP ticket guests from booking_guests
    vipBookings.forEach(booking => {
      const guests = guestLists[booking.id] || [];
      guests.forEach((guest, i) => {
        rows.push({
          id: `${booking.id}-${i}`,
          guestEntryId: guest.id,
          guestName: guest.guest_name || `Guest #${i + 1}`,
          isOrganiser: guest.is_organiser,
          reference: booking.reference_code || 'NO-REF',
          bookingId: booking.id,
          guestIndex: i,
          isVip: true,
          booking,
        });
      });
    });

    // Add karaoke guests from booking_guests
    karaokeBookings.forEach(booking => {
      const guests = guestLists[booking.id] || [];
      guests.forEach((guest, i) => {
        rows.push({
          id: `${booking.id}-${i}`,
          guestEntryId: guest.id,
          guestName: guest.guest_name || `Guest #${i + 1}`,
          isOrganiser: guest.is_organiser,
          reference: booking.reference_code || 'NO-REF',
          bookingId: booking.id,
          guestIndex: i,
          isVip: false,
          booking,
        });
      });
    });

    // Add occasion guests from booking_guests
    occasionBookings.forEach(booking => {
      const guests = guestLists[booking.id] || [];
      guests.forEach((guest, i) => {
        rows.push({
          id: `${booking.id}-${i}`,
          guestEntryId: guest.id,
          guestName: guest.guest_name || `Guest #${i + 1}`,
          isOrganiser: guest.is_organiser,
          reference: booking.reference_code || 'NO-REF',
          bookingId: booking.id,
          guestIndex: i,
          isVip: false, // Use same check-in system as karaoke
          booking,
        });
      });
    });

    // Sort: organisers first within each reference, then by name
    return rows.sort((a, b) => {
      // First sort by reference
      const refCompare = a.reference.localeCompare(b.reference);
      if (refCompare !== 0) return refCompare;
      // Then organisers first
      if (a.isOrganiser && !b.isOrganiser) return -1;
      if (!a.isOrganiser && b.isOrganiser) return 1;
      // Then by name
      return a.guestName.localeCompare(b.guestName);
    });
  }, [vipBookings, karaokeBookings, occasionBookings, guestLists]);

  const isToday = selectedDate === formatDateToISO(new Date());

  // Handlers
  const updateCheckins = async (bookingId: string, nextState: boolean[]) => {
    setAttendance(prev => ({ ...prev, vip: { ...prev.vip, [bookingId]: nextState } }));
    const checkins = nextState.map(c => (c ? new Date().toISOString() : null));
    try {
      await updateVipTicketCheckins(bookingId, checkins);
    } catch (_e) {
      // Silent fail for checkins update
    }
  };

  const handleVipToggle = async (bookingId: string, index: number, maxTickets: number) => {
    const current = attendance.vip[bookingId] ? [...attendance.vip[bookingId]] : Array(maxTickets).fill(false);
    current[index] = !current[index];
    await updateCheckins(bookingId, current);
  };

  const handleVipCheckAll = async (bookingId: string, maxTickets: number) => {
    const current = attendance.vip[bookingId] || Array(maxTickets).fill(false);
    const allChecked = current.every(Boolean);
    const nextState = Array(maxTickets).fill(!allChecked);
    await updateCheckins(bookingId, nextState);
  };

  // Karaoke guest handlers
  const handleKaraokeGuestToggle = (bookingId: string, index: number, maxGuests: number) => {
    const current = attendance.karaoke[bookingId] ? [...attendance.karaoke[bookingId]] : Array(maxGuests).fill(false);
    current[index] = !current[index];
    setAttendance(prev => ({ ...prev, karaoke: { ...prev.karaoke, [bookingId]: current } }));
  };

  const handleKaraokeCheckAll = (bookingId: string, maxGuests: number) => {
    const current = attendance.karaoke[bookingId] || Array(maxGuests).fill(false);
    const allChecked = current.every(Boolean);
    const nextState = Array(maxGuests).fill(!allChecked);
    setAttendance(prev => ({ ...prev, karaoke: { ...prev.karaoke, [bookingId]: nextState } }));
  };

  // Karaoke booking-level check-in toggle (for Karaoke tab)
  const handleKaraokeBookingToggle = (bookingId: string) => {
    const current = attendance.karaoke[bookingId] || [];
    const isChecked = current[0] === true;
    // Set first element to toggle booking check-in status
    const nextState = [...current];
    nextState[0] = !isChecked;
    setAttendance(prev => ({ ...prev, karaoke: { ...prev.karaoke, [bookingId]: nextState } }));
  };

  const handleBookingClick = (booking: BookingRow) => {
    setSelectedBooking(booking);
    setIsEditSidebarOpen(true);
  };

  const handleBackToToday = () => {
    setSelectedDate(formatDateToISO(new Date()));
  };

  // Guest name editing handlers
  const handleStartEditGuestName = (rowId: string, currentName: string) => {
    setEditingGuestId(rowId);
    setEditingGuestName(currentName);
  };

  const handleSaveGuestName = async (bookingId: string, guestIndex: number, newName: string) => {
    if (!newName.trim()) {
      setEditingGuestId(null);
      setEditingGuestName("");
      return;
    }

    try {
      // Get the guest entry from our local state
      const guests = guestLists[bookingId] || [];
      const guestEntry = guests[guestIndex];

      if (guestEntry?.id) {
        // Update existing guest by ID
        const { error: updateError } = await supabase
          .from("booking_guests")
          .update({ guest_name: newName.trim() })
          .eq("id", guestEntry.id);

        if (updateError) throw updateError;
      } else {
        // Insert new guest (shouldn't happen with new model, but fallback)
        const { error: insertError } = await supabase
          .from("booking_guests")
          .insert({
            booking_id: bookingId,
            guest_name: newName.trim(),
            is_organiser: false
          });

        if (insertError) throw insertError;
      }

      // Refresh guest lists for this booking
      const { data: guestRows, error } = await supabase
        .from("booking_guests")
        .select("id, booking_id, guest_name, is_organiser")
        .eq("booking_id", bookingId)
        .order("is_organiser", { ascending: false })
        .order("created_at");

      if (!error && guestRows) {
        setGuestLists(prev => ({
          ...prev,
          [bookingId]: guestRows.map((row) => ({
            id: row.id,
            guest_name: row.guest_name || '',
            is_organiser: row.is_organiser || false,
          }))
        }));
      }

    } catch (_error) {
      // Silent fail for guest name save
    }

    setEditingGuestId(null);
    setEditingGuestName("");
  };

  const handleCancelEditGuestName = () => {
    setEditingGuestId(null);
    setEditingGuestName("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-20 max-w-4xl mx-auto">
        
        {/* Header Area */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Run Sheet</h1>
              {!isToday && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBackToToday}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Today
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <QuickAddBookingDialog defaultDate={selectedDate} />
            </div>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card/50 border shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium"><Users className="h-3.5 w-3.5" /> Guests</span>
                  <span className="font-mono">{checkedGuests}/{totalGuests}</span>
                </div>
                <Progress value={guestsPercent} className="h-2" />
              </CardContent>
            </Card>
            <Card className="bg-card/50 border shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium"><Mic2 className="h-3.5 w-3.5" /> Karaoke</span>
                  <span className="font-mono">
                    {checkedKaraokeBookings}/{karaokeBookings.length}
                  </span>
                </div>
                <Progress value={karaokeBookingsPercent} className="h-2" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Controls Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 space-y-3 -mx-4 px-4 border-b">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 text-lg bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
            
            {/* Filters row - always visible or toggleable? Plan says move to top row. */}
            {/* Let's put date/venue here for quick access */}
             <div className="flex gap-2">
               {!isToday && (
                 <Button variant="outline" size="icon" onClick={handleBackToToday} title="Back to Today">
                   <ArrowLeft className="h-4 w-4" />
                 </Button>
               )}
               <Input 
                 type="date" 
                 value={selectedDate} 
                 onChange={(e) => setSelectedDate(e.target.value)} 
                 className="w-auto bg-card h-11" 
               />
               <Select value={venue} onValueChange={(v: VenueFilter) => setVenue(v)}>
                 <SelectTrigger className="w-[130px] bg-card h-11">
                   <SelectValue placeholder="Venue" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Venues</SelectItem>
                   <SelectItem value="manor">Manor</SelectItem>
                   <SelectItem value="hippie">Hippie</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-10">
              <TabsTrigger value="guests">Guests ({totalGuests})</TabsTrigger>
              <TabsTrigger value="karaoke">Karaoke ({karaokeBookings.length})</TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                 <Star className="h-3.5 w-3.5" /> Members
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex justify-between items-center px-1">
             <div className="text-xs text-muted-foreground font-medium">
               {activeTab === 'guests' && `${checkedGuests} of ${totalGuests} checked in`}
               {activeTab === 'karaoke' && `${checkedKaraokeBookings} of ${karaokeBookings.length} checked in`}
               {activeTab === 'members' && `${members.length} found`}
             </div>
            {(activeTab === 'guests' || activeTab === 'karaoke') && (
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="showChecked" 
                  checked={showCheckedOff} 
                  onCheckedChange={(c) => setShowCheckedOff(!!c)} 
                />
                <label htmlFor="showChecked" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Show checked
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Main Content List */}
        <div className="space-y-4 min-h-[50vh]">
          {activeTab === 'guests' && (
            <Card className="overflow-hidden">
              {allGuestRows.length === 0 && !loadingVip && !loadingKaraoke && !loadingOccasions ? (
                <div className="text-center py-10 text-muted-foreground">No guests found for this date.</div>
              ) : (
                <div className="divide-y">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr,auto,auto] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <div>Name</div>
                    <div className="w-24 text-center">Reference</div>
                    <div className="w-12"></div>
                  </div>
                  
                  {/* Table Rows */}
                  {allGuestRows.map((row) => {
                    const checkins = row.isVip 
                      ? (attendance.vip[row.bookingId] || [])
                      : (attendance.karaoke[row.bookingId] || []);
                    const isChecked = !!checkins[row.guestIndex];

                    if (!showCheckedOff && isChecked) return null;

                    const guestsInBooking = guestLists[row.bookingId]?.length || 1;

                    const handleToggle = row.isVip
                      ? () => handleVipToggle(row.bookingId, row.guestIndex, guestsInBooking)
                      : () => handleKaraokeGuestToggle(row.bookingId, row.guestIndex, guestsInBooking);

                    const isEditing = editingGuestId === row.id;

                    return (
                      <div
                        key={row.id}
                        className={`grid grid-cols-[1fr,auto,auto] gap-2 px-4 py-3 items-center transition-colors ${isChecked ? 'bg-muted/30 opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isEditing ? (
                            <Input
                              value={editingGuestName}
                              onChange={(e) => setEditingGuestName(e.target.value)}
                              onBlur={() => handleSaveGuestName(row.bookingId, row.guestIndex, editingGuestName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveGuestName(row.bookingId, row.guestIndex, editingGuestName);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditGuestName();
                                }
                              }}
                              autoFocus
                              className="h-8 text-sm flex-1"
                            />
                          ) : (
                            <>
                              <span 
                                className={`text-sm font-medium truncate cursor-pointer hover:underline ${isChecked ? 'line-through text-muted-foreground' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBookingClick(row.booking);
                                }}
                              >
                                {row.guestName}
                              </span>
                              {row.isOrganiser && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-orange-500/10 text-orange-600 border-orange-500/30">
                                  Organiser
                                </Badge>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditGuestName(row.id, row.guestName);
                                }}
                                className="p-1.5 hover:bg-accent rounded-md transition-colors flex-shrink-0 touch-manipulation"
                                title="Edit guest name"
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="w-24 text-center">
                          <span className="text-xs font-mono text-muted-foreground">{row.reference}</span>
                        </div>
                        <div className="w-12 flex justify-center">
                          <Checkbox
                            checked={isChecked}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle();
                            }}
                            className="h-5 w-5 cursor-pointer data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'karaoke' && (
            <Card className="overflow-hidden">
              {karaokeBookings.length === 0 && !loadingKaraoke ? (
                <div className="text-center py-10 text-muted-foreground">No karaoke bookings found for this date.</div>
              ) : (
                <div className="divide-y">
                  {/* Table Header */}
                  <div className="grid grid-cols-[minmax(120px,1fr),140px,140px,60px,90px,48px] gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <div>Customer</div>
                    <div className="text-center">Time</div>
                    <div className="text-center">Booth</div>
                    <div className="text-center">Guests</div>
                    <div className="text-center">Reference</div>
                    <div></div>
                  </div>
                  
                  {/* Table Rows - sorted by start time */}
                  {[...karaokeBookings]
                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                    .map((booking) => {
                      const boothName = booking.karaoke_booth_id 
                        ? boothNames[booking.karaoke_booth_id] || 'Loading...'
                        : '-';
                      const timeRange = booking.start_time && booking.end_time
                        ? `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`
                        : booking.start_time?.slice(0, 5) || '-';
                      const isChecked = attendance.karaoke[booking.id]?.[0] === true;

                      if (!showCheckedOff && isChecked) return null;

                      return (
                        <div
                          key={booking.id}
                          className={`grid grid-cols-[minmax(120px,1fr),140px,140px,60px,90px,48px] gap-3 px-4 py-3 items-center transition-colors ${isChecked ? 'bg-muted/30 opacity-60' : ''}`}
                        >
                          <div
                            className="min-w-0 cursor-pointer hover:opacity-80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookingClick(booking);
                            }}
                          >
                            <div className={`text-sm font-medium truncate ${isChecked ? 'line-through text-muted-foreground' : ''}`}>{booking.customer_name}</div>
                            {booking.special_requests && (
                              <div className="text-xs text-yellow-600 dark:text-yellow-500 truncate mt-0.5">
                                {booking.special_requests}
                              </div>
                            )}
                          </div>
                          <div className={`text-center text-sm font-mono ${isChecked ? 'text-muted-foreground' : ''}`}>
                            {timeRange}
                          </div>
                          <div className={`text-center text-sm ${isChecked ? 'text-muted-foreground' : ''}`}>
                            {boothName}
                          </div>
                          <div className={`text-center text-sm ${isChecked ? 'text-muted-foreground' : ''}`}>
                            {guestLists[booking.id]?.length || 0}
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-mono text-muted-foreground">
                              {booking.reference_code || 'NO-REF'}
                            </span>
                          </div>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={isChecked}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleKaraokeBookingToggle(booking.id);
                              }}
                              className="h-5 w-5 cursor-pointer data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Add Member Helper */}
              <Card className="bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/20">
                <CardContent className="p-4 flex items-center justify-between">
                   <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                     Permanent Guest List
                   </div>
                   <AddMemberDialog onMemberAdded={fetchMembers} />
                </CardContent>
              </Card>

              {members.length === 0 && !loadingMembers && (
                <div className="text-center py-10 text-muted-foreground">No members found matching your search.</div>
              )}

              <div className="grid grid-cols-1 gap-3">
                {members.map(member => (
                  <Card key={member.id} className="bg-card border-l-4 border-l-indigo-400">
                    <CardContent className="p-3 flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-base flex items-center gap-2">
                          {member.name} 
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{member.email || 'No email'}</div>
                        <div className="text-xs text-muted-foreground">{member.phone || 'No phone'}</div>
                        {member.notes && (
                          <div className="mt-2 text-xs bg-muted p-1.5 rounded italic">
                            "{member.notes}"
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                         <Button 
                           size="sm" 
                           variant="outline" 
                           className="h-7 text-xs"
                           onClick={() => {
                             setSelectedMember(member);
                             setIsMemberProfileOpen(true);
                           }}
                         >
                           Profile
                         </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <BookingDetailsSidebar 
          booking={selectedBooking}
          isOpen={isEditSidebarOpen}
          onClose={() => {
            setIsEditSidebarOpen(false);
            setSelectedBooking(null);
          }}
        />

        <MemberProfileDialog
          member={selectedMember}
          isOpen={isMemberProfileOpen}
          onClose={() => {
            setIsMemberProfileOpen(false);
            setSelectedMember(null);
          }}
          onMemberUpdated={fetchMembers}
        />
      </div>
    </DashboardLayout>
  );
}
