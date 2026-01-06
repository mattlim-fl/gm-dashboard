import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Edit, Mic } from "lucide-react";
import { BookingRow } from "@/services/bookingService";
import { useUpdateBooking } from "@/hooks/useBookings";
import { useKaraokeBooth } from "@/hooks/useKaraoke";
import { supabase } from "@/integrations/supabase/client";
import { updateBookingSchema, type UpdateBookingFormValues } from "@/schemas/bookingSchemas";
import { formatVenue, formatBookingType, getStatusColor } from "@/utils/formattingUtils";
import { BookingDetailsView } from "./BookingDetailsView";
import { BookingDetailsEditForm } from "./BookingDetailsEditForm";
import { toVenue, toBookingType, toVenueArea, toBookingStatus } from "@/utils/typeGuards";
import { handleErrorSilently } from "@/utils/errorHandling";


interface BookingDetailsSidebarProps {
  booking: BookingRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BookingDetailsSidebar = ({ booking, isOpen, onClose }: BookingDetailsSidebarProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const updateBookingMutation = useUpdateBooking();
  
  // Fetch karaoke booth details if this is a karaoke booking
  const { data: karaokeBoothData } = useKaraokeBooth(
    booking?.karaoke_booth_id || ""
  );

  // Helper function to determine if booking is a karaoke booking
  const isKaraokeBooking = (bookingData: BookingRow) => {
    return bookingData.booking_type === 'karaoke_booking' || 
           (bookingData.booking_type === 'venue_hire' && bookingData.venue_area === 'karaoke');
  };

  // Helper function to get display booking type
  const getDisplayBookingType = (bookingData: BookingRow) => {
    if (bookingData.booking_type === 'karaoke_booking') {
      return 'karaoke_booking';
    }
    if (bookingData.booking_type === 'venue_hire' && bookingData.venue_area === 'karaoke') {
      return 'karaoke_booking'; // Fallback for old records
    }
    return bookingData.booking_type;
  };

  const form = useForm<UpdateBookingFormValues>({
    resolver: zodResolver(updateBookingSchema),
    defaultValues: {
      customerName: booking?.customer_name || "",
      customerEmail: booking?.customer_email || "",
      customerPhone: booking?.customer_phone || "",
      bookingType: booking ? toBookingType(getDisplayBookingType(booking)) : "venue_hire",
      venue: toVenue(booking?.venue),
      venueArea: toVenueArea(booking?.venue_area),
      bookingDate: booking?.booking_date || "",
      startTime: booking?.start_time || "",
      endTime: booking?.end_time || "",
      guestCount: booking?.guest_count?.toString() || "",
      ticketQuantity: booking?.ticket_quantity?.toString() || "",
      specialRequests: booking?.special_requests || "",
      totalAmount: booking?.total_amount?.toString() || "",
      staffNotes: booking?.staff_notes || "",
      status: toBookingStatus(booking?.status),
    },
  });

  // Update form when booking changes
  useEffect(() => {
    if (booking) {
      form.reset({
        customerName: booking.customer_name,
        customerEmail: booking.customer_email || "",
        customerPhone: booking.customer_phone || "",
        bookingType: toBookingType(getDisplayBookingType(booking)),
        venue: toVenue(booking.venue),
        venueArea: toVenueArea(booking.venue_area),
        bookingDate: booking.booking_date,
        startTime: booking.start_time || "",
        endTime: booking.end_time || "",
        guestCount: booking.guest_count?.toString() || "",
        ticketQuantity: booking.ticket_quantity?.toString() || "",
        specialRequests: booking.special_requests || "",
        totalAmount: booking.total_amount?.toString() || "",
        staffNotes: booking.staff_notes || "",
        status: toBookingStatus(booking.status),
      });
    }
  }, [booking, form]);

  const bookingType = form.watch("bookingType");

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (booking) {
      form.reset({
        customerName: booking.customer_name,
        customerEmail: booking.customer_email || "",
        customerPhone: booking.customer_phone || "",
        bookingType: toBookingType(getDisplayBookingType(booking)),
        venue: toVenue(booking.venue),
        venueArea: toVenueArea(booking.venue_area),
        bookingDate: booking.booking_date,
        startTime: booking.start_time || "",
        endTime: booking.end_time || "",
        guestCount: booking.guest_count?.toString() || "",
        ticketQuantity: booking.ticket_quantity?.toString() || "",
        specialRequests: booking.special_requests || "",
        totalAmount: booking.total_amount?.toString() || "",
        staffNotes: booking.staff_notes || "",
        status: toBookingStatus(booking.status),
      });
    }
  };

