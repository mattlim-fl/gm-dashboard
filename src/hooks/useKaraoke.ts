import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { karaokeService } from '@/services/karaokeService';
import { useToast } from '@/hooks/use-toast';
import { 
  KaraokeBoothRow, 
  KaraokeBoothInsert, 
  KaraokeBoothUpdate,
  KaraokeBookingFormData,
  KaraokeBookingFilters,
  KaraokeBoothFilters
} from '@/types/karaoke';

// ===== KARAOKE BOOTH HOOKS =====

/**
 * Hook to fetch karaoke booths with optional filters
 */
export const useKaraokeBooths = (filters?: KaraokeBoothFilters) => {
  return useQuery({
    queryKey: ['karaoke-booths', filters],
    queryFn: () => karaokeService.getKaraokeBooths(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch a single karaoke booth
 */
export const useKaraokeBooth = (id: string) => {
  return useQuery({
    queryKey: ['karaoke-booth', id],
    queryFn: () => karaokeService.getKaraokeBooth(id),
    enabled: !!id,
    retry: (failureCount, error) => {
      if (error.message.includes('migration') || error.message.includes('table not found')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to create a new karaoke booth
 */
export const useCreateKaraokeBooth = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: KaraokeBoothInsert) => karaokeService.createKaraokeBooth(data),
    onSuccess: (booth) => {
      queryClient.invalidateQueries({ queryKey: ['karaoke-booths'] });
      toast({
        title: "Karaoke Booth Created",
        description: `${booth.name} has been created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Creating Booth",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook to update a karaoke booth
 */
export const useUpdateKaraokeBooth = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: KaraokeBoothUpdate }) => 
      karaokeService.updateKaraokeBooth(id, data),
    onSuccess: (booth) => {
      queryClient.invalidateQueries({ queryKey: ['karaoke-booths'] });
      queryClient.invalidateQueries({ queryKey: ['karaoke-booth', booth.id] });
      toast({
        title: "Booth Updated",
        description: `${booth.name} has been updated successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Updating Booth",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook to toggle booth availability
 */
export const useToggleBoothAvailability = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      karaokeService.toggleBoothAvailability(id, isAvailable),
    onSuccess: (booth) => {
      queryClient.invalidateQueries({ queryKey: ['karaoke-booths'] });
      queryClient.invalidateQueries({ queryKey: ['karaoke-booth', booth.id] });
      toast({
        title: "Booth Availability Updated",
        description: `${booth.name} is now ${booth.is_available ? 'available' : 'unavailable'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Updating Availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook to archive a booth
 */
export const useArchiveBooth = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => karaokeService.archiveBooth(id),
    onSuccess: (booth) => {
      queryClient.invalidateQueries({ queryKey: ['karaoke-booths'] });
      queryClient.invalidateQueries({ queryKey: ['karaoke-booth', booth.id] });
      toast({
        title: "Booth Archived",
        description: `${booth.name} has been archived.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Archiving Booth",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook to restore an archived booth
 */
export const useRestoreBooth = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => karaokeService.restoreBooth(id),
    onSuccess: (booth) => {
      queryClient.invalidateQueries({ queryKey: ['karaoke-booths'] });
      queryClient.invalidateQueries({ queryKey: ['karaoke-booth', booth.id] });
      toast({
        title: "Booth Restored",
        description: `${booth.name} has been restored.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Restoring Booth",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// ===== KARAOKE BOOKING HOOKS =====

/**
 * Hook to create a karaoke booking
 */
export const useCreateKaraokeBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: KaraokeBookingFormData) => karaokeService.createKaraokeBooking(data),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['karaoke-bookings'] });
      toast({
        title: "Karaoke Booking Created",
        description: `Booking for ${booking.customer_name} has been created successfully.`,
      });
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

// ===== AVAILABILITY HOOKS =====

/**
 * Hook to check booth availability for a specific date
 */
export const useBoothAvailability = (boothId: string, date: string) => {
  return useQuery({
    queryKey: ['booth-availability', boothId, date],
    queryFn: () => karaokeService.getBoothAvailability(boothId, date),
    enabled: !!boothId && !!date,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: (failureCount, error) => {
      if (error.message.includes('migration') || error.message.includes('table not found')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to check for booking conflicts
 */
export const useCheckBookingConflicts = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (check: { booth_id: string; date: string; start_time: string; end_time: string; exclude_booking_id?: string }) => 
      karaokeService.checkBookingConflicts(check),
    onError: (error: Error) => {
      toast({
        title: "Error Checking Conflicts",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// ===== UTILITY HOOKS =====

/**
 * Hook to get available time slots for booking
 */
export const useTimeSlots = (startHour: number = 10, endHour: number = 23) => {
  return useQuery({
    queryKey: ['time-slots', startHour, endHour],
    queryFn: () => karaokeService.generateTimeSlots(startHour, endHour),
    staleTime: Infinity, // This data never changes
  });
};

/**
 * Hook to validate booking times
 */
export const useValidateBookingTime = () => {
  return useMutation({
    mutationFn: ({ startTime, endTime }: { startTime: string; endTime: string }) => 
      Promise.resolve(karaokeService.validateBookingTime(startTime, endTime)),
  });
};

/**
 * Hook to calculate booking cost
 */
export const useCalculateBookingCost = () => {
  return useMutation({
    mutationFn: ({ startTime, endTime, hourlyRate }: { startTime: string; endTime: string; hourlyRate: number }) => 
      Promise.resolve(karaokeService.calculateBookingCost(startTime, endTime, hourlyRate)),
  });
};

// ===== COMBINED HOOKS =====

/**
 * Hook that combines booth data and availability for easy use in components
 */
export const useKaraokeBoothsWithAvailability = (date: string, venue?: 'manor' | 'hippie') => {
  const { data: booths, isLoading: boothsLoading, error: boothsError } = useKaraokeBooths({ 
    venue: venue || 'all',
    is_available: true 
  });

  const availabilityQueries = useQuery({
    queryKey: ['booths-availability', date, venue],
    queryFn: async () => {
      if (!booths || booths.length === 0) return [];
      
      const availabilityPromises = booths.map(booth => 
        karaokeService.getBoothAvailability(booth.id, date)
      );
      
      return Promise.all(availabilityPromises);
    },
    enabled: !!booths && booths.length > 0 && !!date,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    booths,
    availability: availabilityQueries.data,
    isLoading: boothsLoading || availabilityQueries.isLoading,
    error: boothsError || availabilityQueries.error,
  };
};

// ===== HOLDS AND AVAILABILITY (EDGE FUNCTIONS) =====

export const useKaraokeAvailability = (params: { boothId?: string; venue?: 'manor' | 'hippie'; minCapacity?: number; bookingDate?: string; granularityMinutes?: number; action?: 'boothsForSlot'; startTime?: string; endTime?: string }) => {
  return useQuery({
    queryKey: ['karaoke-availability', params],
    queryFn: () => karaokeService.getAvailability({
      boothId: params.boothId,
      venue: params.venue,
      minCapacity: params.minCapacity,
      bookingDate: params.bookingDate!,
      granularityMinutes: params.granularityMinutes,
      action: params.action,
      startTime: params.startTime,
      endTime: params.endTime,
    }),
    enabled: (!!params.bookingDate && (!!params.boothId || !!params.venue)) || params.action === 'boothsForSlot',
    staleTime: 1000 * 60 * 2, // 2 minutes - availability can be slightly stale
  });
};

export const useCreateKaraokeHold = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { boothId: string; venue: 'manor' | 'hippie'; bookingDate: string; startTime: string; endTime: string; sessionId: string; customerEmail?: string; ttlMinutes?: number }) => 
      karaokeService.createHold(payload),
    onError: (error: Error) => {
      toast({ title: 'Failed to create hold', description: error.message, variant: 'destructive' });
    },
  });
};

export const useExtendKaraokeHold = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { holdId: string; sessionId: string; ttlMinutes?: number }) => karaokeService.extendHold(payload),
    onError: (error: Error) => {
      toast({ title: 'Failed to extend hold', description: error.message, variant: 'destructive' });
    },
  });
};

export const useReleaseKaraokeHold = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { holdId: string; sessionId: string }) => karaokeService.releaseHold(payload),
    onError: (error: Error) => {
      toast({ title: 'Failed to release hold', description: error.message, variant: 'destructive' });
    },
  });
};

export const useFinalizeKaraokeHold = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { holdId: string; sessionId: string; customerName: string; customerEmail?: string; customerPhone?: string; guestCount?: number }) => 
      karaokeService.finalizeHold(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking confirmed', description: 'Your karaoke booking has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to finalize booking', description: error.message, variant: 'destructive' });
    },
  });
};

export const useActiveKaraokeHolds = (params: { boothId?: string; bookingDate?: string }) => {
  return useQuery({
    queryKey: ['karaoke-holds', params.boothId, params.bookingDate],
    queryFn: () => karaokeService.getActiveHolds({ boothId: params.boothId!, bookingDate: params.bookingDate! }),
    enabled: !!params.boothId && !!params.bookingDate,
    refetchInterval: 30_000, // 30 seconds - reduced from 10s to decrease API calls
    staleTime: 1000 * 15,    // 15 seconds
  });
};

export const useStaffReleaseKaraokeHold = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (holdId: string) => karaokeService.staffReleaseHold(holdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['karaoke-holds'] });
      toast({ title: 'Hold released', description: 'The hold has been released.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to release hold', description: error.message, variant: 'destructive' });
    },
  });
};

/**
 * Hook for booth management operations
 */
export const useBoothManagement = () => {
  const createBooth = useCreateKaraokeBooth();
  const updateBooth = useUpdateKaraokeBooth();
  const toggleAvailability = useToggleBoothAvailability();
  const archiveBooth = useArchiveBooth();
  const restoreBooth = useRestoreBooth();

  return {
    createBooth,
    updateBooth,
    toggleAvailability,
    archiveBooth,
    restoreBooth,
    isLoading: createBooth.isPending || updateBooth.isPending || toggleAvailability.isPending || archiveBooth.isPending || restoreBooth.isPending,
  };
}; 