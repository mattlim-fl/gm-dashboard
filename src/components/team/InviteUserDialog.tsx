import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { VenueCheckboxList } from './VenueCheckboxList';
import type { Venue } from '@/contexts/VenueContext';
import type { Enums } from '@/integrations/supabase/types';

type StaffRole = Enums<'staff_role'>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (email: string) => void;
  role: StaffRole;
  onRoleChange: (role: StaffRole) => void;
  selectedVenues: Venue[];
  onVenueToggle: (venue: Venue, checked: boolean | 'indeterminate') => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  email,
  onEmailChange,
  role,
  onRoleChange,
  selectedVenues,
  onVenueToggle,
  onSubmit,
  isPending,
}: InviteUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <form onSubmit={onSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(value: StaffRole) => onRoleChange(value)}>
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
                Select which venues this user can access. Users can only view data from their
                assigned venues.
              </p>
              <VenueCheckboxList
                selectedVenues={selectedVenues}
                onVenueToggle={onVenueToggle}
                idPrefix="venue"
              />
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
            disabled={isPending}
          >
            {isPending ? 'Inviting...' : 'Invite'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