  const onSubmit = async (data: UpdateBookingFormValues) => {
    if (!booking) return;

    try {
      // Handle booking type conversion based on what we're editing
      let actualBookingType = data.bookingType;
      let actualVenueArea: 'upstairs' | 'downstairs' | 'full_venue' | 'karaoke' | undefined = data.venueArea;
      
      // For new karaoke bookings, use proper karaoke_booking type
      if (data.bookingType === 'karaoke_booking') {
        actualBookingType = 'karaoke_booking';
        actualVenueArea = undefined; // Not needed for karaoke bookings
      }

      await updateBookingMutation.mutateAsync({
        id: booking.id,
        data: {
          customerName: data.customerName,
          customerEmail: data.customerEmail || undefined,
          customerPhone: data.customerPhone || undefined,
          bookingType: actualBookingType as 'venue_hire' | 'vip_tickets' | 'karaoke_booking',
          venue: data.venue,
          venueArea: actualVenueArea,
          bookingDate: data.bookingDate,
          startTime: data.startTime || undefined,
          endTime: data.endTime || undefined,
          guestCount: data.guestCount ? parseInt(data.guestCount) : undefined,
          ticketQuantity: data.ticketQuantity ? parseInt(data.ticketQuantity) : undefined,
          specialRequests: data.specialRequests || undefined,
          totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : undefined,
          staffNotes: data.staffNotes || undefined,
        },
      });
      setIsEditing(false);
    } catch (error) {
      handleErrorSilently(error, {
        operation: "Update booking",
        component: "BookingDetailsSidebar",
      });
    }
  };



  if (!booking) return null;

  const karaokeBooking = isKaraokeBooking(booking);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[600px] max-w-none overflow-y-auto" hideCloseButton>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
            <SheetHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-xl font-bold">Booking Details</SheetTitle>
                  <SheetDescription>
                    {formatBookingType(booking.booking_type, booking.venue_area)} • {formatVenue(booking.venue)}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
              
              {/* Status Section */}
              <div>
                {isEditing ? (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-6 mt-6">
              {isEditing ? (
                <BookingDetailsEditForm control={form.control} bookingType={bookingType} />
              ) : (
                <BookingDetailsView booking={booking} karaokeBoothData={karaokeBoothData} />
              )}

              {/* Karaoke guest list (read-only for staff) */}
              {karaokeBooking && (
                <KaraokeGuestListPanel bookingId={booking.id} />
              )}
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateBookingMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateBookingMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateBookingMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}; 

interface KaraokeGuestListPanelProps {
  bookingId: string;
}

const KaraokeGuestListPanel = ({ bookingId }: KaraokeGuestListPanelProps) => {
  const [guestNames, setGuestNames] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch guest names directly from the table
        const { data: guestRows, error: guestsError } = await supabase
          .from("booking_guests")
          .select("guest_name")
          .eq("booking_id", bookingId)
          .order("created_at");

        if (guestsError) throw guestsError;

        const guests = (guestRows || []).map((r: { guest_name: string }) => r.guest_name);
        if (!cancelled) {
          setGuestNames(guests);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg || "Failed to load guest list");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mic className="h-4 w-4 text-orange-500" />
          Karaoke Guest List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading guest list…</p>}
        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && (
          <>
            {guestNames && guestNames.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {guestNames.map((name, idx) => (
                  <li key={`${bookingId}-guest-${idx}`} className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No guests have been added yet. The customer can curate their guest list from their confirmation email link.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
