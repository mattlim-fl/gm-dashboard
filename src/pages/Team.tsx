import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Plus, UserCog, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import { ALL_VENUES, VENUE_LABELS, Venue } from '@/contexts/VenueContext';

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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite a team member</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      value={role}
                      onValueChange={(value: StaffRole) => setRole(value)}
                    >
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {role === 'user' && (
                    <div className="space-y-2">
                      <Label>Venue Access</Label>
                      <p className="text-sm text-gm-neutral-500 mb-2">
                        Select which venues this user can access. Users can only view data from their assigned venues.
                      </p>
                      <div className="space-y-2">
                        {ALL_VENUES.map((venue) => (
                          <div key={venue} className="flex items-center space-x-2">
                            <Checkbox
                              id={`venue-${venue}`}
                              checked={selectedVenues.includes(venue)}
                              onCheckedChange={(checked) => handleVenueToggle(venue, checked)}
                            />
                            <label
                              htmlFor={`venue-${venue}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {VENUE_LABELS[venue]}
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedVenues.length === 0 && (
                        <p className="text-sm text-amber-600">
                          Users with no venue access won't be able to see any data.
                        </p>
                      )}
                    </div>
                  )}
                  {role === 'admin' && (
                    <p className="text-sm text-gm-neutral-500">
                      Admins automatically have access to all venues.
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-gm-primary-500 hover:bg-gm-primary-600"
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? 'Inviting...' : 'Invite'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Allowed Emails</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-gm-neutral-500">
                Loading team...
              </div>
            ) : !allowedEmails || allowedEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gm-neutral-500">
                <p className="mb-2">No team members have been invited yet.</p>
                <p className="text-sm">Use the &quot;Invite User&quot; button above to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Venue Access</TableHead>
                    <TableHead>Invited At</TableHead>
                    <TableHead className="w-[80px] text-right">
                      {isAdminUser ? 'Actions' : ''}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowedEmails.map((row) => {
                    const isOwner = row.email === 'matt@getproductbox.com';
                    const isSelf = row.email === user?.email;
                    const userVenues = getVenuesForEmail(row.email);

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.email}
                          {isOwner && (
                            <span className="ml-2 text-xs text-gm-neutral-500">
                              (Owner)
                            </span>
                          )}
                          {isSelf && !isOwner && (
                            <span className="ml-2 text-xs text-gm-neutral-500">
                              (You)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.role === 'admin' ? 'default' : 'outline'}>
                            {row.role === 'admin' ? 'Admin' : 'User'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.role === 'admin' ? (
                            <span className="text-sm text-gm-neutral-500">All venues</span>
                          ) : userVenues.length === 0 ? (
                            <span className="text-sm text-amber-600">No venues</span>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {userVenues.map(venue => (
                                <Badge key={venue} variant="secondary" className="text-xs">
                                  {VENUE_LABELS[venue]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdminUser && !isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={updateRoleMutation.isPending || deleteMutation.isPending}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {row.role === 'user' && (
                                  <DropdownMenuItem onClick={() => setEditingUser(row)}>
                                    <Building2 className="mr-2 h-4 w-4" />
                                    Manage venues
                                  </DropdownMenuItem>
                                )}
                                {!isSelf && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateRoleMutation.mutate({
                                        id: row.id,
                                        role: row.role === 'admin' ? 'user' : 'admin',
                                      })
                                    }
                                  >
                                    <UserCog className="mr-2 h-4 w-4" />
                                    {row.role === 'admin' ? 'Make user' : 'Make admin'}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => deleteMutation.mutate({ id: row.id, email: row.email })}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove access
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Venue Assignment Sidepanel */}
      <Sheet open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Manage Venue Access</SheetTitle>
          </SheetHeader>
          {editingUser && (
            <div className="mt-6 space-y-6">
              <div>
                <Label className="text-sm text-gm-neutral-500">User</Label>
                <p className="font-medium">{editingUser.email}</p>
              </div>

              <div className="space-y-3">
                <Label>Venue Access</Label>
                <p className="text-sm text-gm-neutral-500">
                  Select which venues this user can access.
                </p>
                <div className="space-y-3 pt-2">
                  {ALL_VENUES.map((venue) => (
                    <div key={venue} className="flex items-center space-x-3">
                      <Checkbox
                        id={`edit-venue-${venue}`}
                        checked={editVenues.includes(venue)}
                        onCheckedChange={(checked) => handleEditVenueToggle(venue, checked)}
                      />
                      <label
                        htmlFor={`edit-venue-${venue}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {VENUE_LABELS[venue]}
                      </label>
                    </div>
                  ))}
                </div>
                {editVenues.length === 0 && (
                  <p className="text-sm text-amber-600">
                    Users with no venue access won't be able to see any data.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveVenueAccess}
                  disabled={updateVenueAccessMutation.isPending}
                >
                  {updateVenueAccessMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
