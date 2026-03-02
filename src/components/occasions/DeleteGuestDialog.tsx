import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestName: string | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteGuestDialog({
  open,
  onOpenChange,
  guestName,
  deleting,
  onConfirm,
  onCancel,
}: DeleteGuestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Guest</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove <strong>{guestName || 'this guest'}</strong> from the
            guest list?
            <span className="block mt-2 text-sm">
              This action cannot be undone. The guest will be removed from the booking.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Removing...' : 'Remove Guest'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
