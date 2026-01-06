import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { occasionService, OccasionWithStats } from '@/services/occasionService';
import { Copy, Check, ExternalLink, Users, Calendar, DollarSign, Mail, Phone } from 'lucide-react';
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
  const [allGuests, setAllGuests] = useState<{ name: string; invitedBy: string; isOrganiser: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedOrganiser, setCopiedOrganiser] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

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
      
      // Build flat guest list
      const guests: { name: string; invitedBy: string; isOrganiser: boolean }[] = [];
      
      // Add organiser first
      if (occasionData.organiser_name) {
        guests.push({
          name: occasionData.organiser_name,
          invitedBy: 'Organiser',
          isOrganiser: true
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
            isOrganiser: false
          });
        }
      });
      
      setAllGuests(guests);
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

  if (!occasion) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b dark:border-gray-700 text-left">
          <div className="space-y-3">
            <SheetTitle className="text-3xl font-bold dark:text-white text-left">{occasion.occasion_name}</SheetTitle>
            <div className="flex items-center gap-2">
              <Badge variant={occasion.venue === 'manor' ? 'default' : 'secondary'}>
                {occasion.venue === 'manor' ? 'Manor' : 'Hippie Club'}
              </Badge>
              <Badge variant={occasion.status === 'active' ? 'default' : 'secondary'}>
                {occasion.status}
              </Badge>
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
              <div className="text-2xl font-semibold dark:text-white">${ticketPrice}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">per ticket</div>
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
            <h3 className="font-semibold mb-3 dark:text-white">Guest List ({allGuests.length})</h3>
            {allGuests.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No guests yet</p>
            ) : (
              <div className="overflow-x-auto border dark:border-gray-700 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">#</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Guest Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Invited By</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="dark:bg-gray-900">
                    {allGuests.map((guest, idx) => (
                      <tr key={idx} className="border-b dark:border-gray-700 last:border-b-0">
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{idx + 1}</td>
                        <td className="py-3 px-4 text-sm">
                          {guest.name ? (
                            <span className="text-gray-900 dark:text-gray-100">{guest.name}</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 italic">Guest {idx + 1} full name</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{guest.invitedBy}</td>
                        <td className="py-3 px-4">
                          {guest.isOrganiser && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              Organiser
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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

