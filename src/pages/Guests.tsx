import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, UserPlus, Search, UserCheck, Clock, X, Star, StickyNote } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useBookings } from "@/hooks/useBookings";
import { useMembers } from "@/hooks/useMembers";
import { CustomerRow } from "@/services/customerService";
import { Member, MemberFilters, Venue, MemberStatus } from "@/services/memberService";
import { CustomerFilters, CustomerFilterProps } from "@/components/customers/CustomerFilters";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { CustomerPagination } from "@/components/customers/CustomerPagination";
import { CustomerProfilePanel } from "@/components/customers/CustomerProfilePanel";
import { MemberProfilePanel } from "@/components/members/MemberProfilePanel";
import { AddMemberDialog } from "@/components/members/AddMemberDialog";
import { format } from "date-fns";

const VALID_TABS = ['customers', 'members'] as const;
type TabValue = typeof VALID_TABS[number];

// Extended customer type with booking stats for display
type CustomerWithStats = CustomerRow & {
  totalBookings: number;
  lastVisit: string | null;
  customerSince: string;
};

export default function Guests() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get tab from URL or default to 'customers'
  const tabFromUrl = searchParams.get('tab') as TabValue | null;
  const activeTab = tabFromUrl && VALID_TABS.includes(tabFromUrl)
    ? tabFromUrl
    : 'customers';

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', value);
    navigate(`/guests?${newSearchParams.toString()}`, { replace: true });
  };

  // Ensure URL has tab parameter on initial load if missing
  useEffect(() => {
    if (!searchParams.get('tab')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', 'customers');
      navigate(`/guests?${newSearchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // ==================== CUSTOMERS STATE ====================
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<keyof CustomerWithStats>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [customerFilters, setCustomerFilters] = useState<CustomerFilterProps>({
    search: '',
  });
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // ==================== MEMBERS STATE ====================
  const [memberSearch, setMemberSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState<Venue | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  // ==================== CUSTOMERS DATA ====================
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers({
    search: customerFilters.search || undefined,
  });

  const { data: allBookings = [] } = useBookings({});

  const customersWithStats = useMemo(() => {
    const customerMap = new Map<string, CustomerWithStats>();

    customers.forEach(customer => {
      customerMap.set(customer.id, {
        ...customer,
        totalBookings: 0,
        lastVisit: null,
        customerSince: customer.created_at || new Date().toISOString(),
      });
    });

    allBookings.forEach(booking => {
      const matchingCustomer = customers.find(c =>
        (c.email && booking.customer_email && c.email.toLowerCase() === booking.customer_email.toLowerCase()) ||
        (c.phone && booking.customer_phone && c.phone === booking.customer_phone)
      );

      if (matchingCustomer) {
        const customer = customerMap.get(matchingCustomer.id);
        if (customer) {
          customer.totalBookings += 1;
          if (!customer.lastVisit || booking.booking_date > customer.lastVisit) {
            customer.lastVisit = booking.booking_date;
          }
        }
      }
    });

    return Array.from(customerMap.values());
  }, [customers, allBookings]);

  const filteredCustomers = useMemo(() => {
    return customersWithStats.filter(customer => {
      const matchesSearch = !customerFilters.search ||
        customer.name.toLowerCase().includes(customerFilters.search.toLowerCase()) ||
        (customer.email && customer.email.toLowerCase().includes(customerFilters.search.toLowerCase())) ||
        (customer.phone && customer.phone.toLowerCase().includes(customerFilters.search.toLowerCase()));

      return matchesSearch;
    });
  }, [customersWithStats, customerFilters]);

  const sortedCustomers = useMemo(() => {
    const sorted = [...filteredCustomers].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'phone':
          aValue = a.phone || '';
          bValue = b.phone || '';
          break;
        case 'totalBookings':
          aValue = a.totalBookings;
          bValue = b.totalBookings;
          break;
        case 'lastVisit':
          aValue = a.lastVisit || '';
          bValue = b.lastVisit || '';
          break;
        case 'customerSince':
          aValue = a.customerSince;
          bValue = b.customerSince;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [filteredCustomers, sortField, sortDirection]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedCustomers.slice(startIndex, endIndex);
  }, [sortedCustomers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);

  const handleCustomerFiltersChange = (newFilters: Partial<CustomerFilterProps>) => {
    setCustomerFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const handleSort = (field: keyof CustomerWithStats) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const customerStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const newThisMonth = customersWithStats.filter(c =>
      c.created_at && c.created_at >= startOfMonth
    ).length;

    return {
      totalCustomers: customersWithStats.length,
      newThisMonth,
    };
  }, [customersWithStats]);

  const handleClearCustomerFilters = () => {
    setCustomerFilters({ search: '' });
    setCurrentPage(1);
  };

  // ==================== MEMBERS DATA ====================
  const memberFilters: MemberFilters = {
    ...(venueFilter !== "all" && { venue: venueFilter }),
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(memberSearch && { search: memberSearch }),
  };

  const { data: members = [], isLoading: loadingMembers } = useMembers(memberFilters);

  const memberStats = useMemo(() => {
    return {
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      pending: members.filter((m) => !m.first_visit_date).length,
    };
  }, [members]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd/MM/yyyy");
  };

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getVenueBadge = (venue: Venue) => {
    const colors = {
      manor: "bg-purple-100 text-purple-800",
      hippie: "bg-pink-100 text-pink-800",
      daisy: "bg-yellow-100 text-yellow-800",
    };
    return (
      <Badge className={`${colors[venue]} hover:${colors[venue]}`}>
        {venue.charAt(0).toUpperCase() + venue.slice(1)}
      </Badge>
    );
  };

  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setIsDetailOpen(true);
  };

  const clearMemberFilters = () => {
    setMemberSearch("");
    setVenueFilter("all");
    setStatusFilter("all");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900 dark:text-white">Guests</h1>
            <p className="text-gm-neutral-600 dark:text-gm-neutral-400">
              Manage customers and members
            </p>
          </div>

          {/* Conditional action buttons */}
          {activeTab === 'customers' ? (
            <Button onClick={() => setIsAddCustomerOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Customer
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/members/checkin">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Door Check-in
                </Link>
              </Button>
              <Button onClick={() => setIsAddMemberOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>

          {/* ==================== CUSTOMERS TAB ==================== */}
          <TabsContent value="customers" className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-gm-neutral-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{loadingCustomers ? '-' : customerStats.totalCustomers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New This Month</CardTitle>
                  <UserPlus className="h-4 w-4 text-gm-neutral-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{loadingCustomers ? '-' : customerStats.newThisMonth}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <CustomerFilters
              filters={customerFilters}
              onFiltersChange={handleCustomerFiltersChange}
              onClearFilters={handleClearCustomerFilters}
            />

            {/* Results Count */}
            <div>
              <p className="text-sm text-gm-neutral-600 dark:text-gm-neutral-400">
                {sortedCustomers.length} customer{sortedCustomers.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {/* Customers Table */}
            <CustomersTable
              customers={paginatedCustomers}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

            {/* Add Customer Panel */}
            <CustomerProfilePanel
              isOpen={isAddCustomerOpen}
              onClose={() => setIsAddCustomerOpen(false)}
              customer={null}
              onEdit={() => setIsAddCustomerOpen(false)}
              initialView="edit"
            />

            {/* Pagination */}
            {sortedCustomers.length > 0 && (
              <CustomerPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={sortedCustomers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(newItemsPerPage) => {
                  setItemsPerPage(newItemsPerPage);
                  setCurrentPage(1);
                }}
              />
            )}
          </TabsContent>

          {/* ==================== MEMBERS TAB ==================== */}
          <TabsContent value="members" className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                  <Users className="h-4 w-4 text-gm-neutral-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{loadingMembers ? "-" : memberStats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                  <UserCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{loadingMembers ? "-" : memberStats.active}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Awaiting First Visit</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{loadingMembers ? "-" : memberStats.pending}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gm-neutral-800 p-4 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gm-neutral-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={venueFilter} onValueChange={(v) => setVenueFilter(v as Venue | "all")}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="All Venues" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Venues</SelectItem>
                    <SelectItem value="manor">Manor</SelectItem>
                    <SelectItem value="hippie">Hippie</SelectItem>
                    <SelectItem value="daisys">Daisy's</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MemberStatus | "all")}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={clearMemberFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Results Count */}
            <p className="text-sm text-gm-neutral-600 dark:text-gm-neutral-400">
              {members.length} member{members.length !== 1 ? "s" : ""} found
            </p>

            {/* Members Table */}
            <div className="bg-white dark:bg-gm-neutral-900 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>First Visit</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMembers ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gm-neutral-500">
                        No members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow
                        key={member.id}
                        className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                        onClick={() => handleViewMember(member)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {member.name}
                            {!member.first_visit_date && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                NEW
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{member.phone}</TableCell>
                        <TableCell>{formatDate(member.date_of_birth)}</TableCell>
                        <TableCell>{getVenueBadge(member.venue)}</TableCell>
                        <TableCell>{getStatusBadge(member.status)}</TableCell>
                        <TableCell>{formatDate(member.membership_start)}</TableCell>
                        <TableCell>{formatDate(member.membership_expiry)}</TableCell>
                        <TableCell>
                          {member.first_visit_date ? (
                            formatDate(member.first_visit_date)
                          ) : (
                            <span className="text-gm-neutral-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.notes ? (
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <StickyNote className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                              <span className="text-sm text-gm-neutral-600 dark:text-gm-neutral-400 truncate" title={member.notes}>
                                {member.notes}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gm-neutral-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Member Profile Panel */}
            <MemberProfilePanel
              member={selectedMember}
              isOpen={isDetailOpen}
              onClose={() => {
                setIsDetailOpen(false);
                setSelectedMember(null);
              }}
            />

            {/* Add Member Dialog */}
            <AddMemberDialog
              isOpen={isAddMemberOpen}
              onClose={() => setIsAddMemberOpen(false)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
