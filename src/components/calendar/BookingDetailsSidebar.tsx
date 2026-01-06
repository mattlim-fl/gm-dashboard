import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CalendarBooking } from "@/types/calendar";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, Users, Phone, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingDetailsSidebarProps {
  booking: CalendarBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (booking: CalendarBooking) => void;
}

export const BookingDetailsSidebar = ({
  booking,
  isOpen,
  onClose,
  onEdit,
}: BookingDetailsSidebarProps) => {
  if (!booking) return null;

  const getStatusColor = (status: CalendarBooking['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Badge className={getStatusColor(booking.status)} variant="outline">
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">ID: {booking.id.slice(0, 8)}</span>
          </div>
          <SheetTitle className="text-2xl">{booking.customer.name}</SheetTitle>
          <SheetDescription>
            {booking.service} Booking
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Time & Date Section */}
          <div className="space-y-4 p-4 bg-gm-neutral-50 dark:bg-gm-neutral-800 rounded-lg">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(booking.date), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span>
                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <span className="capitalize">
                 {/* We might need to map resourceId to name if possible, or use what we have */}
                 {booking.resourceId} 
                 {/* Ideally we'd look up the resource name from the ID, but we don't have the full list here easily unless passed. 
                     However, for now let's just show the ID or generic text if it looks like an ID. 
                     Actually, let's try to clean it up if it's a known format.
                 */}
              </span>
            </div>
          </div>

          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Customer Details</h3>
            
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Name:</span>
                <span>{booking.customer.name}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Phone:</span>
                <span>{booking.customer.phone || "Not provided"}</span>
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Guests:</span>
                <span>{booking.guests} people</span>
              </div>
              {booking.service === 'Occasion' && booking.bookingCount !== undefined && (
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Bookings:</span>
                  <span>{booking.bookingCount} {booking.bookingCount === 1 ? 'booking' : 'bookings'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes or Additional Info could go here */}

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t mt-6">
            <Button className="flex-1" variant="outline" onClick={() => onEdit(booking)}>
              Edit Booking
            </Button>
            {booking.status !== 'cancelled' && (
                <Button className="flex-1" variant="destructive">
                Cancel Booking
                </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

