
import { CalendarBooking } from "@/types/calendar";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BookingBlockProps {
  booking: CalendarBooking;
  onClick: (booking: CalendarBooking) => void;
}

export const BookingBlock = ({ booking, onClick }: BookingBlockProps) => {
  const getStatusStyles = (status: CalendarBooking['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200';
      default:
        return 'bg-gm-neutral-100 dark:bg-gm-neutral-800 border-gm-neutral-300 dark:border-gm-neutral-600 text-gm-neutral-800 dark:text-gm-neutral-200';
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Calculate booking duration in hours
  const startHour = parseInt(booking.startTime.split(':')[0]);
  const startMinute = parseInt(booking.startTime.split(':')[1]);
  const endHour = parseInt(booking.endTime.split(':')[0]);
  const endMinute = parseInt(booking.endTime.split(':')[1]);
  
  const durationHours = (endHour + endMinute/60) - (startHour + startMinute/60);
  const isShortBooking = durationHours <= 1;

  const renderCompactView = () => (
    <div className="text-xs leading-tight">
      <div className="font-medium truncate">
        {booking.customer.name}
      </div>
      <div className="opacity-75 truncate">
        {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
        {booking.service === 'Occasion' && booking.bookingCount !== undefined && (
          <span className="ml-1">({booking.bookingCount} {booking.bookingCount === 1 ? 'booking' : 'bookings'})</span>
        )}
      </div>
    </div>
  );

  const renderFullView = () => (
    <div className="text-xs leading-tight">
      <div className="font-medium truncate">
        {booking.customer.name}
      </div>
      <div className="opacity-75 mt-1 truncate">
        {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
        {booking.service === 'Occasion' && booking.bookingCount !== undefined && (
          <span className="ml-1">({booking.bookingCount} {booking.bookingCount === 1 ? 'booking' : 'bookings'})</span>
        )}
      </div>
      {booking.service !== 'Occasion' && (
        <>
          <div className="opacity-75 mt-1 truncate">
            {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
          </div>
          <div className="opacity-75 mt-1 truncate capitalize">
            {booking.service}
          </div>
        </>
      )}
      {booking.service === 'Occasion' && (
        <div className="opacity-75 mt-1 truncate capitalize">
          Occasion
        </div>
      )}
    </div>
  );

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{booking.customer.name}</div>
      <div className="text-sm opacity-90">{booking.customer.phone}</div>
      <div className="text-sm">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</div>
      {booking.service === 'Occasion' && booking.bookingCount !== undefined && (
        <div className="text-sm">{booking.bookingCount} {booking.bookingCount === 1 ? 'booking' : 'bookings'}</div>
      )}
      {booking.service !== 'Occasion' && (
        <div className="text-sm">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</div>
      )}
      {booking.service === 'Occasion' && (
        <div className="text-sm">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</div>
      )}
      <div className="text-sm capitalize">{booking.service}</div>
      <div className={cn("text-sm font-medium capitalize", 
        booking.status === 'confirmed' && "text-green-600 dark:text-green-400",
        booking.status === 'pending' && "text-yellow-600 dark:text-yellow-400",
        booking.status === 'cancelled' && "text-red-600 dark:text-red-400"
      )}>
        {booking.status}
      </div>
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute left-1 right-1 top-1 rounded-md border-2 p-2 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] z-10 overflow-hidden",
            getStatusStyles(booking.status)
          )}
          onClick={() => onClick(booking)}
          style={{
            bottom: '4px'
          }}
        >
          {isShortBooking ? renderCompactView() : renderFullView()}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};
