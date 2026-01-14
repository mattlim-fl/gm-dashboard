import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Venue } from '@/services/photoService';
import { useCreateAlbum } from '@/hooks/usePhotoAlbums';

interface CreateAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: Venue;
}

export function CreateAlbumDialog({ open, onOpenChange, venue }: CreateAlbumDialogProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const createAlbum = useCreateAlbum();

  const handleCreate = async () => {
    if (!date) return;

    try {
      await createAlbum.mutateAsync({
        venue,
        eventDate: format(date, 'yyyy-MM-dd'),
      });
      setDate(undefined);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create album:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Album</DialogTitle>
          <DialogDescription>
            Create a new photo album for an event date. You can then upload photos to this album.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Event Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'EEEE, d MMMM yyyy') : 'Select event date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!date || createAlbum.isPending}
          >
            {createAlbum.isPending ? 'Creating...' : 'Create Album'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

