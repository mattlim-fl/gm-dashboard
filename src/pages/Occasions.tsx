import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { occasionService, OccasionWithStats } from '@/services/occasionService';
import CreateOccasionDialog from '@/components/occasions/CreateOccasionDialog';
import OccasionDetailPanel from '@/components/occasions/OccasionDetailPanel';
import { Plus, Calendar, Users, DollarSign, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function Occasions() {
  const [occasions, setOccasions] = useState<OccasionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Filters
  const [venueFilter, setVenueFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOccasions();
  }, [venueFilter, statusFilter]);

  const loadOccasions = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (venueFilter !== 'all') filters.venue = venueFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      
      const data = await occasionService.getOccasions(filters);
      setOccasions(data);
    } catch (err) {
      console.error('Failed to load occasions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOccasionClick = (occasionId: string) => {
    setSelectedOccasionId(occasionId);
    setDetailPanelOpen(true);
  };

  const handleCreateSuccess = () => {
    loadOccasions();
  };

  const filteredOccasions = occasions.filter(occasion => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      occasion.name.toLowerCase().includes(query) ||
      occasion.organiser_name?.toLowerCase().includes(query) ||
      occasion.organiser_email?.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900">Occasions</h1>
            <p className="text-gm-neutral-600 mt-1">Manage capacity-limited events and guest lists</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Occasion
          </Button>
        </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search occasions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={venueFilter} onValueChange={setVenueFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              <SelectItem value="manor">Manor</SelectItem>
              <SelectItem value="hippie">Hippie Club</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Occasions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-500">Loading occasions...</p>
        </div>
      ) : filteredOccasions.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No occasions found</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || venueFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by creating your first occasion'}
          </p>
          {!searchQuery && venueFilter === 'all' && statusFilter === 'all' && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Occasion
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOccasions.map((occasion) => {
            const formattedDate = occasion.occasion_date 
              ? format(parseISO(occasion.occasion_date), 'MMM d, yyyy')
              : 'Date not set';
            const capacityPercent = (occasion.total_guests / occasion.capacity) * 100;
            const ticketPrice = (occasion.ticket_price_cents / 100).toFixed(2);

            return (
              <Card
                key={occasion.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleOccasionClick(occasion.id)}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg line-clamp-2">{occasion.name}</h3>
                      <Badge variant={occasion.status === 'active' ? 'default' : 'secondary'}>
                        {occasion.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={occasion.venue === 'manor' ? 'default' : 'secondary'}>
                        {occasion.venue === 'manor' ? 'Manor' : 'Hippie'}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="h-4 w-4" />
                      <span>${ticketPrice} per ticket</span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4" />
                          <span>Capacity</span>
                        </div>
                        <span className="font-medium">
                          {occasion.total_guests}/{occasion.capacity}
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            capacityPercent >= 100
                              ? 'bg-red-600'
                              : capacityPercent >= 80
                              ? 'bg-yellow-600'
                              : 'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {occasion.remaining_capacity} spots remaining
                      </p>
                    </div>
                  </div>

                  {/* Organiser */}
                  {occasion.organiser_name && (
                    <div className="pt-3 border-t text-sm text-gray-600">
                      <span className="font-medium">Organiser:</span> {occasion.organiser_name}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateOccasionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Detail Panel */}
      <OccasionDetailPanel
        occasionId={selectedOccasionId}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onRefresh={loadOccasions}
      />
      </div>
    </DashboardLayout>
  );
}

