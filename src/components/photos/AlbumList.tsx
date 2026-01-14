import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Image, Trash2, Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { ArchiveButton } from '@/components/ui/archive-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoAlbum, Venue } from '@/services/photoService';
import { useAlbums, useArchiveAlbum, useUnarchiveAlbum, useDeleteAlbum } from '@/hooks/usePhotoAlbums';
import { CreateAlbumDialog } from './CreateAlbumDialog';

interface AlbumListProps {
  venue: Venue;
  onSelectAlbum: (album: PhotoAlbum) => void;
}

export function AlbumList({ venue, onSelectAlbum }: AlbumListProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: albums, isLoading, error } = useAlbums(venue, showArchived);
  const archiveAlbum = useArchiveAlbum();
  const unarchiveAlbum = useUnarchiveAlbum();
  const deleteAlbumMutation = useDeleteAlbum();

  const handleArchive = async (albumId: string) => {
    await archiveAlbum.mutateAsync(albumId);
  };

  const handleUnarchive = async (albumId: string) => {
    await unarchiveAlbum.mutateAsync(albumId);
  };

  const handleDelete = async (albumId: string) => {
    await deleteAlbumMutation.mutateAsync({ albumId, venue });
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">
            Failed to load albums: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Photo Albums
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
                Show archived
              </Label>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Album
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : albums && albums.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Date</TableHead>
                <TableHead className="text-center">Photos</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {albums.map((album) => (
                <TableRow
                  key={album.id}
                  className={album.archived ? 'opacity-60' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(new Date(album.event_date), 'EEEE, d MMMM yyyy')}
                      </span>
                      {album.archived && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          Archived
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      {album.photo_count || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(album.created_at), 'd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectAlbum(album)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <ArchiveButton
                        archived={album.archived}
                        onArchive={() => handleArchive(album.id)}
                        onUnarchive={() => handleUnarchive(album.id)}
                        disabled={archiveAlbum.isPending || unarchiveAlbum.isPending}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Album?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this album and all {album.photo_count || 0} photos.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(album.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Image}
            title="No photo albums yet"
            action={{
              label: 'Create First Album',
              onClick: () => setCreateDialogOpen(true),
              icon: Plus,
            }}
          />
        )}
      </CardContent>

      <CreateAlbumDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        venue={venue}
      />
    </Card>
  );
}

