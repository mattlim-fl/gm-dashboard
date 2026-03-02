import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { occasionService, OccasionWithStats } from '@/services/occasionService';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Save, X } from 'lucide-react';
import GuestListGrouped from './GuestListGrouped';
import { OccasionStatsGrid } from './OccasionStatsGrid';
import { OrganiserDetails } from './OrganiserDetails';
import { ShareableLinks } from './ShareableLinks';
import { AddGuestsDialog } from './AddGuestsDialog';
import { DeleteGuestDialog } from './DeleteGuestDialog';
import { OccasionNotes } from './OccasionNotes';

interface OccasionDetailPanelProps {
  occasionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

interface GuestEntry {
  name: string;
  invitedBy: string;
  isOrganiser: boolean;
  bookingId: string;
  index: number;
  notes?: string;
  guestId?: string;
}

export default function OccasionDetailPanel({
  occasionId,
  open,
  onOpenChange,
  onRefresh,
}: OccasionDetailPanelProps) {
  const [occasion, setOccasion] = useState<OccasionWithStats | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [allGuests, setAllGuests] = useState<GuestEntry[]>([]);
  const [editingGuests, setEditingGuests] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dialog state
  const [showAddGuestsDialog, setShowAddGuestsDialog] = useState(false);
  const [guestsToAdd, setGuestsToAdd] = useState(1);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<{
    bookingId: string;
    index: number;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Editing occasion details
  const [isEditing, setIsEditing] = useState(false);
  const [editingOccasionName, setEditingOccasionName] = useState('');
  const [editingCapacity, setEditingCapacity] = useState(0);
  const [editingTicketPrice, setEditingTicketPrice] = useState(0);
  const [savingOccasion, setSavingOccasion] = useState(false);

  useEffect(() => {
    if (occasionId && open) {
      loadOccasion();
    }
  }, [occasionId, open]);

  const loadOccasion = async () => {
    if (!occasionId) return;

    setLoading(true);
    try {
      const [occasionData, bookingsData] = await Promise.all([
        occasionService.getOccasion(occasionId),
        occasionService.getOccasionBookings(occasionId),
      ]);
      setOccasion(occasionData);
      setBookings(bookingsData);

      // Initialize editing state
      setEditingOccasionName(occasionData.occasion_name);
      setEditingCapacity(occasionData.capacity);
      setEditingTicketPrice(occasionData.ticket_price_cents / 100);

      // Build flat guest list
      const guests: GuestEntry[] = [];

      // Add organiser first
      if (occasionData.organiser_name) {
        guests.push({
          name: occasionData.organiser_name,
          invitedBy: 'Organiser',
          isOrganiser: true,
          bookingId: occasionData.id,
          index: 0,
        });
      }

      // Add all guests from bookings
      bookingsData.forEach((booking: any) => {
        const invitedBy = booking.customer_name || 'Unknown';
        const ticketQuantity = booking.ticket_quantity || 0;
        const existingGuests = booking.booking_guests || [];

        for (let i = 0; i < ticketQuantity; i++) {
          const guestRecord = existingGuests[i];
          const guestName = guestRecord?.guest_name || '';
          guests.push({
            name: guestName,
            invitedBy,
            isOrganiser: false,
            bookingId: booking.id,
            index: i,
            notes: guestRecord?.notes || '',
            guestId: guestRecord?.id,
          });
        }
      });

      setAllGuests(guests);

      // Initialize editing state for guests
      const editingState: { [key: string]: string } = {};
      guests.forEach((guest) => {
        if (!guest.isOrganiser) {
          editingState[`${guest.bookingId}-${guest.index}`] = guest.name;
        }
      });
      setEditingGuests(editingState);
    } catch (err) {
      console.error('Error loading occasion:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    if (occasion) {
      setEditingOccasionName(occasion.occasion_name);
      setEditingCapacity(occasion.capacity);
      setEditingTicketPrice(occasion.ticket_price_cents / 100);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveOccasion = async () => {
    if (!occasion || !occasionId) return;

    setSavingOccasion(true);
    try {
      await occasionService.updateOccasion(occasionId, {
        occasion_name: editingOccasionName,
        capacity: editingCapacity,
        ticket_price_cents: Math.round(editingTicketPrice * 100),
      });

      setIsEditing(false);
      if (onRefresh) onRefresh();
      await loadOccasion();
    } catch (err) {
      console.error('Error saving occasion:', err);
      alert('Failed to save occasion. Please try again.');
    } finally {
      setSavingOccasion(false);
    }
  };

  const handleGuestNameChange = (bookingId: string, index: number, name: string) => {
    setEditingGuests((prev) => ({
      ...prev,
      [`${bookingId}-${index}`]: name,
    }));
  };

  const saveGuestList = async () => {
    if (!occasion) return;

    setSaving(true);
    try {
      const guestsByBooking: { [bookingId: string]: string[] } = {};

      allGuests.forEach((guest) => {
        if (guest.isOrganiser) return;

        if (!guestsByBooking[guest.bookingId]) {
          guestsByBooking[guest.bookingId] = [];
        }
        const key = `${guest.bookingId}-${guest.index}`;
        const name = editingGuests[key] || '';
        guestsByBooking[guest.bookingId].push(name);
      });

      for (const [bookingId, names] of Object.entries(guestsByBooking)) {
        await occasionService.updateBookingGuests(bookingId, names);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onRefresh) onRefresh();
      await loadOccasion();
    } catch (err) {
      console.error('Error saving guest list:', err);
      alert('Failed to save guest list. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddGuests = () => {
    setGuestsToAdd(1);
    setShowAddGuestsDialog(true);
  };

  const confirmAddGuests = async () => {
    if (!occasion || guestsToAdd < 1) return;

    try {
      await occasionService.addManualGuestsToOccasion(occasion.id, guestsToAdd);
      setShowAddGuestsDialog(false);
      if (onRefresh) onRefresh();
      await loadOccasion();
    } catch (err) {
      console.error('Error adding guests:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to add guests. Please try again.';
      alert(errorMessage);
    }
  };

  const addSingleGuest = async () => {
    if (!occasion) return;

    try {
      await occasionService.addManualGuestsToOccasion(occasion.id, 1);
      if (onRefresh) onRefresh();
      await loadOccasion();
    } catch (err) {
      console.error('Error adding guest:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to add guest. Please try again.';
      alert(errorMessage);
    }
  };

  const handleDeleteGuest = (bookingId: string, index: number, name: string) => {
    setGuestToDelete({ bookingId, index, name });
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteGuest = async () => {
    if (!guestToDelete || !occasion) return;

    setDeleting(true);
    try {
      await occasionService.removeGuestFromBooking(guestToDelete.bookingId, guestToDelete.index);
      setShowDeleteConfirmDialog(false);
      setGuestToDelete(null);
      if (onRefresh) onRefresh();
      await loadOccasion();
    } catch (err) {
      console.error('Error deleting guest:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete guest. Please try again.';
      alert(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleGuestNotesChange = async (bookingId: string, guestIndex: number, notes: string) => {
    const guest = allGuests.find((g) => g.bookingId === bookingId && g.index === guestIndex);
    if (!guest) return;

    try {
      if (guest.guestId) {
        const { error } = await supabase
          .from('booking_guests')
          .update({ notes: notes || null })
          .eq('id', guest.guestId);

        if (error) {
          console.error('Failed to update guest notes:', error);
          return;
        }
      } else {
        const guestName = editingGuests[`${bookingId}-${guestIndex}`] || '';
        const { error } = await supabase.from('booking_guests').insert({
          booking_id: bookingId,
          guest_name: guestName,
          notes: notes || null,
        });

        if (error) {
          console.error('Failed to create guest with notes:', error);
          return;
        }
      }

      setAllGuests((prev) =>
        prev.map((g) =>
          g.bookingId === bookingId && g.index === guestIndex ? { ...g, notes } : g
        )
      );
    } catch (err) {
      console.error('Error updating guest notes:', err);
    }
  };

  if (!occasion) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" hideCloseButton>
          <SheetHeader>
            <SheetTitle>Occasion Details</SheetTitle>
          </SheetHeader>
          {loading && (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  const organiserUrl = occasionService.getOrganiserUrl(occasion);
  const shareUrl = occasionService.getShareUrl(occasion);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" hideCloseButton>
        <SheetHeader className="pb-4 border-b dark:border-gray-700 text-left">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                {isEditing ? (
                  <Input
                    value={editingOccasionName}
                    onChange={(e) => setEditingOccasionName(e.target.value)}
                    className="text-3xl font-bold h-auto py-2"
                    placeholder="Occasion name"
                  />
                ) : (
                  <SheetTitle className="text-3xl font-bold dark:text-white text-left">
                    {occasion.occasion_name}
                  </SheetTitle>
                )}
                <div className="flex items-center gap-2">
                  <Badge
                    variant={occasion.venue === 'manor' ? 'default' : 'secondary'}
                    className={
                      occasion.venue === 'hippie' ? 'bg-pink-600 text-white hover:bg-pink-600' : ''
                    }
                  >
                    {occasion.venue === 'manor' ? 'Manor' : 'Hippie Club'}
                  </Badge>
                  <Badge variant={occasion.status === 'active' ? 'default' : 'secondary'}>
                    {occasion.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={savingOccasion}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveOccasion} disabled={savingOccasion}>
                      <Save className="h-4 w-4 mr-2" />
                      {savingOccasion ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <OccasionStatsGrid
            occasion={occasion}
            isEditing={isEditing}
            editingCapacity={editingCapacity}
            editingTicketPrice={editingTicketPrice}
            onCapacityChange={setEditingCapacity}
            onTicketPriceChange={setEditingTicketPrice}
          />

          <OrganiserDetails occasion={occasion} />

          <ShareableLinks organiserUrl={organiserUrl} shareUrl={shareUrl} />

          {/* Guest List Section */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold dark:text-white">Guest List ({allGuests.length})</h3>
              {allGuests.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddGuests}
                    disabled={occasion.remaining_capacity === 0}
                    title={occasion.remaining_capacity === 0 ? 'At capacity' : undefined}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add guests
                  </Button>
                  <Button size="sm" onClick={saveGuestList} disabled={saving}>
                    {saving ? 'Saving...' : 'Save guest list'}
                  </Button>
                </div>
              )}
            </div>

            {saveSuccess && (
              <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-xs text-green-800 dark:text-green-200">
                  Guest list saved successfully.
                </p>
              </div>
            )}

            <GuestListGrouped
              guests={allGuests}
              editingGuests={editingGuests}
              organiserName={occasion?.organiser_name || 'Organiser'}
              onGuestNameChange={handleGuestNameChange}
              onDeleteGuest={handleDeleteGuest}
              onAddSingleGuest={addSingleGuest}
              onGuestNotesChange={handleGuestNotesChange}
              showActions={true}
              isAtCapacity={occasion.remaining_capacity === 0}
            />

            {allGuests.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Update guest names as needed. Changes will be saved to the database.
              </p>
            )}
          </div>

          <AddGuestsDialog
            open={showAddGuestsDialog}
            onOpenChange={setShowAddGuestsDialog}
            guestsToAdd={guestsToAdd}
            onGuestsToAddChange={setGuestsToAdd}
            remainingCapacity={occasion.remaining_capacity}
            totalCapacity={occasion.capacity}
            onConfirm={confirmAddGuests}
          />

          <DeleteGuestDialog
            open={showDeleteConfirmDialog}
            onOpenChange={setShowDeleteConfirmDialog}
            guestName={guestToDelete?.name || null}
            deleting={deleting}
            onConfirm={confirmDeleteGuest}
            onCancel={() => {
              setShowDeleteConfirmDialog(false);
              setGuestToDelete(null);
            }}
          />

          <OccasionNotes notes={occasion.notes} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
