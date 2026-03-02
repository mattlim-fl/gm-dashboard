import { Input } from '@/components/ui/input';
import { Users, Calendar, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { OccasionWithStats } from '@/services/occasionService';

interface OccasionStatsGridProps {
  occasion: OccasionWithStats;
  isEditing: boolean;
  editingCapacity: number;
  editingTicketPrice: number;
  onCapacityChange: (value: number) => void;
  onTicketPriceChange: (value: number) => void;
}

export function OccasionStatsGrid({
  occasion,
  isEditing,
  editingCapacity,
  editingTicketPrice,
  onCapacityChange,
  onTicketPriceChange,
}: OccasionStatsGridProps) {
  const formattedDate = occasion.occasion_date
    ? format(parseISO(occasion.occasion_date), 'EEEE, MMMM d, yyyy')
    : 'Date not set';
  const ticketPrice = (occasion.ticket_price_cents / 100).toFixed(2);
  const capacityPercent = (occasion.total_guests / occasion.capacity) * 100;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Capacity */}
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
              onChange={(e) => onCapacityChange(parseInt(e.target.value) || 0)}
              className="text-2xl font-semibold h-auto py-2"
              min={occasion.total_guests}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {Math.max(0, editingCapacity - occasion.total_guests)} spots left
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-semibold dark:text-white">
              {occasion.total_guests}/{occasion.capacity}
            </div>
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

      {/* Date */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm mb-1">
          <Calendar className="h-4 w-4" />
          <span>Date</span>
        </div>
        <div className="text-sm font-medium dark:text-white">{formattedDate}</div>
      </div>

      {/* Ticket Price */}
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
                onChange={(e) => onTicketPriceChange(parseFloat(e.target.value) || 0)}
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
  );
}
