import { useMemo } from "react";
import { format, isSameMonth, isSameDay } from "date-fns";
import { CalendarBooking } from "@/types/calendar";
import { cn } from "@/lib/utils";
import { BookingBlock } from "./BookingBlock";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CalendarMonthViewProps {
  dateRange: Date[];
  currentDate: Date;
  bookings: CalendarBooking[];
  onBookingClick: (booking: CalendarBooking) => void;
  onDateClick: (date: Date) => void;
}

export const CalendarMonthView = ({
  dateRange,
  currentDate,
  bookings,
  onBookingClick,
  onDateClick,
}: CalendarMonthViewProps) => {
  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    
    bookings.forEach(booking => {
      const dateStr = booking.date; // YYYY-MM-DD
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)?.push(booking);
    });

    // Sort bookings by time within each day
    map.forEach(dayBookings => {
      dayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return map;
  }, [bookings]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gm-neutral-900">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-gm-neutral-200 dark:border-gm-neutral-700">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-gm-neutral-600 dark:text-gm-neutral-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6">
        {dateRange.map((date, index) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayBookings = bookingsByDate.get(dateStr) || [];
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isToday = isSameDay(date, new Date());

          // Limit visible bookings to prevent overflow, similar to Google Calendar
          // 4 items roughly fit in a standard month cell
          const maxVisibleBookings = 4;
          const visibleBookings = dayBookings.slice(0, maxVisibleBookings);
          const hiddenCount = dayBookings.length - maxVisibleBookings;

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[100px] border-b border-r border-gm-neutral-200 dark:border-gm-neutral-700 p-1 transition-colors hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 flex flex-col",
                !isCurrentMonth && "bg-gm-neutral-50/50 dark:bg-gm-neutral-900/50 text-gm-neutral-400",
                // Add top border for first row
                index < 7 && "border-t",
                // Add left border for first column
                index % 7 === 0 && "border-l"
              )}
              onClick={() => onDateClick(date)}
            >
              <div className="flex justify-center mb-1">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday
                      ? "bg-gm-primary-500 text-white"
                      : isCurrentMonth
                      ? "text-gm-neutral-900 dark:text-gm-neutral-100"
                      : "text-gm-neutral-400 dark:text-gm-neutral-500"
                  )}
                >
                  {format(date, 'd')}
                </span>
              </div>

              <div className="flex-1 space-y-1 overflow-hidden">
                {visibleBookings.map((booking) => (
                  <Tooltip key={booking.id}>
                    <TooltipTrigger asChild>
                        <div
                            onClick={(e) => {
                            e.stopPropagation();
                            onBookingClick(booking);
                            }}
                            className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80 border-l-2",
                            booking.status === 'confirmed' && "bg-green-100 text-green-800 border-green-500 dark:bg-green-900/30 dark:text-green-300",
                            booking.status === 'pending' && "bg-yellow-100 text-yellow-800 border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-300",
                            booking.status === 'cancelled' && "bg-red-100 text-red-800 border-red-500 dark:bg-red-900/30 dark:text-red-300"
                            )}
                        >
                            <span className="font-medium mr-1">
                                {booking.service === 'Occasion' ? '19:00' : booking.startTime}
                            </span>
                            {booking.customer.name}
                            {booking.service === 'Occasion' && booking.bookingCount !== undefined && (
                                <span className="ml-1 opacity-75">({booking.bookingCount})</span>
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                            <div className="font-medium">{booking.customer.name}</div>
                            <div className="text-sm opacity-90">{booking.customer.phone}</div>
                            <div className="text-sm">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</div>
                            {booking.service === 'Occasion' && booking.bookingCount !== undefined && (
                                <div className="text-sm">{booking.bookingCount} {booking.bookingCount === 1 ? 'booking' : 'bookings'}</div>
                            )}
                            <div className="text-sm">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</div>
                            <div className="text-sm capitalize">{booking.service}</div>
                            <div className={cn("text-sm font-medium capitalize", 
                                booking.status === 'confirmed' && "text-green-600 dark:text-green-400",
                                booking.status === 'pending' && "text-yellow-600 dark:text-yellow-400",
                                booking.status === 'cancelled' && "text-red-600 dark:text-red-400"
                            )}>
                                {booking.status}
                            </div>
                        </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                {hiddenCount > 0 && (
                  <div className="text-[10px] font-medium text-gm-neutral-500 dark:text-gm-neutral-400 pl-1 hover:text-gm-neutral-900 dark:hover:text-gm-neutral-200 cursor-pointer">
                    {hiddenCount} more...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
