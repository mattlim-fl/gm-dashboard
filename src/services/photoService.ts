import { supabase } from "@/integrations/supabase/client";
import type { Venue } from '@/types/venue';

// Re-export for backwards compatibility
export type { Venue } from '@/types/venue';

export interface PhotoAlbum {
  id: string;
  venue: Venue;
  event_date: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  photo_count?: number;
}

export interface PhotoAlbumImage {
  id: string;
  album_id: string;
  storage_path: string;
  display_order: number;
  created_at: string;
  archived: boolean;
  public_url?: string;
}

const STORAGE_BUCKET = 'venue-photos';

/**
 * Get the public URL for a photo in storage
 */
export function getPhotoPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Create a new photo album
 */
export async function createAlbum(venue: Venue, eventDate: string): Promise<PhotoAlbum> {
  const { data, error } = await supabase
    .from('photo_albums')
    .insert({ venue, event_date: eventDate })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create album: ${error.message}`);
  }

  return data as PhotoAlbum;
}

/**
 * Get all albums for a venue
 */
export async function getAlbums(venue: Venue, includeArchived = false): Promise<PhotoAlbum[]> {
  let query = supabase
    .from('photo_albums')
    .select('*')
    .eq('venue', venue)
    .order('event_date', { ascending: false });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch albums: ${error.message}`);
  }

  // Fetch photo counts for each album
  const albumsWithCounts = await Promise.all(
    (data as PhotoAlbum[]).map(async (album) => {
      const { count } = await supabase
        .from('photo_album_images')
        .select('*', { count: 'exact', head: true })
        .eq('album_id', album.id)
        .eq('archived', false);
      
      return { ...album, photo_count: count || 0 };
    })
  );

  return albumsWithCounts;
}

/**
 * Get a single album by ID
 */
export async function getAlbumById(albumId: string): Promise<PhotoAlbum | null> {
  const { data, error } = await supabase
    .from('photo_albums')
    .select('*')
    .eq('id', albumId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch album: ${error.message}`);
  }

  return data as PhotoAlbum;
}

/**
 * Get all photos for an album
 */
export async function getAlbumPhotos(albumId: string, includeArchived = false): Promise<PhotoAlbumImage[]> {
  let query = supabase
    .from('photo_album_images')
    .select('*')
    .eq('album_id', albumId)
    .order('display_order', { ascending: true });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }

  // Add public URLs to each photo
  return (data as PhotoAlbumImage[]).map((photo) => ({
    ...photo,
    public_url: getPhotoPublicUrl(photo.storage_path),
  }));
}

/**
 * Upload a photo to storage and create a database record
 */
export async function uploadPhoto(
  albumId: string,
  file: File,
  venue: Venue
): Promise<PhotoAlbumImage> {
  // Generate unique filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const storagePath = `${venue}/${albumId}/${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  // Get the next display order
  const { data: existingPhotos } = await supabase
    .from('photo_album_images')
    .select('display_order')
    .eq('album_id', albumId)
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = existingPhotos && existingPhotos.length > 0 
    ? (existingPhotos[0].display_order || 0) + 1 
    : 0;

  // Create database record
  const { data, error } = await supabase
    .from('photo_album_images')
    .insert({
      album_id: albumId,
      storage_path: storagePath,
      display_order: nextOrder,
    })
    .select('*')
    .single();

  if (error) {
    // Clean up uploaded file on DB error
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Failed to create photo record: ${error.message}`);
  }

  return {
    ...data,
    public_url: getPhotoPublicUrl(storagePath),
  } as PhotoAlbumImage;
}

/**
 * Reorder photos within an album
 */
export async function reorderPhotos(albumId: string, photoIds: string[]): Promise<void> {
  // Update each photo's display_order based on its position in the array
  const updates = photoIds.map((id, index) => ({
    id,
    display_order: index,
  }));

  // Use a transaction-like approach with individual updates
  for (const update of updates) {
    const { error } = await supabase
      .from('photo_album_images')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
      .eq('album_id', albumId);

    if (error) {
      throw new Error(`Failed to reorder photos: ${error.message}`);
    }
  }
}

/**
 * Archive a photo (soft delete)
 */
export async function archivePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_album_images')
    .update({ archived: true })
    .eq('id', photoId);

  if (error) {
    throw new Error(`Failed to archive photo: ${error.message}`);
  }
}

/**
 * Unarchive a photo
 */
export async function unarchivePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_album_images')
    .update({ archived: false })
    .eq('id', photoId);

  if (error) {
    throw new Error(`Failed to unarchive photo: ${error.message}`);
  }
}

/**
 * Permanently delete a photo (removes from storage and DB)
 */
export async function deletePhoto(photoId: string): Promise<void> {
  // First get the photo to find the storage path
  const { data: photo, error: fetchError } = await supabase
    .from('photo_album_images')
    .select('storage_path')
    .eq('id', photoId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch photo for deletion: ${fetchError.message}`);
  }

  // Delete from storage
  if (photo?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([photo.storage_path]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
      // Continue with DB deletion even if storage delete fails
    }
  }

  // Delete from database
  const { error } = await supabase
    .from('photo_album_images')
    .delete()
    .eq('id', photoId);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}

/**
 * Archive an album (soft delete)
 */
export async function archiveAlbum(albumId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_albums')
    .update({ archived: true })
    .eq('id', albumId);

  if (error) {
    throw new Error(`Failed to archive album: ${error.message}`);
  }
}

/**
 * Unarchive an album
 */
export async function unarchiveAlbum(albumId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_albums')
    .update({ archived: false })
    .eq('id', albumId);

  if (error) {
    throw new Error(`Failed to unarchive album: ${error.message}`);
  }
}

/**
 * Permanently delete an album and all its photos
 */
export async function deleteAlbum(albumId: string, venue: Venue): Promise<void> {
  // Get all photos in the album
  const { data: photos } = await supabase
    .from('photo_album_images')
    .select('storage_path')
    .eq('album_id', albumId);

  // Delete all photos from storage
  if (photos && photos.length > 0) {
    const paths = photos.map((p) => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    }
  }

  // Delete album (cascade will delete photo records)
  const { error } = await supabase
    .from('photo_albums')
    .delete()
    .eq('id', albumId);

  if (error) {
    throw new Error(`Failed to delete album: ${error.message}`);
  }
}

/**
 * Update album details
 */
export async function updateAlbum(albumId: string, eventDate: string): Promise<PhotoAlbum> {
  const { data, error } = await supabase
    .from('photo_albums')
    .update({ event_date: eventDate })
    .eq('id', albumId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update album: ${error.message}`);
  }

  return data as PhotoAlbum;
}

