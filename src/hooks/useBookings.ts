import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService, CreateBookingData, BookingFilters } from '@/services/bookingService';
import { useToast } from '@/hooks/use-toast';
import { useVenue } from '@/contexts/VenueContext';

export const useBookings = (filters?: BookingFilters) => {
  const { selectedVenue } = useVenue();

  // Merge venue context with explicit filters
  // If selectedVenue is 'all', don't add venue filter (let RLS handle it)
  // If selectedVenue is a specific venue, add it to filters
  const effectiveFilters: BookingFilters = {
    ...filters,
    ...(selectedVenue !== 'all' && { venue: selectedVenue }),
  };

  return useQuery({
    queryKey: ['bookings', effectiveFilters, selectedVenue],
    queryFn: () => bookingService.getBookings(effectiveFilters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useBooking = (id: string) => {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingService.getBooking(id),
    enabled: !!id,
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateBookingData) => bookingService.createBooking(data),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      // Handle both VIP tickets and venue hire bookings (now both return single BookingRow)
      if (booking.booking_type === 'vip_tickets') {
        // VIP ticket booking
        const ticketCount = booking.ticket_quantity || 1;
        toast({
          title: "VIP Tickets Created Successfully",
          description: `${ticketCount} VIP ticket${ticketCount > 1 ? 's' : ''} for ${booking.customer_name} have been created.`,
        });
      } else {
        // Venue hire booking
        toast({
          title: "Booking Created Successfully",
          description: `Booking for ${booking.customer_name} has been created and ${booking.status === 'confirmed' ? 'confirmed' : 'is pending'}.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error Creating Booking",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBookingData> }) => 
      bookingService.updateBooking(id, data),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      toast({
        title: "Booking Updated",
        description: `Booking for ${booking.customer_name} has been updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Updating Booking",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'confirmed' | 'cancelled' | 'completed' }) => 
      bookingService.updateBookingStatus(id, status),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      toast({
        title: "Booking Status Updated",
        description: `Booking status changed to ${booking.status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Updating Status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useVipTicketsForExport = () => {
  return useQuery({
    queryKey: ['vip-tickets-export'],
    queryFn: () => bookingService.getVipTicketsForExport(),
  });
};

export const useMarkVipTicketsAsExported = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (bookingIds: string[]) => bookingService.markVipTicketsAsExported(bookingIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['vip-tickets-export'] });
      toast({
        title: "VIP Tickets Exported",
        description: "Selected VIP ticket bookings have been marked as exported.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
