
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, ExternalLink, Clock, Users, Ticket, DollarSign, MapPin, FileText } from "lucide-react";
import { BookingRow } from "@/services/bookingService";
import { formatCurrency } from "@/utils/currencyUtils";
import { formatDateCompact, formatDateFull, formatTime } from "@/utils/dateUtils";
import { getStatusColor, formatBookingTypeSimple } from "@/utils/formattingUtils";

interface BookingHistoryProps {
  bookings: BookingRow[];
  onViewAll: () => void;
}

export const BookingHistory = ({ bookings = [], onViewAll }: BookingHistoryProps) => {

  // Sort bookings by date (most recent first)
  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(a.booking_date).getTime();
    const dateB = new Date(b.booking_date).getTime();
    return dateB - dateA;
  });

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Booking History</span>
          </CardTitle>
          {bookings.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedBookings.length === 0 ? (
          <div className="text-center py-4">
            <Calendar className="h-8 w-8 text-gm-neutral-300 mx-auto mb-2" />
            <p className="text-gm-neutral-600 text-sm">No bookings yet</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {sortedBookings.map((booking) => (
              <AccordionItem key={booking.id} value={booking.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-left">
                        <div className="font-medium text-sm">
                          {formatDateFull(booking.booking_date)}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <span>{formatBookingTypeSimple(booking.booking_type)}</span>
                          {booking.venue && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{booking.venue}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {booking.total_amount && (
                        <div className="text-sm font-medium">
                          {formatCurrency(booking.total_amount, { currency: 'AUD' })}
                        </div>
                      )}
                      <Badge className={`${getStatusColor(booking.status || 'pending')} text-xs`}>
                        {booking.status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2 pb-1">
                    {/* Booking Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {booking.start_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Time:</span>
                          <span className="font-medium">
                            {formatTime(booking.start_time)}
                            {booking.end_time && ` - ${formatTime(booking.end_time)}`}
                          </span>
                        </div>
                      )}
                      {booking.duration_hours && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{booking.duration_hours} hour{booking.duration_hours !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {booking.guest_count && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Guests:</span>
                          <span className="font-medium">{booking.guest_count}</span>
                        </div>
                      )}
                      {booking.ticket_quantity && (
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Tickets:</span>
                          <span className="font-medium">{booking.ticket_quantity}</span>
                        </div>
                      )}
                      {booking.venue_area && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Area:</span>
                          <span className="font-medium capitalize">{booking.venue_area.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {booking.reference_code && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Reference:</span>
                          <span className="font-mono text-xs">{booking.reference_code}</span>
                        </div>
                      )}
                    </div>

                    {/* Special Requests */}
                    {booking.special_requests && (
                      <div className="pt-2 border-t">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Special Requests</div>
                            <p className="text-sm">{booking.special_requests}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Staff Notes */}
                    {booking.staff_notes && (
                      <div className="pt-2 border-t">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Staff Notes</div>
                            <p className="text-sm">{booking.staff_notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
