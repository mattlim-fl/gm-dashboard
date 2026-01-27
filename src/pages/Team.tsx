import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Plus, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';

type AllowedEmail = Tables<'allowed_emails'>;
type StaffRole = Enums<'staff_role'>;

const TEAM_QUERY_KEY = ['allowed_emails'];

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

export default function Team() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, role: currentRole } = useAuth();
  const isAdminUser = isAdmin(currentRole);
  const { data: allowedEmails, isLoading } = useQuery({
    queryKey: TEAM_QUERY_KEY,
    queryFn: fetchAllowedEmails,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('user');

  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: StaffRole }) => {
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

      return data;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
      setIsDialogOpen(false);
      setEmail('');
      setRole('user');
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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    inviteMutation.mutate({ email: email.trim().toLowerCase(), role });
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
                    const canChangeRole = isAdminUser && !isOwner;

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
                                  onClick={() => deleteMutation.mutate(row.id)}
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
    </DashboardLayout>
  );
}


