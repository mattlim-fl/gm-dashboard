
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ChevronDown, ChevronUp, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { BookingRow } from "@/services/bookingService";
import { useUpdateBookingStatus } from "@/hooks/useBookings";
import { BookingDetailsSidebar } from "./BookingDetailsSidebar";
import { formatCurrency } from "@/utils/currencyUtils";
import { formatDateUK } from "@/utils/dateUtils";
import { formatVenue, formatBookingType, formatVenueArea } from "@/utils/formattingUtils";

interface BookingsTableProps {
  bookings: BookingRow[];
  sortField: keyof BookingRow;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof BookingRow) => void;
  isLoading?: boolean;
}

export const BookingsTable = ({
  bookings,
  sortField,
  sortDirection,
  onSort,
  isLoading = false
}: BookingsTableProps) => {
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const updateStatusMutation = useUpdateBookingStatus();

  const getSortIcon = (field: keyof BookingRow) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1" /> : 
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  const handleRowClick = (booking: BookingRow) => {
    setSelectedBooking(booking);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedBooking(null);
  };

  const handleStatusChange = (booking: BookingRow, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    updateStatusMutation.mutate({
      id: booking.id,
      status: newStatus
    });
  };

  const getStatusOptions = (currentStatus: string) => {
    const allStatuses = [
      { value: 'pending', label: 'Pending', icon: Clock },
      { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
      { value: 'completed', label: 'Completed', icon: CheckCircle },
      { value: 'cancelled', label: 'Cancelled', icon: XCircle }
    ];

    return allStatuses.filter(status => status.value !== currentStatus);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gm-neutral-900 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gm-neutral-400" />
        <p className="text-gm-neutral-500 dark:text-gm-neutral-400 text-lg mt-4">Loading bookings...</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-white dark:bg-gm-neutral-900 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 p-8 text-center">
        <p className="text-gm-neutral-500 dark:text-gm-neutral-400 text-lg">No bookings found</p>
        <p className="text-gm-neutral-400 dark:text-gm-neutral-500 text-sm mt-2">Try adjusting your filters or search criteria</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gm-neutral-900 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('customer_name')}
            >
              <div className="flex items-center">
                Customer
                {getSortIcon('customer_name')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('venue')}
            >
              <div className="flex items-center">
                Venue
                {getSortIcon('venue')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('booking_type')}
            >
              <div className="flex items-center">
                Type
                {getSortIcon('booking_type')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('booking_date')}
            >
              <div className="flex items-center">
                Date
                {getSortIcon('booking_date')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('start_time')}
            >
              <div className="flex items-center">
                Time
                {getSortIcon('start_time')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('guest_count')}
            >
              <div className="flex items-center">
                Guests
                {getSortIcon('guest_count')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('status')}
            >
              <div className="flex items-center">
                Status
                {getSortIcon('status')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 select-none"
              onClick={() => onSort('total_amount')}
            >
              <div className="flex items-center">
                Amount
                {getSortIcon('total_amount')}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow 
              key={booking.id} 
              className="hover:bg-gm-neutral-25 dark:hover:bg-gm-neutral-800 cursor-pointer"
              onClick={() => handleRowClick(booking)}
            >
              <TableCell>
                <div>
                  <div className="font-medium">{booking.customer_name}</div>
                  <div className="text-sm text-gm-neutral-500 dark:text-gm-neutral-400">
                    {booking.customer_phone || booking.customer_email || 'No contact'}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div>{formatVenue(booking.venue)}</div>
                  {booking.venue_area && (
                    <div className="text-sm text-gm-neutral-500 dark:text-gm-neutral-400">
                      {formatVenueArea(booking.venue_area)}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div>{formatBookingType(booking.booking_type, booking.venue_area)}</div>
                  {booking.ticket_quantity && (
                    <div className="text-sm text-gm-neutral-500 dark:text-gm-neutral-400">
                      {booking.ticket_quantity} tickets
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatDateUK(booking.booking_date)}</TableCell>
              <TableCell>
                {booking.start_time ? (
                  <div>
                    <div>{booking.start_time}</div>
                    {booking.end_time && (
                      <div className="text-sm text-gm-neutral-500 dark:text-gm-neutral-400">
                        to {booking.end_time}
                      </div>
                    )}
                  </div>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell>{booking.guest_count || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusBadge status={booking.status as 'pending' | 'confirmed' | 'cancelled'} />
                  <Select
                    value={booking.status}
                    onValueChange={(value) => handleStatusChange(booking, value as 'pending' | 'confirmed' | 'cancelled' | 'completed')}
                    disabled={updateStatusMutation.isPending}
                  >
                    <SelectTrigger 
                      className="w-auto h-8 text-xs border-none shadow-none hover:bg-gray-50 dark:hover:bg-gm-neutral-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions(booking.status).map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <status.icon className="h-3 w-3" />
                            {status.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
              <TableCell className="font-medium">{formatCurrency(booking.total_amount, { excludeGST: true, currency: 'AUD' })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <BookingDetailsSidebar
        booking={selectedBooking}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
    </div>
  );
};
