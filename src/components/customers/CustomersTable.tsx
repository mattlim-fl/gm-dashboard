
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import { CustomerRow } from "@/services/customerService";
import { CustomerProfilePanel } from "./CustomerProfilePanel";
import { format } from "date-fns";

type CustomerWithStats = CustomerRow & {
  totalBookings: number;
  lastVisit: string | null;
  customerSince: string;
};

interface CustomersTableProps {
  customers: CustomerWithStats[];
  sortField: keyof CustomerWithStats;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof CustomerWithStats) => void;
}

export const CustomersTable = ({ customers, sortField, sortDirection, onSort }: CustomersTableProps) => {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [initialView, setInitialView] = useState<'details' | 'booking' | 'edit'>('details');

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const getSortIcon = (field: keyof CustomerWithStats) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  const handleViewProfile = (customer: CustomerWithStats) => {
    setSelectedCustomer(customer);
    setInitialView('details');
    setIsPanelOpen(true);
  };

  const handleNewBooking = (customer: CustomerWithStats, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedCustomer(customer);
    setInitialView('booking');
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedCustomer(null);
    setInitialView('details');
  };

  const handleCustomerUpdated = (updatedCustomer: CustomerWithStats) => {
    setSelectedCustomer(updatedCustomer);
  };

  return (
    <>
      <div className="bg-white dark:bg-gm-neutral-900 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                onClick={() => onSort('email')}
              >
                <div className="flex items-center gap-1">
                  Email
                  {getSortIcon('email')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                onClick={() => onSort('phone')}
              >
                <div className="flex items-center gap-1">
                  Phone
                  {getSortIcon('phone')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800 text-center"
                onClick={() => onSort('totalBookings')}
              >
                <div className="flex items-center justify-center gap-1">
                  Total Bookings
                  {getSortIcon('totalBookings')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                onClick={() => onSort('lastVisit')}
              >
                <div className="flex items-center gap-1">
                  Last Visit
                  {getSortIcon('lastVisit')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                onClick={() => onSort('customerSince')}
              >
                <div className="flex items-center gap-1">
                  Customer Since
                  {getSortIcon('customerSince')}
                </div>
              </TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow 
                key={customer.id} 
                className="hover:bg-gm-neutral-25 dark:hover:bg-gm-neutral-800 cursor-pointer"
                onClick={() => handleViewProfile(customer)}
              >
                <TableCell className="font-medium">
                  {customer.name}
                </TableCell>
                <TableCell className="text-gm-neutral-600">
                  {customer.email || '-'}
                </TableCell>
                <TableCell className="text-gm-neutral-600">
                  {customer.phone || '-'}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gm-primary-100 text-gm-primary-800">
                    {customer.totalBookings}
                  </span>
                </TableCell>
                <TableCell className="text-gm-neutral-600">
                  {formatDate(customer.lastVisit)}
                </TableCell>
                <TableCell className="text-gm-neutral-600">
                  {formatDate(customer.customerSince)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleNewBooking(customer, e)}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Book
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CustomerProfilePanel
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        customer={selectedCustomer}
        onEdit={handleCustomerUpdated}
        initialView={initialView}
      />
    </>
  );
};
