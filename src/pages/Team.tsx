import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import { Venue } from '@/contexts/VenueContext';
import {
  InviteUserDialog,
  TeamMemberTable,
  VenueAccessSheet,
} from '@/components/team';

type AllowedEmail = Tables<'allowed_emails'>;
type StaffRole = Enums<'staff_role'>;

interface UserVenueAccess {
  id: string;
  email: string;
  venue: Venue;
  created_at: string;
}

const TEAM_QUERY_KEY = ['allowed_emails'];
const VENUE_ACCESS_QUERY_KEY = ['user_venue_access'];

const fetchAllowedEmails = async (): Promise<AllowedEmail[]> => {
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchUserVenueAccess = async (): Promise<UserVenueAccess[]> => {
  const { data, error } = await supabase
    .from('user_venue_access')
    .select('*')
    .order('email', { ascending: true });

  if (error) {
    // Table might not exist yet
    console.warn('Failed to fetch user venue access:', error);
    return [];
  }

  return (data ?? []) as UserVenueAccess[];
};

export default function Team() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, role: currentRole } = useAuth();
  const isAdminUser = isAdmin(currentRole);
  const { data: allowedEmails, isLoading } = useQuery({
    queryKey: TEAM_QUERY_KEY,
    queryFn: fetchAllowedEmails,
  });

  const { data: venueAccess } = useQuery({
    queryKey: VENUE_ACCESS_QUERY_KEY,
    queryFn: fetchUserVenueAccess,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('user');
  const [selectedVenues, setSelectedVenues] = useState<Venue[]>([]);

  // Venue assignment sidepanel state
  const [editingUser, setEditingUser] = useState<AllowedEmail | null>(null);
  const [editVenues, setEditVenues] = useState<Venue[]>([]);

  // Load venues for editing user
  useEffect(() => {
    if (editingUser && venueAccess) {
      const userVenues = venueAccess
        .filter(va => va.email === editingUser.email)
        .map(va => va.venue);
      setEditVenues(userVenues);
    }
  }, [editingUser, venueAccess]);

  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: StaffRole; venues: Venue[] }) => {
      // First, create the allowed_emails entry
      const { data, error } = await supabase
        .from('allowed_emails')
        .upsert(
          {
            email: payload.email,
            role: payload.role,
            invited_by: user?.id ?? null,
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      // For non-admin users, also set up venue access
      if (payload.role !== 'admin' && payload.venues.length > 0) {
        const venueAccessEntries = payload.venues.map(venue => ({
          email: payload.email,
          venue,
          created_by: user?.id ?? null,
        }));

        const { error: venueError } = await supabase
          .from('user_venue_access')
          .upsert(venueAccessEntries, { onConflict: 'email,venue' });

        if (venueError) {
          console.warn('Failed to set venue access:', venueError);
        }
      }

      return data;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: VENUE_ACCESS_QUERY_KEY });
      setIsDialogOpen(false);
      setEmail('');
      setRole('user');
      setSelectedVenues([]);
      toast({
        title: 'User invited',
        description: 'The user can now sign in with the invited email.',
      });

      const invitedEmail = variables.email;
      const inviteUrl = `${window.location.origin}/auth?mode=invite&email=${encodeURIComponent(invitedEmail)}`;

      try {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            template: 'staff-invite',
            to: invitedEmail,
            data: {
              inviteEmail: invitedEmail,
              inviteUrl,
              invitedBy: user?.email ?? null,
            },
          },
        });

        if (error) {
          toast({
            title: 'Invite email failed',
            description: 'The invite was created, but the email could not be sent. Please try again or contact support.',
            variant: 'destructive',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'The invite was created, but the email could not be sent.';
        toast({
          title: 'Invite email failed',
          description: message,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error inviting user',
        description: error.message ?? 'An unknown error occurred.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (params: { id: string; email: string }) => {
      // First remove from allowed_emails
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('id', params.id);

      if (error) {
        throw error;
      }

      // Also remove any venue access
      const { error: venueError } = await supabase
        .from('user_venue_access')
        .delete()
        .eq('email', params.email);

      if (venueError) {
        console.warn('Failed to remove venue access:', venueError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: VENUE_ACCESS_QUERY_KEY });
      toast({
        title: 'Access removed',
        description: 'The user will no longer be able to access the dashboard.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error removing access',
        description: error.message ?? 'An unknown error occurred.',
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (payload: { id: string; role: StaffRole }) => {
      const { data, error } = await supabase
        .from('allowed_emails')
        .update({ role: payload.role })
        .eq('id', payload.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
      toast({
        title: 'Role updated',
        description: 'Team member role has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating role',
        description: error.message ?? 'An unknown error occurred.',
        variant: 'destructive',
      });
    },
  });

  const updateVenueAccessMutation = useMutation({
    mutationFn: async (payload: { email: string; venues: Venue[] }) => {
      // Remove all existing venue access for this user
      const { error: deleteError } = await supabase
        .from('user_venue_access')
        .delete()
        .eq('email', payload.email);

      if (deleteError) {
        throw deleteError;
      }

      // Add new venue access entries
      if (payload.venues.length > 0) {
        const venueAccessEntries = payload.venues.map(venue => ({
          email: payload.email,
          venue,
          created_by: user?.id ?? null,
        }));

        const { error: insertError } = await supabase
          .from('user_venue_access')
          .insert(venueAccessEntries);

        if (insertError) {
          throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENUE_ACCESS_QUERY_KEY });
      setEditingUser(null);
      toast({
        title: 'Venue access updated',
        description: 'User venue permissions have been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating venue access',
        description: error.message ?? 'An unknown error occurred.',
        variant: 'destructive',
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    inviteMutation.mutate({
      email: email.trim().toLowerCase(),
      role,
      venues: role === 'user' ? selectedVenues : [],
    });
  };

  const handleVenueToggle = (venue: Venue, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedVenues(prev => [...prev, venue]);
    } else {
      setSelectedVenues(prev => prev.filter(v => v !== venue));
    }
  };

  const handleEditVenueToggle = (venue: Venue, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setEditVenues(prev => [...prev, venue]);
    } else {
      setEditVenues(prev => prev.filter(v => v !== venue));
    }
  };

  const handleSaveVenueAccess = () => {
    if (!editingUser) return;
    updateVenueAccessMutation.mutate({
      email: editingUser.email,
      venues: editVenues,
    });
  };

  // Get venue access for a specific email
  const getVenuesForEmail = (email: string): Venue[] => {
    if (!venueAccess) return [];
    return venueAccess.filter(va => va.email === email).map(va => va.venue);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900">Team</h1>
            <p className="text-gm-neutral-600">
              Manage who can access the GM Dashboard and their roles.
            </p>
          </div>
          {isAdminUser && (
            <InviteUserDialog
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              email={email}
              onEmailChange={setEmail}
              role={role}
              onRoleChange={setRole}
              selectedVenues={selectedVenues}
              onVenueToggle={handleVenueToggle}
              onSubmit={handleInvite}
              isPending={inviteMutation.isPending}
            />
          )}
        </div>

        <TeamMemberTable
          allowedEmails={allowedEmails}
          isLoading={isLoading}
          isAdmin={isAdminUser}
          currentUserEmail={user?.email}
          getVenuesForEmail={getVenuesForEmail}
          onEditVenues={setEditingUser}
          onUpdateRole={(id, newRole) => updateRoleMutation.mutate({ id, role: newRole })}
          onDelete={(id, email) => deleteMutation.mutate({ id, email })}
          isUpdating={updateRoleMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      </div>

      <VenueAccessSheet
        editingUser={editingUser}
        onClose={() => setEditingUser(null)}
        editVenues={editVenues}
        onVenueToggle={handleEditVenueToggle}
        onSave={handleSaveVenueAccess}
        isSaving={updateVenueAccessMutation.isPending}
      />
    </DashboardLayout>
  );
}
