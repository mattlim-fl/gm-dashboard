import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PhotoAlbum,
  PhotoAlbumImage,
  Venue,
  getAlbums,
  getAlbumById,
  getAlbumPhotos,
  createAlbum,
  uploadPhoto,
  reorderPhotos,
  archivePhoto,
  unarchivePhoto,
  deletePhoto,
  archiveAlbum,
  unarchiveAlbum,
  deleteAlbum,
  updateAlbum,
} from '@/services/photoService';

const ALBUMS_KEY = 'photo-albums';
const PHOTOS_KEY = 'album-photos';

/**
 * Hook to fetch all albums for a venue
 */
export function useAlbums(venue: Venue, includeArchived = false) {
  return useQuery({
    queryKey: [ALBUMS_KEY, venue, includeArchived],
    queryFn: () => getAlbums(venue, includeArchived),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single album by ID
 */
export function useAlbum(albumId: string | undefined) {
  return useQuery({
    queryKey: [ALBUMS_KEY, albumId],
    queryFn: () => (albumId ? getAlbumById(albumId) : null),
    enabled: !!albumId,
  });
}

/**
 * Hook to fetch photos for an album
 */
export function useAlbumPhotos(albumId: string | undefined, includeArchived = false) {
  return useQuery({
    queryKey: [PHOTOS_KEY, albumId, includeArchived],
    queryFn: () => (albumId ? getAlbumPhotos(albumId, includeArchived) : []),
    enabled: !!albumId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a new album
 */
export function useCreateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venue, eventDate }: { venue: Venue; eventDate: string }) =>
      createAlbum(venue, eventDate),
    onSuccess: (_, { venue }) => {
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY, venue] });
    },
  });
}

/**
 * Hook to update album details
 */
export function useUpdateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ albumId, eventDate }: { albumId: string; eventDate: string }) =>
      updateAlbum(albumId, eventDate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY] });
      queryClient.setQueryData([ALBUMS_KEY, data.id], data);
    },
  });
}

/**
 * Hook to upload photos to an album
 */
export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ albumId, file, venue }: { albumId: string; file: File; venue: Venue }) =>
      uploadPhoto(albumId, file, venue),
    onSuccess: (_, { albumId, venue }) => {
      queryClient.invalidateQueries({ queryKey: [PHOTOS_KEY, albumId] });
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY, venue] }); // Update photo count
    },
  });
}

/**
 * Hook to reorder photos within an album with optimistic updates
 */
export function useReorderPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ albumId, photoIds }: { albumId: string; photoIds: string[] }) =>
      reorderPhotos(albumId, photoIds),
    onMutate: async ({ albumId, photoIds }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [PHOTOS_KEY, albumId] });

      // Snapshot the previous value
      const previousPhotos = queryClient.getQueryData<PhotoAlbumImage[]>([PHOTOS_KEY, albumId, false]);

      // Optimistically update to the new order
      if (previousPhotos) {
        const reorderedPhotos = photoIds
          .map((id, index) => {
            const photo = previousPhotos.find((p) => p.id === id);
            return photo ? { ...photo, display_order: index } : null;
          })
          .filter(Boolean) as PhotoAlbumImage[];

        queryClient.setQueryData([PHOTOS_KEY, albumId, false], reorderedPhotos);
      }

      return { previousPhotos };
    },
    onError: (err, { albumId }, context) => {
      // Rollback on error
      if (context?.previousPhotos) {
        queryClient.setQueryData([PHOTOS_KEY, albumId, false], context.previousPhotos);
      }
    },
    onSettled: (_, __, { albumId }) => {
      queryClient.invalidateQueries({ queryKey: [PHOTOS_KEY, albumId] });
    },
  });
}

/**
 * Hook to archive a photo
 */
export function useArchivePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archivePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PHOTOS_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY] }); // Update photo count
    },
  });
}

/**
 * Hook to unarchive a photo
 */
export function useUnarchivePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unarchivePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PHOTOS_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY] });
    },
  });
}

/**
 * Hook to permanently delete a photo
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PHOTOS_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY] });
    },
  });
}

/**
 * Hook to archive an album
 */
export function useArchiveAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY] });
    },
  });
}

/**
 * Hook to unarchive an album
 */
export function useUnarchiveAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unarchiveAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY] });
    },
  });
}

/**
 * Hook to permanently delete an album
 */
export function useDeleteAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ albumId, venue }: { albumId: string; venue: Venue }) =>
      deleteAlbum(albumId, venue),
    onSuccess: (_, { venue }) => {
      queryClient.invalidateQueries({ queryKey: [ALBUMS_KEY, venue] });
    },
  });
}

