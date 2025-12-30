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
          {loading && <div className="py-8 text-center text-gray-500">Loading...</div>}
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
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl">{occasion.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={occasion.venue === 'manor' ? 'default' : 'secondary'}>
                  {occasion.venue === 'manor' ? 'Manor' : 'Hippie Club'}
                </Badge>
                <Badge variant={occasion.status === 'active' ? 'default' : 'secondary'}>
                  {occasion.status}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Users className="h-4 w-4" />
                <span>Capacity</span>
              </div>
              <div className="text-2xl font-semibold">{occasion.total_guests}/{occasion.capacity}</div>
              <div className="text-xs text-gray-500 mt-1">
                {occasion.remaining_capacity} spots left
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Calendar className="h-4 w-4" />
                <span>Date</span>
              </div>
              <div className="text-sm font-medium">{formattedDate}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                <span>Ticket Price</span>
              </div>
              <div className="text-2xl font-semibold">${ticketPrice}</div>
              <div className="text-xs text-gray-500 mt-1">per ticket</div>
            </div>
          </div>

          {/* Organiser Details */}
          {(occasion.organiser_name || occasion.organiser_email || occasion.organiser_phone) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Organiser</h3>
                <div className="space-y-2 text-sm">
                  {occasion.organiser_name && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{occasion.organiser_name}</span>
                    </div>
                  )}
                  {occasion.organiser_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a href={`mailto:${occasion.organiser_email}`} className="text-blue-600 hover:underline">
                        {occasion.organiser_email}
                      </a>
                    </div>
                  )}
                  {occasion.organiser_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <a href={`tel:${occasion.organiser_phone}`} className="text-blue-600 hover:underline">
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
            <h3 className="font-semibold">Shareable Links</h3>
            
            {/* Organiser Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Organiser Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={organiserUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm font-mono"
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
              <p className="text-xs text-gray-500">Share this with the organiser to manage their guest list</p>
            </div>

            {/* Share Link for Friends */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Friend Purchase Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm font-mono"
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
              <p className="text-xs text-gray-500">Share this link so friends can purchase tickets</p>
            </div>
          </div>

          {/* Bookings */}
          <Separator />
          <div>
            <h3 className="font-semibold mb-3">Bookings ({occasion.total_bookings})</h3>
            {bookings.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No bookings yet</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{booking.customer_name}</div>
                        <div className="text-sm text-gray-600">
                          {booking.customer_email || booking.customer_phone}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {booking.ticket_quantity} {booking.ticket_quantity === 1 ? 'ticket' : 'tickets'}
                      </Badge>
                    </div>
                    {booking.booking_guests && booking.booking_guests.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Guests:</span>{' '}
                        {booking.booking_guests.map((g: any) => g.guest_name).join(', ')}
                      </div>
                    )}
                    {booking.reference_code && (
                      <div className="text-xs text-gray-500 font-mono">
                        Ref: {booking.reference_code}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {occasion.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{occasion.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

