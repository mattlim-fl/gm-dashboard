import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { VenueCheckboxList } from './VenueCheckboxList';
import type { Venue } from '@/contexts/VenueContext';
import type { Tables } from '@/integrations/supabase/types';

type AllowedEmail = Tables<'allowed_emails'>;

interface VenueAccessSheetProps {
  editingUser: AllowedEmail | null;
  onClose: () => void;
  editVenues: Venue[];
  onVenueToggle: (venue: Venue, checked: boolean | 'indeterminate') => void;
  onSave: () => void;
  isSaving: boolean;
}

export function VenueAccessSheet({
  editingUser,
  onClose,
  editVenues,
  onVenueToggle,
  onSave,
  isSaving,
}: VenueAccessSheetProps) {
  return (
    <Sheet open={!!editingUser} onOpenChange={() => onClose()}>
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
              <div className="pt-2">
                <VenueCheckboxList
                  selectedVenues={editVenues}
                  onVenueToggle={onVenueToggle}
                  idPrefix="edit-venue"
                />
              </div>
              {editVenues.length === 0 && (
                <p className="text-sm text-amber-600">
                  Users with no venue access won't be able to see any data.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
