import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Edit } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { BookingRow } from "@/services/bookingService";
import { BookingDetailsSidebar } from "@/components/bookings/BookingDetailsSidebar";
import { formatVenue, formatBookingType, formatVenueArea, formatDuration } from "@/utils/formattingUtils";

interface ScheduleTableProps {
  bookings: BookingRow[];
}

export const ScheduleTable = ({ bookings }: ScheduleTableProps) => {
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleViewBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (booking) {
      setSelectedBooking(booking);
      setIsSidebarOpen(true);
    }
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedBooking(null);
  };

import { formatVenue, formatBookingType, formatVenueArea, formatDuration } from "@/utils/formattingUtils";

  if (bookings.length === 0) {
    return (
      <div className="rounded-md border border-gm-neutral-200 dark:border-gm-neutral-700 p-8 text-center">
        <p className="text-gm-neutral-500 dark:text-gm-neutral-400">No bookings scheduled for today</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-gm-neutral-200 dark:border-gm-neutral-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">
                  <div>
                    <div>{booking.start_time || 'All day'}</div>
                    <div className="text-xs text-gm-neutral-500 dark:text-gm-neutral-400">
                      {formatVenue(booking.venue)}
                      {booking.venue_area && ` - ${formatVenueArea(booking.venue_area)}`}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div>{formatBookingType(booking.booking_type)}</div>
                    <div className="text-xs text-gm-neutral-500 dark:text-gm-neutral-400">
                      {formatDuration(booking.duration_hours, booking.start_time, booking.end_time)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div>{booking.customer_name}</div>
                    <div className="text-xs text-gm-neutral-500 dark:text-gm-neutral-400">
                      {booking.customer_phone || booking.customer_email || 'No contact'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{booking.guest_count || '-'}</TableCell>
                <TableCell>
                  <StatusBadge status={booking.status as 'pending' | 'confirmed' | 'cancelled'} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewBooking(booking.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewBooking(booking.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BookingDetailsSidebar
        booking={selectedBooking}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
    </>
  );
};
