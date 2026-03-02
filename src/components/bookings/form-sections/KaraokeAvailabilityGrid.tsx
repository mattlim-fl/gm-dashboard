import type { AvailabilitySlot } from '@/types/karaoke';

interface KaraokeAvailabilityGridProps {
  slots: AvailabilitySlot[];
  selectedStartTime: string;
  selectedEndTime: string;
  onSlotSelect: (startTime: string, endTime: string) => void;
  activeHoldId: string | null;
  holdExpiresAt: string | null;
}

export function KaraokeAvailabilityGrid({
  slots,
  selectedStartTime,
  selectedEndTime,
  onSlotSelect,
  activeHoldId,
  holdExpiresAt,
}: KaraokeAvailabilityGridProps) {
  return (
    <div className="col-span-2">
      <div className="mb-2 text-sm text-gray-600">Select a time slot</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {slots.map((slot) => {
          const isSelected =
            selectedStartTime === slot.startTime && selectedEndTime === slot.endTime;
          const disabled = !slot.available;

          return (
            <button
              key={`${slot.startTime}-${slot.endTime}`}
              type="button"
              onClick={() => onSlotSelect(slot.startTime, slot.endTime)}
              disabled={disabled}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-500 text-white border-blue-500'
                  : disabled
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {slot.startTime} - {slot.endTime}
              {Array.isArray(slot.capacities) && slot.capacities.length > 0 && (
                <div className="text-xs mt-1 text-gray-700">
                  Caps: {slot.capacities.join(', ')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!selectedStartTime && (
        <div className="mt-2 text-xs text-gray-500">
          Pick a date, then choose a time slot to see available booths.
        </div>
      )}

      {activeHoldId && holdExpiresAt && (
        <div className="mt-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
          Hold created. Expires at: {new Date(holdExpiresAt).toLocaleTimeString()}. Submitting
          the form will confirm the booking.
        </div>
      )}
    </div>
  );
}
