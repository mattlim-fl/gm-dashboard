export interface CalendarBooking {
  id: string;
  resourceId: string;
  startTime: string; // Format: "HH:mm"
  endTime: string;   // Format: "HH:mm"
  date: string;      // Format: "YYYY-MM-DD"
  customer: {
    name: string;
    phone: string;
  };
  guests: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  service: 'Karaoke' | 'Venue Hire';
}

export interface CalendarResource {
  id: string;
  name: string;
  type: 'karaoke' | 'venue';
}

export const generateTimeSlots = (): string[] => {
  const slots = [];
  for (let hour = 10; hour <= 23; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
};




