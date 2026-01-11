import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { occasionService, OccasionWithStats } from '@/services/occasionService';
import { Copy, Check, ExternalLink, Users, Calendar, DollarSign, Mail, Phone, Plus, UserPlus, Trash2, Edit, Save, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface OccasionDetailPanelProps {
  occasionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export default function OccasionDetailPanel({ occasionId, open, onOpenChange, onRefresh }: OccasionDetailPanelProps) {
  const [occasion, setOccasion] = useState<OccasionWithStats | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [allGuests, setAllGuests] = useState<{ name: string; invitedBy: string; isOrganiser: boolean; bookingId: string; index: number }[]>([]);
  const [editingGuests, setEditingGuests] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedOrganiser, setCopiedOrganiser] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [showAddGuestsDialog, setShowAddGuestsDialog] = useState(false);
  const [guestsToAdd, setGuestsToAdd] = useState(1);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<{ bookingId: string; index: number; name: string } | null>(null);
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
      const guests: { name: string; invitedBy: string; isOrganiser: boolean; bookingId: string; index: number }[] = [];
      
      // Add organiser first
      if (occasionData.organiser_name) {
        guests.push({
          name: occasionData.organiser_name,
          invitedBy: 'Organiser',
          isOrganiser: true,
          bookingId: occasionData.id,
          index: 0
        });
      }
      
      // Add all guests from bookings
      bookingsData.forEach((booking: any) => {
        const invitedBy = booking.customer_name || 'Unknown';
        const ticketQuantity = booking.ticket_quantity || 0;
        const existingGuests = booking.booking_guests || [];
        
        // Add all tickets (with or without names)
        for (let i = 0; i < ticketQuantity; i++) {
          const guestName = existingGuests[i]?.guest_name || '';
          guests.push({
            name: guestName,
            invitedBy,
            isOrganiser: false,
            bookingId: booking.id,
            index: i
          });
        }
      });
      
      // Sort guests to ensure organiser is always at the top
      guests.sort((a, b) => {
        if (a.isOrganiser && !b.isOrganiser) return -1
        if (!a.isOrganiser && b.isOrganiser) return 1
        return 0
      });
      
      setAllGuests(guests);
      
      // Initialize editing state with current names
      const initialEditing: { [key: string]: string } = {};
      guests.forEach((guest) => {
        initialEditing[`${guest.bookingId}-${guest.index}`] = guest.name;
      });
      setEditingGuests(initialEditing);
    } catch (err) {
      console.error('Failed to load occasion:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'organiser' | 'share') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'organiser') {
        setCopiedOrganiser(true);
        setTimeout(() => setCopiedOrganiser(false), 2000);
      } else {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleStartEdit = () => {
    if (!occasion) return;
    setEditingOccasionName(occasion.occasion_name);
    setEditingCapacity(occasion.capacity);
    setEditingTicketPrice(occasion.ticket_price_cents / 100);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!occasion) return;
    setEditingOccasionName(occasion.occasion_name);
    setEditingCapacity(occasion.capacity);
    setEditingTicketPrice(occasion.ticket_price_cents / 100);
    setIsEditing(false);
  };

  const handleSaveOccasion = async () => {
    if (!occasion || !occasionId) return;
    
    setSavingOccasion(true);
    try {
      await occasionService.updateOccasion(occasionId, {
        name: editingOccasionName,
        capacity: editingCapacity,
        ticket_price_cents: Math.round(editingTicketPrice * 100),
      });
      
      setIsEditing(false);
      await loadOccasion();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to save occasion:', err);
      alert('Failed to save occasion details. Please try again.');
    } finally {
      setSavingOccasion(false);
    }
  };

  const handleGuestNameChange = (bookingId: string, index: number, value: string) => {
    const key = `${bookingId}-${index}`;
    setEditingGuests(prev => ({
      ...prev,
      [key]: value
    }));
    setSaveSuccess(false);
  };

  const saveGuestList = async () => {
    if (!occasion) return;
    
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      // Group guests by booking ID
      const guestsByBooking: { [bookingId: string]: string[] } = {};
      
      allGuests.forEach((guest) => {
        if (!guestsByBooking[guest.bookingId]) {
          guestsByBooking[guest.bookingId] = [];
        }
        const key = `${guest.bookingId}-${guest.index}`;
        const name = editingGuests[key] || '';
        guestsByBooking[guest.bookingId].push(name);
      });
      
      // Update each booking's guests using the occasion service
      for (const [bookingId, names] of Object.entries(guestsByBooking)) {
        await occasionService.updateBookingGuests(bookingId, names);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Refresh the occasion data
      if (onRefresh) {
        onRefresh();
      }
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
      // Create a new booking for these additional guests
      await occasionService.addManualGuestsToOccasion(occasion.id, guestsToAdd);
      
      setShowAddGuestsDialog(false);
      
      // Refresh the occasion data
      if (onRefresh) {
        onRefresh();
      }
      await loadOccasion();
    } catch (err) {
      console.error('Error adding guests:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add guests. Please try again.';
      alert(errorMessage);
    }
  };

  const addSingleGuest = async () => {
    if (!occasion) return;
    
    try {
      // Add a single guest
      await occasionService.addManualGuestsToOccasion(occasion.id, 1);
      
      // Refresh the occasion data
      if (onRefresh) {
        onRefresh();
      }
      await loadOccasion();
    } catch (err) {
      console.error('Error adding guest:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add guest. Please try again.';
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
      
      // Refresh the occasion data
      if (onRefresh) {
        onRefresh();
      }
      await loadOccasion();
    } catch (err) {
      console.error('Error deleting guest:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete guest. Please try again.';
      alert(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  if (!occasion) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" hideCloseButton>
          <SheetHeader>
            <SheetTitle>Occasion Details</SheetTitle>
          </SheetHeader>
          {loading && <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>}
        </SheetContent>
      </Sheet>
    );
  }

  const organiserUrl = occasionService.getOrganiserUrl(occasion);
  const shareUrl = occasionService.getShareUrl(occasion);
  const formattedDate = occasion.occasion_date 
    ? format(parseISO(occasion.occasion_date), 'EEEE, MMMM d, yyyy')
    : 'Date not set';
  const ticketPrice = (occasion.ticket_price_cents / 100).toFixed(2);
  const capacityPercent = (occasion.total_guests / occasion.capacity) * 100;

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
                  <SheetTitle className="text-3xl font-bold dark:text-white text-left">{occasion.occasion_name}</SheetTitle>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant={occasion.venue === 'manor' ? 'default' : 'secondary'}>
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
                    <Button
                      size="sm"
                      onClick={handleSaveOccasion}
                      disabled={savingOccasion}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savingOccasion ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm mb-1">
                <Users className="h-4 w-4" />
                <span>Capacity</span>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={editingCapacity}
                    onChange={(e) => setEditingCapacity(parseInt(e.target.value) || 0)}
                    className="text-2xl font-semibold h-auto py-2"
                    min={occasion.total_guests}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.max(0, editingCapacity - occasion.total_guests)} spots left
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-semibold dark:text-white">{occasion.total_guests}/{occasion.capacity}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {occasion.remaining_capacity} spots left
                  </div>
                  <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm mb-1">
                <Calendar className="h-4 w-4" />
                <span>Date</span>
              </div>
              <div className="text-sm font-medium dark:text-white">{formattedDate}</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Ticket Price</span>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-semibold dark:text-white">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingTicketPrice}
                      onChange={(e) => setEditingTicketPrice(parseFloat(e.target.value) || 0)}
                      className="text-2xl font-semibold h-auto py-2 flex-1"
                      min="0"
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">per ticket</div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-semibold dark:text-white">${ticketPrice}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">per ticket</div>
                </>
              )}
            </div>
          </div>

          {/* Organiser Details */}
          {(occasion.organiser_name || occasion.organiser_email || occasion.organiser_phone) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 dark:text-white">Organiser</h3>
                <div className="space-y-2 text-sm">
                  {occasion.organiser_name && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <span className="dark:text-gray-200">{occasion.organiser_name}</span>
                    </div>
                  )}
                  {occasion.organiser_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <a href={`mailto:${occasion.organiser_email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {occasion.organiser_email}
                      </a>
                    </div>
                  )}
                  {occasion.organiser_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <a href={`tel:${occasion.organiser_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {occasion.organiser_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Links */}
          <Separator />
          <div className="space-y-4">
            <h3 className="font-semibold dark:text-white">Shareable Links</h3>
            
            {/* Organiser Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Organiser Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={organiserUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 text-sm font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(organiserUrl, 'organiser')}
                >
                  {copiedOrganiser ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(organiserUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Share this with the organiser to manage their guest list</p>
            </div>

            {/* Share Link for Friends */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Friend Purchase Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 text-sm font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(shareUrl, 'share')}
                >
                  {copiedShare ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(shareUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Share this link so friends can purchase tickets</p>
            </div>
          </div>

          {/* Guest List Table */}
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
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add guests
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveGuestList}
                    disabled={saving}
                  >
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

            {allGuests.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No guests yet</p>
            ) : (
              <>
                <div className="overflow-x-auto border dark:border-gray-700 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr className="border-b dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">#</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Guest Name</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Invited By</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Tags</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="dark:bg-gray-900">
                      {allGuests.map((guest, idx) => {
                        const key = `${guest.bookingId}-${guest.index}`;
                        const currentValue = editingGuests[key] || '';
                        
                        return (
                          <tr key={idx} className="border-b dark:border-gray-700 last:border-b-0">
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{idx + 1}</td>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={currentValue}
                                onChange={(e) => handleGuestNameChange(guest.bookingId, guest.index, e.target.value)}
                                placeholder={`Guest ${idx + 1} full name`}
                                disabled={guest.isOrganiser}
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
                            <td className="py-3 px-4 text-right">
                              {!guest.isOrganiser && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteGuest(guest.bookingId, guest.index, currentValue || `Guest ${idx + 1}`)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Add Single Guest Button */}
                <div className="mt-3 flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addSingleGuest}
                    className="text-sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add single guest
                  </Button>
                </div>
              </>
            )}

            {allGuests.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Update guest names as needed. Changes will be saved to the database.
              </p>
            )}
          </div>

          {/* Add Guests Dialog */}
          <Dialog open={showAddGuestsDialog} onOpenChange={setShowAddGuestsDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Guests</DialogTitle>
                <DialogDescription>
                  How many guests would you like to add to this occasion?
                  {occasion && occasion.remaining_capacity !== undefined && (
                    <span className="block mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {occasion.remaining_capacity} spots remaining (Capacity: {occasion.capacity})
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="guest-count">Number of guests</Label>
                <Input
                  id="guest-count"
                  type="number"
                  min="1"
                  max={occasion?.remaining_capacity || 50}
                  value={guestsToAdd}
                  onChange={(e) => {
                    const value = Math.max(1, parseInt(e.target.value) || 1);
                    const maxAllowed = occasion?.remaining_capacity || 50;
                    setGuestsToAdd(Math.min(value, maxAllowed));
                  }}
                  className="mt-2"
                />
                {occasion && guestsToAdd > (occasion.remaining_capacity || 0) && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    Cannot exceed remaining capacity
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddGuestsDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={confirmAddGuests}
                  disabled={guestsToAdd > (occasion?.remaining_capacity || 0)}
                >
                  Add {guestsToAdd} {guestsToAdd === 1 ? 'guest' : 'guests'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Guest Confirmation Dialog */}
          <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove Guest</DialogTitle>
                <DialogDescription>
                  Are you sure you want to remove <strong>{guestToDelete?.name || 'this guest'}</strong> from the guest list?
                  <span className="block mt-2 text-sm">
                    This action cannot be undone. The guest will be removed from the booking.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeleteConfirmDialog(false);
                    setGuestToDelete(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={confirmDeleteGuest}
                  disabled={deleting}
                >
                  {deleting ? 'Removing...' : 'Remove Guest'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Notes */}
          {occasion.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 dark:text-white">Notes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{occasion.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

