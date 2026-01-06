import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, MapPin, Clock, Ticket, DollarSign, Mic, FileText } from "lucide-react";
import { BookingRow } from "@/services/bookingService";
import { formatDateUK } from "@/utils/dateUtils";
import { formatCurrency } from "@/utils/currencyUtils";
import { formatVenue, formatBookingType, formatVenueArea, getStatusColor } from "@/utils/formattingUtils";

interface BookingDetailsViewProps {
  booking: BookingRow;
  karaokeBoothData?: {
    name: string;
    hourly_rate: number;
  } | null;
}

export const BookingDetailsView = ({ booking, karaokeBoothData }: BookingDetailsViewProps) => {
  const isKaraokeBooking = booking.booking_type === 'karaoke_booking' || 
    (booking.booking_type === 'venue_hire' && booking.venue_area === 'karaoke');

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <Badge className={getStatusColor(booking.status)}>
        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
      </Badge>

      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{booking.customer_name}</span>
            </div>
            {booking.customer_email && (
              <div className="text-sm text-gray-600">
                📧 {booking.customer_email}
              </div>
            )}
            {booking.customer_phone && (
              <div className="text-sm text-gray-600">
                📞 {booking.customer_phone}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Booking Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>{formatDateUK(booking.booking_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{formatVenue(booking.venue)}</span>
              {booking.venue_area && (
                <span className="text-sm text-gray-600">
                  • {formatVenueArea(booking.venue_area)}
                </span>
              )}
            </div>
            {booking.karaoke_booth_id && karaokeBoothData && (
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{karaokeBoothData.name}</span>
                <span className="text-sm text-gray-600">
                  • ${karaokeBoothData.hourly_rate}/hour
                </span>
              </div>
            )}
            {booking.start_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>{booking.start_time}</span>
                {booking.end_time && (
                  <span className="text-gray-600"> - {booking.end_time}</span>
                )}
              </div>
            )}
            {booking.guest_count && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span>{booking.guest_count} guests</span>
              </div>
            )}
            {booking.ticket_quantity && (
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-gray-500" />
                <span>{booking.ticket_quantity} tickets</span>
              </div>
            )}
            {booking.total_amount && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{formatCurrency(booking.total_amount, { excludeGST: true, currency: 'AUD' })}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      {(booking.special_requests || booking.staff_notes) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {booking.special_requests && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Special Requests</h4>
                  <p className="text-sm text-gray-600">{booking.special_requests}</p>
                </div>
              )}
              {booking.staff_notes && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Staff Notes</h4>
                  <p className="text-sm text-gray-600">{booking.staff_notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

