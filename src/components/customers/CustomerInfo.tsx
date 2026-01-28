
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Phone, CreditCard, MessageSquare } from "lucide-react";
import { CustomerRow } from "@/services/customerService";
import { format } from "date-fns";

type CustomerWithStats = CustomerRow & {
  totalBookings: number;
  lastVisit: string | null;
  customerSince: string;
};

interface CustomerInfoProps {
  customer: CustomerWithStats;
}

export const CustomerInfo = ({ customer }: CustomerInfoProps) => {

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yy');
  };

  return (
    <div className="space-y-3 w-full">
      {/* Customer Details - Compact */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-gm-neutral-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gm-neutral-600">Email</p>
              <p className="text-xs font-medium truncate">{customer.email || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-gm-neutral-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gm-neutral-600">Phone</p>
              <p className="text-xs font-medium">{customer.phone || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats - Grid layout for space efficiency */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-gm-neutral-50 rounded">
              <div className="text-sm font-bold text-gm-primary-600">
                {customer.totalBookings}
              </div>
              <div className="text-xs text-gm-neutral-600">Bookings</div>
            </div>
            <div className="text-center p-2 bg-gm-neutral-50 rounded">
              <div className="text-sm font-bold text-green-600">
                -
              </div>
              <div className="text-xs text-gm-neutral-600">Spent</div>
            </div>
            <div className="text-center p-2 bg-gm-neutral-50 rounded">
              <div className="text-xs font-bold text-blue-600">
                {formatDate(customer.lastVisit)}
              </div>
              <div className="text-xs text-gm-neutral-600">Last Visit</div>
            </div>
            <div className="text-center p-2 bg-gm-neutral-50 rounded">
              <div className="text-xs font-bold text-purple-600">
                {formatDate(customer.customerSince)}
              </div>
              <div className="text-xs text-gm-neutral-600">Since</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes - If present */}
      {customer.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gm-neutral-600 leading-relaxed">
              {customer.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
