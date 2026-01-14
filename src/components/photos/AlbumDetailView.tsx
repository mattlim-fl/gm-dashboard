import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowLeft, Calendar, Image, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoAlbum, PhotoAlbumImage } from '@/services/photoService';
import {
  useAlbumPhotos,
  useReorderPhotos,
  useArchivePhoto,
  useUnarchivePhoto,
  useDeletePhoto,
} from '@/hooks/usePhotoAlbums';
import { SortablePhoto } from './SortablePhoto';
import { PhotoUploader } from './PhotoUploader';

interface AlbumDetailViewProps {
  album: PhotoAlbum;
  onBack: () => void;
}

export function AlbumDetailView({ album, onBack }: AlbumDetailViewProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<PhotoAlbumImage[] | null>(null);

  const { data: photos, isLoading, error } = useAlbumPhotos(album.id, showArchived);
  const reorderPhotos = useReorderPhotos();
  const archivePhoto = useArchivePhoto();
  const unarchivePhoto = useUnarchivePhoto();
  const deletePhotoMutation = useDeletePhoto();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Use local state for optimistic updates during drag
  const displayPhotos = localPhotos ?? photos ?? [];

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = displayPhotos.findIndex((p) => p.id === active.id);
        const newIndex = displayPhotos.findIndex((p) => p.id === over.id);

        const newOrder = arrayMove(displayPhotos, oldIndex, newIndex);
        setLocalPhotos(newOrder);

        // Persist the new order
        reorderPhotos.mutate(
          {
            albumId: album.id,
            photoIds: newOrder.map((p) => p.id),
          },
          {
            onSettled: () => {
              setLocalPhotos(null); // Reset to use server data
            },
          }
        );
      }
    },
    [displayPhotos, album.id, reorderPhotos]
  );

  const handleArchive = async (photoId: string) => {
    await archivePhoto.mutateAsync(photoId);
  };

  const handleUnarchive = async (photoId: string) => {
    await unarchivePhoto.mutateAsync(photoId);
  };

  const handleDelete = async (photoId: string) => {
    await deletePhotoMutation.mutateAsync(photoId);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">
            Failed to load photos: {error.message}
          </p>
          <Button variant="outline" className="mt-4 mx-auto block" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Albums
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(new Date(album.event_date), 'EEEE, d MMMM yyyy')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {displayPhotos.length} photo{displayPhotos.length !== 1 ? 's' : ''}
                {showArchived && photos && photos.length !== displayPhotos.length && ' (including archived)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-archived-photos"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived-photos" className="text-sm text-muted-foreground">
                Show archived
              </Label>
            </div>
            <Button onClick={() => setShowUploader(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Photos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : displayPhotos.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Drag photos to reorder them. The order here is how they'll appear on the website.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayPhotos.map((p) => p.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {displayPhotos.map((photo) => (
                    <SortablePhoto
                      key={photo.id}
                      photo={photo}
                      onArchive={() => handleArchive(photo.id)}
                      onUnarchive={() => handleUnarchive(photo.id)}
                      onDelete={() => handleDelete(photo.id)}
                      isArchiving={archivePhoto.isPending}
                      isDeleting={deletePhotoMutation.isPending}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <EmptyState
            icon={Image}
            title="No photos in this album yet"
            action={{
              label: 'Upload Photos',
              onClick: () => setShowUploader(true),
              icon: Upload,
            }}
          />
        )}
      </CardContent>

      <PhotoUploader
        open={showUploader}
        onOpenChange={setShowUploader}
        albumId={album.id}
        venue={album.venue}
      />
    </Card>
  );
}

