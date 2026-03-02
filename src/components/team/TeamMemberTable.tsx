import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, UserCog, Building2 } from 'lucide-react';
import { VENUE_LABELS, Venue } from '@/contexts/VenueContext';
import type { Tables } from '@/integrations/supabase/types';

type AllowedEmail = Tables<'allowed_emails'>;

interface TeamMemberTableProps {
  allowedEmails: AllowedEmail[] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  currentUserEmail: string | undefined;
  getVenuesForEmail: (email: string) => Venue[];
  onEditVenues: (user: AllowedEmail) => void;
  onUpdateRole: (id: string, newRole: 'admin' | 'user') => void;
  onDelete: (id: string, email: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function TeamMemberTable({
  allowedEmails,
  isLoading,
  isAdmin,
  currentUserEmail,
  getVenuesForEmail,
  onEditVenues,
  onUpdateRole,
  onDelete,
  isUpdating,
  isDeleting,
}: TeamMemberTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allowed Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-gm-neutral-500">
            Loading team...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!allowedEmails || allowedEmails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allowed Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center text-gm-neutral-500">
            <p className="mb-2">No team members have been invited yet.</p>
            <p className="text-sm">Use the &quot;Invite User&quot; button above to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allowed Emails</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Venue Access</TableHead>
              <TableHead>Invited At</TableHead>
              <TableHead className="w-[80px] text-right">{isAdmin ? 'Actions' : ''}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allowedEmails.map((row) => {
              const isOwner = row.email === 'matt@getproductbox.com';
              const isSelf = row.email === currentUserEmail;
              const userVenues = getVenuesForEmail(row.email);

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.email}
                    {isOwner && (
                      <span className="ml-2 text-xs text-gm-neutral-500">(Owner)</span>
                    )}
                    {isSelf && !isOwner && (
                      <span className="ml-2 text-xs text-gm-neutral-500">(You)</span>
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
                        {userVenues.map((venue) => (
                          <Badge key={venue} variant="secondary" className="text-xs">
                            {VENUE_LABELS[venue]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && !isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isUpdating || isDeleting}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {row.role === 'user' && (
                            <DropdownMenuItem onClick={() => onEditVenues(row)}>
                              <Building2 className="mr-2 h-4 w-4" />
                              Manage venues
                            </DropdownMenuItem>
                          )}
                          {!isSelf && (
                            <DropdownMenuItem
                              onClick={() =>
                                onUpdateRole(row.id, row.role === 'admin' ? 'user' : 'admin')
                              }
                            >
                              <UserCog className="mr-2 h-4 w-4" />
                              {row.role === 'admin' ? 'Make user' : 'Make admin'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => onDelete(row.id, row.email)}
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
      </CardContent>
    </Card>
  );
}
