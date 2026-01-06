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
import { CheckCheck, Search, Users, Mic2, Calendar, ArrowLeft, UserPlus, Star, Pencil, Check, X } from "lucide-react";
import { QuickAddBookingDialog } from "@/components/bookings/QuickAddBookingDialog";
import { BookingDetailsSidebar } from "@/components/bookings/BookingDetailsSidebar";
import { customerService, CustomerRow } from "@/services/customerService";
import { AddMemberDialog } from "@/components/members/AddMemberDialog";
import { MemberProfileDialog } from "@/components/members/MemberProfileDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type VenueFilter = 'all' | 'manor' | 'hippie';

interface AttendanceState {
  vip: Record<string, boolean[]>;
  karaoke: Record<string, boolean>;
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

  // Editing
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [isEditSidebarOpen, setIsEditSidebarOpen] = useState(false);
  
  // Inline guest name editing
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingGuestName, setEditingGuestName] = useState<string>("");
  const [savingGuestName, setSavingGuestName] = useState(false);
  
  // Member management
  const [selectedMember, setSelectedMember] = useState<CustomerRow | null>(null);
  const [isMemberProfileOpen, setIsMemberProfileOpen] = useState(false);
  
  const queryClient = useQueryClient();

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
        setAttendance({ vip: migratedVip, karaoke: parsed.karaoke || {} });
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
      } catch (error) {
        console.error('Error fetching members:', error);
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

  const { data: vipBookings = [], isLoading: loadingVip } = useBookings(guestFilters as any);
  const { data: karaokeBookings = [], isLoading: loadingKaraoke } = useBookings(karaokeFilters as any);

  // Stats
  const totalVipTickets = useMemo(() => vipBookings.reduce((sum, b) => sum + (b.ticket_quantity || 0), 0), [vipBookings]);
  const checkedVipTickets = useMemo(() => {
    return vipBookings.reduce((sum, b) => {
      const local = attendance.vip[b.id];
      if (Array.isArray(local)) return sum + local.filter(Boolean).length;
      const stored = ((b as any).ticket_checkins as (string | null)[] | undefined) || [];
      return sum + stored.filter(Boolean).length;
    }, 0);
  }, [vipBookings, attendance.vip]);
  const vipPercent = totalVipTickets > 0 ? Math.round((checkedVipTickets / totalVipTickets) * 100) : 0;

  const totalKaraoke = karaokeBookings.length;
  const checkedKaraoke = useMemo(() => karaokeBookings.reduce((sum, b) => sum + (attendance.karaoke[b.id] ? 1 : 0), 0), [karaokeBookings, attendance.karaoke]);
  const karaokePercent = totalKaraoke > 0 ? Math.round((checkedKaraoke / totalKaraoke) * 100) : 0;

  const isToday = selectedDate === formatDateToISO(new Date());

  // Handlers
  const updateCheckins = async (bookingId: string, nextState: boolean[]) => {
    setAttendance(prev => ({ ...prev, vip: { ...prev.vip, [bookingId]: nextState } }));
    const checkins = nextState.map(c => (c ? new Date().toISOString() : null));
    try {
      await updateVipTicketCheckins(bookingId, checkins);
    } catch (e) {
      console.error(e);
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

  const handleKaraokeToggle = (bookingId: string, checked: boolean) => {
    setAttendance(prev => ({ ...prev, karaoke: { ...prev.karaoke, [bookingId]: checked } }));
  };

  const handleBookingClick = (booking: BookingRow) => {
    setSelectedBooking(booking);
    setIsEditSidebarOpen(true);
  };

  const handleBackToToday = () => {
    setSelectedDate(formatDateToISO(new Date()));
  };

  const handleStartEditGuest = (guestId: string, currentName: string) => {
    setEditingGuestId(guestId);
    setEditingGuestName(currentName);
  };

  const handleCancelEditGuest = () => {
    setEditingGuestId(null);
    setEditingGuestName("");
  };

  const handleSaveGuestName = async (bookingId: string, ticketIndex: number, rowId: string, guestId: string | null) => {
    if (savingGuestName) return;
    
    setSavingGuestName(true);
    try {
      const trimmedName = editingGuestName.trim();
      
      if (trimmedName === '') {
        // If name is empty and guest exists, delete it
        if (guestId) {
          const { error: deleteError } = await supabase
            .from('booking_guests')
            .delete()
            .eq('id', guestId);
          
          if (deleteError) throw deleteError;
        }
        // If no guest ID, nothing to delete
      } else {
        // Update or insert the guest name
        if (guestId) {
          // Update existing guest
          const { error: updateError } = await supabase
            .from('booking_guests')
            .update({ guest_name: trimmedName })
            .eq('id', guestId);
          
          if (updateError) throw updateError;
        } else {
          // Get all current guests to maintain order
          const { data: currentGuests, error: fetchError } = await supabase
            .from('booking_guests')
            .select('id, guest_name, is_organiser')
            .eq('booking_id', bookingId)
            .order('created_at');

          if (fetchError) throw fetchError;

          const guests = currentGuests || [];
          const guestNames = guests.map(g => g.guest_name);
          
          // Ensure array is long enough, fill with empty strings if needed
          while (guestNames.length <= ticketIndex) {
            guestNames.push('');
          }
          
          // Update the name at the target index
          guestNames[ticketIndex] = trimmedName;
          
          // Delete all existing guests for this booking
          const { error: deleteError } = await supabase
            .from('booking_guests')
            .delete()
            .eq('booking_id', bookingId);
          
          if (deleteError) throw deleteError;
          
          // Re-insert all guests (only non-empty ones, preserving organiser flags)
          const toInsert = guestNames.map((name, idx) => {
            const existingGuest = guests[idx];
            return {
              booking_id: bookingId,
              guest_name: name.trim(),
              is_organiser: existingGuest?.is_organiser || false,
            };
          }).filter(g => g.guest_name.length > 0); // Only insert non-empty names
          
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('booking_guests')
              .insert(toInsert);
            
            if (insertError) throw insertError;
          }
        }
      }

      // Refresh the bookings data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      setEditingGuestId(null);
      setEditingGuestName("");
    } catch (error) {
      console.error('Error saving guest name:', error);
      alert('Failed to save guest name. Please try again.');
    } finally {
      setSavingGuestName(false);
    }
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
                  <span className="font-mono">{checkedVipTickets}/{totalVipTickets}</span>
                </div>
                <Progress value={vipPercent} className="h-2" indicatorClassName="bg-emerald-500" />
              </CardContent>
            </Card>
            <Card className="bg-card/50 border shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium"><Mic2 className="h-3.5 w-3.5" /> Karaoke</span>
                  <span className="font-mono">
                    {Number.isFinite(checkedKaraoke) ? checkedKaraoke : 0}/{Number.isFinite(totalKaraoke) ? totalKaraoke : 0}
                  </span>
                </div>
                <Progress value={Number.isFinite(karaokePercent) ? karaokePercent : 0} className="h-2" indicatorClassName="bg-blue-500" />
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
              <TabsTrigger value="guests">Guests ({vipBookings.length})</TabsTrigger>
              <TabsTrigger value="karaoke">Karaoke ({karaokeBookings.length})</TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                 <Star className="h-3.5 w-3.5" /> Members
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex justify-between items-center px-1">
             <div className="text-xs text-muted-foreground font-medium">
               {activeTab === 'guests' && `${checkedVipTickets} checked in`}
               {activeTab === 'karaoke' && `${checkedKaraoke} checked in`}
               {activeTab === 'members' && `${members.length} found`}
             </div>
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
          </div>
        </div>

        {/* Main Content List */}
        <div className="space-y-4 min-h-[50vh]">
          {activeTab === 'guests' && (
            <div className="space-y-0">
              {/* Flatten all guests into individual rows */}
              {(() => {
                if (loadingVip) return null;
                // Build flat list of all guests
                const flatGuests: Array<{
                  id: string;
                  guestId: string | null; // ID from booking_guests table, null if doesn't exist yet
                  guestName: string;
                  bookingId: string;
                  ticketIndex: number;
                  referenceCode: string;
                  isChecked: boolean;
                  isOrganiser: boolean;
                  organiserName: string | null; // Name of the occasion organiser
                  booking: BookingRow;
                }> = [];

                // Build a map of booking IDs to organiser names for occasion bookings
                const organiserMap = new Map<string, string>();
                vipBookings.forEach((booking) => {
                  const parentBookingId = (booking as any).parent_booking_id;
                  const isOccasionOrganiser = (booking as any).is_occasion_organiser === true;
                  
                  if (isOccasionOrganiser) {
                    // This booking is the organiser, use its customer_name
                    organiserMap.set(booking.id, booking.customer_name || '');
                  } else if (parentBookingId) {
                    // Find the parent booking to get organiser name
                    const parentBooking = vipBookings.find(b => b.id === parentBookingId);
                    if (parentBooking) {
                      organiserMap.set(booking.id, parentBooking.customer_name || '');
                    }
                  }
                });

                vipBookings.forEach((booking) => {
                  const max = booking.ticket_quantity || 0;
                  const checkins = attendance.vip[booking.id] || [];
                  
                  // Extract guest names, IDs, and organiser flags from booking_guests relationship
                  const bookingGuests = (booking as any).booking_guests || [];
                  const guestData = Array.isArray(bookingGuests) 
                    ? bookingGuests.map((g: any) => ({
                        id: g?.id || null,
                        name: g?.guest_name || '',
                        isOrganiser: g?.is_organiser === true
                      }))
                    : [];

                  // Get organiser name for this booking
                  const organiserName = organiserMap.get(booking.id) || null;

                  // Add each ticket as a row
                  for (let idx = 0; idx < max; idx++) {
                    const isChecked = !!checkins[idx];
                    
                    // Skip individual checked guests if showCheckedOff is false
                    if (!showCheckedOff && isChecked) continue;
                    
                    const guestInfo = guestData[idx] || { id: null, name: '', isOrganiser: false };
                    const guestName = guestInfo.name || `Ticket #${idx + 1}`;

                    flatGuests.push({
                      id: `${booking.id}-${idx}`, // Unique row ID
                      guestId: guestInfo.id, // booking_guests table ID (null if not yet created)
                      guestName,
                      bookingId: booking.id,
                      ticketIndex: idx,
                      referenceCode: booking.reference_code || 'NO-REF',
                      isChecked,
                      isOrganiser: guestInfo.isOrganiser,
                      organiserName,
                      booking,
                    });
                  }
                });

                if (flatGuests.length === 0) {
                  return (
                    <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">
                      No guests found for this date.
                    </div>
                  );
                }

                return (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Name</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Reference</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Organiser</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Check-in</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flatGuests.map((guest) => {
                          return (
                            <tr 
                              key={guest.id}
                              className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                                guest.isChecked ? 'opacity-60 bg-muted/20' : ''
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {editingGuestId === guest.id ? (
                                    <>
                                      <Input
                                        value={editingGuestName}
                                        onChange={(e) => setEditingGuestName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveGuestName(guest.bookingId, guest.ticketIndex, guest.id, guest.guestId);
                                          } else if (e.key === 'Escape') {
                                            handleCancelEditGuest();
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
                                        onClick={() => handleSaveGuestName(guest.bookingId, guest.ticketIndex, guest.id, guest.guestId)}
                                        disabled={savingGuestName}
                                      >
                                        <Check className="h-3.5 w-3.5 text-green-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-muted"
                                        onClick={handleCancelEditGuest}
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
                                          handleStartEditGuest(guest.id, guest.guestName);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                      <span className={`text-sm font-medium ${guest.isChecked ? 'text-muted-foreground line-through' : ''}`}>
                                        {guest.guestName}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm font-mono text-muted-foreground">{guest.referenceCode}</span>
                              </td>
                              <td className="py-3 px-4">
                                {guest.isOrganiser ? (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
                                    Organiser
                                  </Badge>
                                ) : guest.organiserName ? (
                                  <span className="text-sm text-muted-foreground">{guest.organiserName}</span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex justify-end">
                                  <Checkbox 
                                    checked={guest.isChecked} 
                                    onCheckedChange={() => handleVipToggle(guest.bookingId, guest.ticketIndex, guest.booking.ticket_quantity || 0)}
                                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'karaoke' && (
            <div className="grid grid-cols-1 gap-3">
              {karaokeBookings.length === 0 && !loadingKaraoke && (
                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">No karaoke bookings found.</div>
              )}

              {karaokeBookings.map((booking) => {
                const isChecked = !!attendance.karaoke[booking.id];
                if (!showCheckedOff && isChecked) return null;

                return (
                  <Card key={booking.id} className={`border-l-4 ${isChecked ? 'opacity-60 bg-muted/30 border-l-muted' : 'border-l-blue-500'}`}>
                    <div className="p-3 flex items-center gap-4">
                      <div 
                        className="cursor-pointer" 
                        onClick={() => handleKaraokeToggle(booking.id, !isChecked)}
                      >
                        <Checkbox checked={isChecked} className="h-6 w-6 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                      </div>
                      <div 
                        className="flex-1 space-y-1 cursor-pointer"
                        onClick={() => handleBookingClick(booking)}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-base ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                            {booking.customer_name}
                          </h3>
                          <Badge variant="outline" className="ml-2 whitespace-nowrap">{booking.start_time?.slice(0, 5)}</Badge>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="font-mono text-foreground/80">{booking.reference_code || 'REF'}</span>
                          <span>{booking.guest_count} guests</span>
                          {booking.karaoke_booth_id && <span>Booth {booking.karaoke_booth_id}</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
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
