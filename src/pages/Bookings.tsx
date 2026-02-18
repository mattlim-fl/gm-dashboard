
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BookingsList } from "@/components/bookings/BookingsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar, Clock, CheckCircle, AlertCircle, Building, Users, DollarSign, Search } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { UnifiedBookingSidePanel } from "@/components/bookings/UnifiedBookingSidePanel";
import { occasionService, OccasionWithStats } from '@/services/occasionService';
import CreateOccasionDialog from '@/components/occasions/CreateOccasionDialog';
import OccasionDetailPanel from '@/components/occasions/OccasionDetailPanel';
import { format, parseISO } from 'date-fns';

const VALID_TABS = ['all', 'venue', 'vip', 'karaoke', 'occasions'] as const;
type TabValue = typeof VALID_TABS[number];

const Bookings = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: bookings = [] } = useBookings();
  const [isCreateBookingOpen, setIsCreateBookingOpen] = useState(false);

  // Get tab from URL or default to 'all'
  const tabFromUrl = searchParams.get('tab') as TabValue | null;
  const activeTab = tabFromUrl && VALID_TABS.includes(tabFromUrl)
    ? tabFromUrl
    : 'all';

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', value);
    navigate(`/bookings?${newSearchParams.toString()}`, { replace: true });
  };

  // Ensure URL has tab parameter on initial load if missing
  useEffect(() => {
    if (!searchParams.get('tab')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', 'all');
      navigate(`/bookings?${newSearchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // ==================== OCCASIONS STATE ====================
  const [occasions, setOccasions] = useState<OccasionWithStats[]>([]);
  const [occasionsLoading, setOccasionsLoading] = useState(false);
  const [createOccasionDialogOpen, setCreateOccasionDialogOpen] = useState(false);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [occasionDetailPanelOpen, setOccasionDetailPanelOpen] = useState(false);
  const [occasionVenueFilter, setOccasionVenueFilter] = useState('all');
  const [occasionStatusFilter, setOccasionStatusFilter] = useState('all');
  const [occasionSearchQuery, setOccasionSearchQuery] = useState('');

  // Load occasions when tab is active or filters change
  useEffect(() => {
    if (activeTab === 'occasions') {
      loadOccasions();
    }
  }, [activeTab, occasionVenueFilter, occasionStatusFilter]);

  const loadOccasions = async () => {
    setOccasionsLoading(true);
    try {
      const filters: any = {};
      if (occasionVenueFilter !== 'all') filters.venue = occasionVenueFilter;
      if (occasionStatusFilter !== 'all') filters.status = occasionStatusFilter;

      const data = await occasionService.getOccasions(filters);
      setOccasions(data);
    } catch (err) {
      console.error('Failed to load occasions:', err);
    } finally {
      setOccasionsLoading(false);
    }
  };

  const handleOccasionClick = (occasionId: string) => {
    setSelectedOccasionId(occasionId);
    setOccasionDetailPanelOpen(true);
  };

  const handleCreateOccasionSuccess = () => {
    loadOccasions();
  };

  const filteredOccasions = occasions.filter(occasion => {
    if (!occasionSearchQuery) return true;
    const query = occasionSearchQuery.toLowerCase();
    return (
      occasion.occasion_name.toLowerCase().includes(query) ||
      occasion.organiser_name?.toLowerCase().includes(query) ||
      occasion.organiser_email?.toLowerCase().includes(query)
    );
  });

  const stats = {
    totalBookings: bookings.length,
    todayBookings: bookings.filter(booking =>
      booking.booking_date === new Date().toISOString().split('T')[0]
    ).length,
    completedBookings: bookings.filter(booking => booking.status === 'completed').length,
    pendingBookings: bookings.filter(booking => booking.status === 'pending').length,
     karaokeBookings: bookings.filter(booking =>
      booking.booking_type === 'karaoke_booking' ||
      (booking.booking_type === 'venue_hire' && booking.venue_area === 'karaoke')
    ).length,
  };

  const handleCreateBooking = () => {
    setIsCreateBookingOpen(true);
  };

  const handleBookingCreated = () => {
    setIsCreateBookingOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900">Bookings</h1>
            <p className="text-gm-neutral-600">
              {stats.totalBookings} bookings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/booth-management')}
              className="flex items-center gap-2"
            >
              <Building className="h-4 w-4" />
              Manage Booths
            </Button>
            {activeTab === 'occasions' ? (
              <Button onClick={() => setCreateOccasionDialogOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Occasion
              </Button>
            ) : (
              <Button onClick={handleCreateBooking} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Booking
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Clock className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingBookings}</div>
            </CardContent>
          </Card>
        </div>

        {/* Booking Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All Bookings</TabsTrigger>
            <TabsTrigger value="venue">Venue Bookings</TabsTrigger>
            <TabsTrigger value="vip">VIP Tickets</TabsTrigger>
            <TabsTrigger value="karaoke">Karaoke Bookings</TabsTrigger>
            <TabsTrigger value="occasions">Occasions</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <BookingsList />
          </TabsContent>

          <TabsContent value="venue" className="mt-6">
            <BookingsList
              initialFilters={{ bookingType: 'venue_hire' }}
              title="Venue Bookings"
            />
          </TabsContent>

          <TabsContent value="vip" className="mt-6">
            <BookingsList
              initialFilters={{ bookingType: 'vip_tickets' }}
              title="VIP Tickets"
            />
          </TabsContent>

          <TabsContent value="karaoke" className="mt-6">
            <BookingsList
              initialFilters={{ bookingType: 'karaoke_booking' }}
              title="Karaoke Bookings"
            />
          </TabsContent>

          <TabsContent value="occasions" className="mt-6 space-y-6">
            {/* Occasions Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search occasions..."
                      value={occasionSearchQuery}
                      onChange={(e) => setOccasionSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <Select value={occasionVenueFilter} onValueChange={setOccasionVenueFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Venues" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Venues</SelectItem>
                    <SelectItem value="manor">Manor</SelectItem>
                    <SelectItem value="hippie">Hippie Club</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={occasionStatusFilter} onValueChange={setOccasionStatusFilter}>
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
            {occasionsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-4 text-gray-500">Loading occasions...</p>
              </div>
            ) : filteredOccasions.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No occasions found</h3>
                <p className="text-gray-500 mb-6">
                  {occasionSearchQuery || occasionVenueFilter !== 'all' || occasionStatusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by creating your first occasion'}
                </p>
                {!occasionSearchQuery && occasionVenueFilter === 'all' && occasionStatusFilter === 'all' && (
                  <Button onClick={() => setCreateOccasionDialogOpen(true)}>
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
                          {/* Occasion Name - Prominent */}
                          <h3 className="font-semibold text-xl mb-3 text-gray-900 dark:text-white line-clamp-2">
                            {occasion.occasion_name}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={occasion.venue === 'manor' ? 'default' : 'secondary'}
                              className={occasion.venue === 'hippie' ? 'bg-pink-600 text-white hover:bg-pink-600' : ''}
                            >
                              {occasion.venue === 'manor' ? 'Manor' : 'Hippie'}
                            </Badge>
                            <Badge variant={occasion.status === 'active' ? 'default' : 'secondary'}>
                              {occasion.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Calendar className="h-4 w-4" />
                            <span>{formattedDate}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <DollarSign className="h-4 w-4" />
                            <span>${ticketPrice} per ticket</span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-sm mb-2">
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <Users className="h-4 w-4" />
                                <span>Capacity</span>
                              </div>
                              <span className="font-medium dark:text-white">
                                {occasion.total_guests}/{occasion.capacity}
                              </span>
                            </div>
                            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {occasion.remaining_capacity} spots remaining
                            </p>
                          </div>
                        </div>

                        {/* Organiser */}
                        {occasion.organiser_name && (
                          <div className="pt-3 border-t dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Organiser:</span> {occasion.organiser_name}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Create Occasion Dialog */}
            <CreateOccasionDialog
              open={createOccasionDialogOpen}
              onOpenChange={setCreateOccasionDialogOpen}
              onSuccess={handleCreateOccasionSuccess}
            />

            {/* Occasion Detail Panel */}
            <OccasionDetailPanel
              occasionId={selectedOccasionId}
              open={occasionDetailPanelOpen}
              onOpenChange={setOccasionDetailPanelOpen}
              onRefresh={loadOccasions}
            />
          </TabsContent>
        </Tabs>

        {/* Create Booking Side Panel */}
        <UnifiedBookingSidePanel
          isOpen={isCreateBookingOpen}
          onClose={handleBookingCreated}
        />
      </div>
    </DashboardLayout>
  );
};

export default Bookings;
