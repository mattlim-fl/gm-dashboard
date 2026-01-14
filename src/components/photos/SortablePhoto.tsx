import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArchiveButton } from '@/components/ui/archive-button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PhotoAlbumImage } from '@/services/photoService';

interface SortablePhotoProps {
  photo: PhotoAlbumImage;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  isArchiving: boolean;
  isDeleting: boolean;
}

export function SortablePhoto({
  photo,
  onArchive,
  onUnarchive,
  onDelete,
  isArchiving,
  isDeleting,
}: SortablePhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative aspect-square rounded-lg overflow-hidden bg-muted ${
        photo.archived ? 'opacity-60' : ''
      } ${isDragging ? 'shadow-xl ring-2 ring-primary' : ''}`}
    >
      <img
        src={photo.public_url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
      
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <div className="bg-black/60 text-white p-1.5 rounded">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Archived badge */}
      {photo.archived && (
        <div className="absolute top-2 right-2">
          <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded">
            Archived
          </span>
        </div>
      )}

      {/* Action buttons overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors pointer-events-none">
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 pointer-events-auto">
          <div onClick={(e) => e.stopPropagation()}>
            <ArchiveButton
              archived={photo.archived}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              disabled={isArchiving}
              variant="secondary"
              size="icon"
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this photo. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

