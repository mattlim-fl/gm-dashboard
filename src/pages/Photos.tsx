import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AlbumList, AlbumDetailView } from '@/components/photos';
import { PhotoAlbum, Venue } from '@/services/photoService';

export default function Photos() {
  const [venue, setVenue] = useState<Venue>('hippie');
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);

  const handleSelectAlbum = (album: PhotoAlbum) => {
    setSelectedAlbum(album);
  };

  const handleBackToList = () => {
    setSelectedAlbum(null);
  };

  const headerActions = !selectedAlbum ? (
    <Tabs value={venue} onValueChange={(v) => setVenue(v as Venue)}>
      <TabsList>
        <TabsTrigger value="hippie">Hippie Club</TabsTrigger>
        <TabsTrigger value="manor">Manor</TabsTrigger>
      </TabsList>
    </Tabs>
  ) : undefined;

  return (
    <DashboardLayout headerActions={headerActions}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gm-neutral-900 dark:text-white">Photos</h1>
          <p className="text-gm-neutral-600 dark:text-gm-neutral-400">
            Manage photo albums for venue websites
          </p>
        </div>

        {selectedAlbum ? (
          <AlbumDetailView album={selectedAlbum} onBack={handleBackToList} />
        ) : (
          <AlbumList venue={venue} onSelectAlbum={handleSelectAlbum} />
        )}
      </div>
    </DashboardLayout>
  );
}

