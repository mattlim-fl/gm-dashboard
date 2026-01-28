
import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CustomerFilters, CustomerFilterProps } from "@/components/customers/CustomerFilters";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { CustomerPagination } from "@/components/customers/CustomerPagination";
import { CustomerProfilePanel } from "@/components/customers/CustomerProfilePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, UserPlus } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useBookings } from "@/hooks/useBookings";
import { CustomerRow } from "@/services/customerService";

// Extended customer type with booking stats for display
type CustomerWithStats = CustomerRow & {
  totalBookings: number;
  lastVisit: string | null;
  customerSince: string;
};

const Customers = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<keyof CustomerWithStats>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<CustomerFilterProps>({
    search: '',
  });

  // Fetch customers from database
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers({
    search: filters.search || undefined,
  });

  // Fetch all bookings to calculate stats
  const { data: allBookings = [] } = useBookings({});

  // Calculate booking stats per customer
  const customersWithStats = useMemo(() => {
    const customerMap = new Map<string, CustomerWithStats>();

    // Initialize with customer data
    customers.forEach(customer => {
      customerMap.set(customer.id, {
        ...customer,
        totalBookings: 0,
        lastVisit: null,
        customerSince: customer.created_at || new Date().toISOString(),
      });
    });

    // Calculate stats from bookings
    allBookings.forEach(booking => {
      // Match booking to customer by email or phone
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
      const matchesSearch = !filters.search ||
        customer.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        (customer.email && customer.email.toLowerCase().includes(filters.search.toLowerCase())) ||
        (customer.phone && customer.phone.toLowerCase().includes(filters.search.toLowerCase()));

      return matchesSearch;
    });
  }, [customersWithStats, filters]);

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

  const handleFiltersChange = (newFilters: Partial<CustomerFilterProps>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
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

  // Calculate stats
  const stats = useMemo(() => {
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

  const handleClearFilters = () => {
    setFilters({
      search: '',
    });
    setCurrentPage(1);
  };

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  const handleAddCustomer = () => {
    setIsAddCustomerOpen(true);
  };

  const handleCustomerCreated = () => {
    setIsAddCustomerOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900 dark:text-white">Customers</h1>
            <p className="text-gm-neutral-600 dark:text-gm-neutral-400">
              {loadingCustomers ? 'Loading...' : `${stats.totalCustomers} customers`}
            </p>
          </div>
          <Button onClick={handleAddCustomer} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Customer
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingCustomers ? '-' : stats.totalCustomers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New This Month</CardTitle>
              <UserPlus className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingCustomers ? '-' : stats.newThisMonth}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <CustomerFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
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
          onEdit={handleCustomerCreated}
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
      </div>
    </DashboardLayout>
  );
};

export default Customers;
