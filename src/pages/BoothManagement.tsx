import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Archive, ArchiveRestore, Settings, MapPin, Users, Clock } from "lucide-react";
import { useKaraokeBooths, useCreateKaraokeBooth, useUpdateKaraokeBooth, useToggleBoothAvailability, useArchiveBooth, useRestoreBooth } from "@/hooks/useKaraoke";
import { useToast } from "@/hooks/use-toast";
import { KaraokeBoothRow, KaraokeBoothInsert, KaraokeBoothUpdate } from "@/types/karaoke";

const BoothManagement = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<KaraokeBoothRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [venueFilter, setVenueFilter] = useState<'all' | 'manor' | 'hippie'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const { data: booths, isLoading } = useKaraokeBooths({
    venue: venueFilter,
    search: searchTerm,
    is_archived: showArchived
  });
  const createBooth = useCreateKaraokeBooth();
  const updateBooth = useUpdateKaraokeBooth();
  const toggleAvailability = useToggleBoothAvailability();
  const archiveBooth = useArchiveBooth();
  const restoreBooth = useRestoreBooth();
  const { toast } = useToast();

  const handleCreateBooth = async (data: KaraokeBoothInsert) => {
    try {
      await createBooth.mutateAsync(data);
      setIsCreateDialogOpen(false);
    } catch (_error) {
      // Silent fail for booth creation
    }
  };

  const handleUpdateBooth = async (data: KaraokeBoothUpdate) => {
    if (!selectedBooth) return;
    
    try {
      await updateBooth.mutateAsync({ id: selectedBooth.id, data });
      setIsEditDialogOpen(false);
      setSelectedBooth(null);
    } catch (_error) {
      // Silent fail for booth update
    }
  };

  const handleToggleAvailability = async (boothId: string, isAvailable: boolean) => {
    try {
      await toggleAvailability.mutateAsync({ id: boothId, isAvailable });
    } catch (_error) {
      // Silent fail for availability toggle
    }
  };

  const handleArchiveBooth = async (boothId: string) => {
    try {
      await archiveBooth.mutateAsync(boothId);
    } catch (_error) {
      // Error handled by hook
    }
  };

  const handleRestoreBooth = async (boothId: string) => {
    try {
      await restoreBooth.mutateAsync(boothId);
    } catch (_error) {
      // Error handled by hook
    }
  };

  const openEditDialog = (booth: KaraokeBoothRow) => {
    setSelectedBooth(booth);
    setIsEditDialogOpen(true);
  };

  const filteredBooths = booths?.filter(booth => {
    const matchesSearch = !searchTerm || 
      booth.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booth.venue.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  }) || [];

  const stats = {
    totalBooths: booths?.length || 0,
    availableBooths: booths?.filter(b => b.is_available).length || 0,
    manorBooths: booths?.filter(b => b.venue === 'manor').length || 0,
    hippieBooths: booths?.filter(b => b.venue === 'hippie').length || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900">Booth Management</h1>
            <p className="text-gm-neutral-600">
              Manage karaoke booths and their availability
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Booth
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Karaoke Booth</DialogTitle>
              </DialogHeader>
              <BoothForm onSubmit={handleCreateBooth} isLoading={createBooth.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Booths</CardTitle>
              <Settings className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBooths}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Settings className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.availableBooths}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manor</CardTitle>
              <MapPin className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.manorBooths}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hippie Club</CardTitle>
              <MapPin className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hippieBooths}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1">
            <Input
              placeholder="Search booths by name or venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Select value={venueFilter} onValueChange={(value: 'all' | 'manor' | 'hippie') => setVenueFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              <SelectItem value="manor">Manor</SelectItem>
              <SelectItem value="hippie">Hippie Club</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm text-gm-neutral-600 cursor-pointer">
              Show Archived
            </Label>
          </div>
        </div>

        {/* Booths Table */}
        <Card>
          <CardHeader>
            <CardTitle>{showArchived ? 'Archived Booths' : 'Karaoke Booths'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gm-neutral-500">Loading booths...</div>
              </div>
            ) : filteredBooths.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                {showArchived ? (
                  <>
                    <Archive className="h-12 w-12 text-gm-neutral-300 mb-4" />
                    <p className="text-gm-neutral-500">No archived booths</p>
                    <p className="text-sm text-gm-neutral-400 mt-1">
                      Archived booths will appear here
                    </p>
                  </>
                ) : (
                  <>
                    <Settings className="h-12 w-12 text-gm-neutral-300 mb-4" />
                    <p className="text-gm-neutral-500">No booths found</p>
                    <p className="text-sm text-gm-neutral-400 mt-1">
                      Create a new booth to get started
                    </p>
                  </>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Capacity</TableHead>
                                      <TableHead>Rate</TableHead>
                  <TableHead>Operating Hours</TableHead>
                  <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBooths.map((booth) => (
                    <TableRow key={booth.id}>
                      <TableCell className="font-medium">{booth.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {booth.venue === 'manor' ? 'Manor' : 'Hippie Club'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-gm-neutral-500" />
                          {booth.capacity}
                        </div>
                      </TableCell>
                      <TableCell>
                        ${booth.hourly_rate}/hr
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gm-neutral-500" />
                          {booth.operating_hours_start} - {booth.operating_hours_end}
                        </div>
                      </TableCell>
                      <TableCell>
                        {showArchived ? (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            Archived
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={booth.is_available}
                              onCheckedChange={(checked) =>
                                handleToggleAvailability(booth.id, checked)
                              }
                            />
                            <span className={`text-sm ${booth.is_available ? 'text-green-600' : 'text-red-600'}`}>
                              {booth.is_available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {showArchived ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreBooth(booth.id)}
                              disabled={restoreBooth.isPending}
                              title="Restore booth"
                            >
                              <ArchiveRestore className="h-3 w-3" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(booth)}
                                title="Edit booth"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleArchiveBooth(booth.id)}
                                disabled={archiveBooth.isPending}
                                title="Archive booth"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              >
                                <Archive className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Karaoke Booth</DialogTitle>
            </DialogHeader>
            {selectedBooth && (
              <BoothForm
                initialData={selectedBooth}
                onSubmit={handleUpdateBooth}
                isLoading={updateBooth.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Form component for creating/editing booths
interface BoothFormProps {
  initialData?: KaraokeBoothRow;
  onSubmit: (data: KaraokeBoothInsert | KaraokeBoothUpdate) => void;
  isLoading: boolean;
}

const BoothForm = ({ initialData, onSubmit, isLoading }: BoothFormProps) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    venue: initialData?.venue || 'manor',
    capacity: initialData?.capacity || 8,
    hourly_rate: initialData?.hourly_rate || 25.00,
    is_available: initialData?.is_available ?? true,
    maintenance_notes: initialData?.maintenance_notes || '',
    operating_hours_start: initialData?.operating_hours_start || '10:00',
    operating_hours_end: initialData?.operating_hours_end || '23:00',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Booth Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Karaoke Room A"
          required
        />
      </div>

      <div>
        <Label htmlFor="venue">Venue</Label>
        <Select value={formData.venue} onValueChange={(value: 'manor' | 'hippie') => setFormData({ ...formData, venue: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select venue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manor">Manor</SelectItem>
            <SelectItem value="hippie">Hippie Club</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="capacity">Capacity</Label>
        <Input
          id="capacity"
          type="number"
          min="1"
          max="50"
          value={formData.capacity}
          onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
          required
        />
      </div>

      <div>
        <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
        <Input
          id="hourly_rate"
          type="number"
          min="0"
          step="0.01"
          value={formData.hourly_rate}
          onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="operating_hours_start">Opening Time</Label>
          <Input
            id="operating_hours_start"
            type="time"
            value={formData.operating_hours_start}
            onChange={(e) => setFormData({ ...formData, operating_hours_start: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="operating_hours_end">Closing Time</Label>
          <Input
            id="operating_hours_end"
            type="time"
            value={formData.operating_hours_end}
            onChange={(e) => setFormData({ ...formData, operating_hours_end: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={formData.is_available}
          onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
        />
        <Label>Available for booking</Label>
      </div>

      <div>
        <Label htmlFor="maintenance_notes">Maintenance Notes</Label>
        <Textarea
          id="maintenance_notes"
          value={formData.maintenance_notes}
          onChange={(e) => setFormData({ ...formData, maintenance_notes: e.target.value })}
          placeholder="Any maintenance notes or special instructions..."
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Saving...' : (initialData ? 'Update Booth' : 'Create Booth')}
      </Button>
    </form>
  );
};

export default BoothManagement; 