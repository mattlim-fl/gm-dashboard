import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { memberService, MemberInsert, MemberUpdate, MemberFilters, Venue, MemberWithCheckin } from '@/services/memberService';
import { useToast } from '@/hooks/use-toast';
import { useVenue, Venue as VenueType } from '@/contexts/VenueContext';

export type { MemberWithCheckin };

export const useMembers = (filters?: MemberFilters) => {
  const { selectedVenue } = useVenue();

  // Merge venue context with explicit filters
  // If selectedVenue is 'all', don't add venue filter (let RLS handle it)
  // If selectedVenue is a specific venue, add it to filters
  const effectiveFilters: MemberFilters = {
    ...filters,
    ...(selectedVenue !== 'all' && { venue: selectedVenue as Venue }),
  };

  return useQuery({
    queryKey: ['members', effectiveFilters, selectedVenue],
    queryFn: () => memberService.fetchMembers(effectiveFilters),
    placeholderData: keepPreviousData,
  });
};

export const useMember = (id: string) => {
  return useQuery({
    queryKey: ['members', id],
    queryFn: () => memberService.fetchMemberById(id),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
};

export const useSearchMembers = (query: string) => {
  return useQuery({
    queryKey: ['members', 'search', query],
    queryFn: () => memberService.searchMembers(query),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  });
};

export const useCreateMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: MemberInsert) => memberService.createMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({
        title: "Member Created",
        description: "Member has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MemberUpdate }) =>
      memberService.updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({
        title: "Member Updated",
        description: "Member details have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRecordFirstVisit = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => memberService.recordFirstVisit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({
        title: "First Visit Recorded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useMembersWithCheckins = (date: string, venue?: Venue) => {
  const { selectedVenue } = useVenue();

  // If venue is explicitly passed, use it; otherwise use context
  // If selectedVenue is 'all', pass undefined to get all accessible venues
  const effectiveVenue = venue ?? (selectedVenue !== 'all' ? selectedVenue as Venue : undefined);

  return useQuery({
    queryKey: ['members', 'checkins', date, effectiveVenue, selectedVenue],
    queryFn: () => memberService.fetchMembersWithCheckins(date, effectiveVenue),
    enabled: !!date,
    placeholderData: keepPreviousData,
  });
};

export const useToggleMemberCheckin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, date, isCurrentlyChecked }: { memberId: string; date: string; isCurrentlyChecked: boolean }) => {
      if (isCurrentlyChecked) {
        await memberService.uncheckMember(memberId, date);
      } else {
        await memberService.checkInMember(memberId, date);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members', 'checkins', variables.date] });
    },
  });
};
