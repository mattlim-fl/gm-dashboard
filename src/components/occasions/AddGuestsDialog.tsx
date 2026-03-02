import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddGuestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestsToAdd: number;
  onGuestsToAddChange: (count: number) => void;
  remainingCapacity: number;
  totalCapacity: number;
  onConfirm: () => void;
}

export function AddGuestsDialog({
  open,
  onOpenChange,
  guestsToAdd,
  onGuestsToAddChange,
  remainingCapacity,
  totalCapacity,
  onConfirm,
}: AddGuestsDialogProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(e.target.value) || 1);
    const maxAllowed = remainingCapacity || 50;
    onGuestsToAddChange(Math.min(value, maxAllowed));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Guests</DialogTitle>
          <DialogDescription>
            How many guests would you like to add to this occasion?
            <span className="block mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {remainingCapacity} spots remaining (Capacity: {totalCapacity})
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="guest-count">Number of guests</Label>
          <Input
            id="guest-count"
            type="number"
            min="1"
            max={remainingCapacity || 50}
            value={guestsToAdd}
            onChange={handleInputChange}
            className="mt-2"
          />
          {guestsToAdd > remainingCapacity && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Cannot exceed remaining capacity
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={guestsToAdd > remainingCapacity}>
            Add {guestsToAdd} {guestsToAdd === 1 ? 'guest' : 'guests'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
