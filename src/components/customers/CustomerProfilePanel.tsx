import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Plus, Edit, Archive } from 'lucide-react';
import { CustomerInfo } from './CustomerInfo';
import { BookingHistory } from './BookingHistory';
import { CustomerActions } from './CustomerActions';
import { CustomerEditForm } from './CustomerEditForm';
import { CustomerRow } from '@/services/customerService';
import { useBookings } from '@/hooks/useBookings';
import { useArchiveCustomer, useCreateCustomer } from '@/hooks/useCustomers';
import { QuickAddBookingForm } from '@/components/bookings/QuickAddBookingForm';

type CustomerWithStats = CustomerRow & {
  totalBookings: number;
  lastVisit: string | null;
  customerSince: string;
};

interface CustomerProfilePanelProps {
  customer: CustomerWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (customer: CustomerWithStats) => void;
  initialView?: 'details' | 'booking' | 'edit';
}

export const CustomerProfilePanel = ({
  customer,
  isOpen,
  onClose,
  onEdit,
  initialView = 'details'
}: CustomerProfilePanelProps) => {
  const [isEditing, setIsEditing] = useState(initialView === 'edit' || customer === null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(initialView === 'booking');
  const archiveCustomer = useArchiveCustomer();
  const createCustomer = useCreateCustomer();

  // Reset view when panel opens/closes or customer changes
  useEffect(() => {
    if (isOpen) {
      setIsEditing(initialView === 'edit' || customer === null);
      setIsCreatingBooking(initialView === 'booking' && customer !== null);
    } else {
      // Reset when closing
      setIsEditing(false);
      setIsCreatingBooking(false);
    }
  }, [isOpen, initialView, customer]);

  // Fetch bookings for this customer
  const { data: allBookings = [] } = useBookings({});
  
  const customerBookings = useMemo(() => {
    if (!customer) return [];
    return allBookings.filter(booking => 
      (customer.email && booking.customer_email && customer.email.toLowerCase() === booking.customer_email.toLowerCase()) ||
      (customer.phone && booking.customer_phone && customer.phone === booking.customer_phone)
    );
  }, [customer, allBookings]);

  const customerName = customer?.name || 'New Customer';
  const customerSince = customer?.customerSince || customer?.created_at || new Date().toISOString();

  const handleEdit = async (updatedCustomer: CustomerRow) => {
    if (!customer) {
      // Creating a new customer
      try {
        const newCustomer = await createCustomer.mutateAsync({
          name: updatedCustomer.name,
          email: updatedCustomer.email || null,
          phone: updatedCustomer.phone || null,
          notes: updatedCustomer.notes || null,
        });
        // Convert to CustomerWithStats
        const newCustomerWithStats: CustomerWithStats = {
          ...newCustomer,
          totalBookings: 0,
          lastVisit: null,
          customerSince: newCustomer.created_at || new Date().toISOString(),
        };
        onEdit(newCustomerWithStats);
        setIsEditing(false);
        onClose();
      } catch (_error) {
        // Silent fail for customer creation
      }
    } else {
      // Updating existing customer
      const updated: CustomerWithStats = {
        ...updatedCustomer,
        totalBookings: customer.totalBookings,
        lastVisit: customer.lastVisit,
        customerSince: customer.customerSince,
      };
      onEdit(updated);
      setIsEditing(false);
    }
  };

  const handleCreateBooking = () => {
    setIsCreatingBooking(true);
    setIsEditing(false);
  };

  const handleBookingSuccess = () => {
    setIsCreatingBooking(false);
    // Refresh bookings list
    // The query will automatically refresh due to mutation invalidation
  };

  const handleSendEmail = () => {
    // Send email to customer (not implemented)
  };

  const handleArchiveCustomer = async () => {
    if (!customer) return;
    
    if (window.confirm(`Are you sure you want to archive ${customerName}? Their bookings will remain intact, but they will be hidden from the customer list.`)) {
      try {
        await archiveCustomer.mutateAsync(customer.id);
        onClose(); // Close the panel after archiving
      } catch (_error) {
        // Silent fail for customer archiving
      }
    }
  };


  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              {isCreatingBooking || isEditing ? (
                <BreadcrumbLink 
                  onClick={() => {
                    setIsCreatingBooking(false);
                    setIsEditing(false);
                  }}
                  className="cursor-pointer hover:text-foreground"
                >
                  Customer Details
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>Customer Details</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {isCreatingBooking && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>New Booking</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {isEditing && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Edit</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <SheetHeader>
          <SheetTitle className="text-xl font-bold">{customerName}</SheetTitle>
          {customer && (
            <SheetDescription>
              Customer since {new Date(customerSince).toLocaleDateString()}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* New Booking and Edit Buttons at Top */}
        {customer && !isCreatingBooking && (
          <div className="mt-4 flex items-center gap-2">
            <Button 
              onClick={handleCreateBooking}
              className="flex-1"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setIsEditing(true);
                setIsCreatingBooking(false);
              }}
              size="icon"
              className="h-9 w-9"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {isCreatingBooking ? (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Create New Booking</h3>
                <p className="text-sm text-muted-foreground">
                  Create a new booking for {customerName}
                </p>
              </div>
              <QuickAddBookingForm
                defaultCustomerName={customer.name}
                defaultCustomerEmail={customer.email || ""}
                defaultCustomerPhone={customer.phone || ""}
                onSuccess={handleBookingSuccess}
                onCancel={() => setIsCreatingBooking(false)}
              />
            </div>
          ) : isEditing ? (
            <CustomerEditForm
              customer={customer || {
                id: '',
                name: '',
                email: null,
                phone: null,
                notes: null,
                is_archived: false,
                archived_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }}
              onSave={handleEdit}
              onCancel={() => {
                setIsEditing(false);
                if (!customer) {
                  onClose();
                }
              }}
            />
          ) : customer ? (
            <>
              <CustomerInfo customer={customer} />
              <BookingHistory 
                bookings={customerBookings} 
                onViewAll={() => {}}
              />
            </>
          ) : null}
        </div>

        {/* Archive Button - Standalone */}
        {customer && !isEditing && !isCreatingBooking && (
          <div className="mt-8 pt-6 border-t">
            <Button 
              variant="ghost" 
              onClick={handleArchiveCustomer}
              className="w-full justify-start text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
