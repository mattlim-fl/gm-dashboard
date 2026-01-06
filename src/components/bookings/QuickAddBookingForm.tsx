import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateBooking } from "@/hooks/useBookings";
import { CreateBookingData } from "@/services/bookingService";
import { formatDateToISO } from "@/utils/dateUtils";
import { quickBookingSchema, type QuickBookingFormValues } from "@/schemas/bookingSchemas";
import { VENUE_OPTIONS, BOOKING_TYPE_OPTIONS } from "@/constants/bookingConstants";
import { handleErrorSilently } from "@/utils/errorHandling";

interface QuickAddBookingFormProps {
  defaultCustomerName?: string;
  defaultCustomerEmail?: string;
  defaultCustomerPhone?: string;
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function QuickAddBookingForm({ 
  defaultCustomerName = "",
  defaultCustomerEmail = "",
  defaultCustomerPhone = "",
  defaultDate,
  onSuccess,
  onCancel
}: QuickAddBookingFormProps) {
  const createBookingMutation = useCreateBooking();
  
  const form = useForm<QuickBookingFormValues>({
    resolver: zodResolver(quickBookingSchema),
    defaultValues: {
      customerName: defaultCustomerName,
      customerEmail: defaultCustomerEmail,
      customerPhone: defaultCustomerPhone,
      bookingType: "vip_tickets",
      venue: "manor",
      quantity: "1",
      bookingDate: defaultDate || formatDateToISO(new Date()),
    },
  });

  // Update form when defaults change
  useEffect(() => {
    if (defaultCustomerName || defaultCustomerEmail || defaultCustomerPhone) {
      form.reset({
        customerName: defaultCustomerName,
        customerEmail: defaultCustomerEmail,
        customerPhone: defaultCustomerPhone,
        bookingType: form.getValues("bookingType"),
        venue: form.getValues("venue"),
        quantity: form.getValues("quantity"),
        bookingDate: defaultDate || formatDateToISO(new Date()),
      });
    }
  }, [defaultCustomerName, defaultCustomerEmail, defaultCustomerPhone, defaultDate, form]);

  const bookingType = form.watch("bookingType");

  const onSubmit = async (data: QuickBookingFormValues) => {
    const bookingDate = data.bookingDate || defaultDate || formatDateToISO(new Date());

    const bookingData: CreateBookingData = {
      customerName: data.customerName,
      customerEmail: data.customerEmail || undefined,
      customerPhone: data.customerPhone || undefined,
      bookingType: data.bookingType,
      venue: data.venue,
      bookingDate: bookingDate,
      ticketQuantity: data.bookingType === "vip_tickets" ? parseInt(data.quantity) : undefined,
      guestCount: (data.bookingType === "karaoke_booking" || data.bookingType === "venue_hire") ? parseInt(data.quantity) : undefined,
      startTime: (data.bookingType === "karaoke_booking" || data.bookingType === "venue_hire") ? "20:00" : undefined,
      endTime: (data.bookingType === "karaoke_booking" || data.bookingType === "venue_hire") ? "21:00" : undefined,
      karaokeBoothId: data.bookingType === "karaoke_booking" ? undefined : undefined, // Will need booth selection for karaoke
      costPerTicket: data.bookingType === "vip_tickets" ? 0 : undefined,
      totalAmount: 0,
      staffNotes: "Created from Customer Details",
    };

    try {
      await createBookingMutation.mutateAsync(bookingData);
      form.reset();
      onSuccess?.();
    } catch (error) {
      handleErrorSilently(error, {
        operation: "Quick add booking",
        component: "QuickAddBookingForm",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Customer Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customerEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="04..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select venue" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VENUE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bookingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BOOKING_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {bookingType === 'vip_tickets' ? 'Tickets' : 
                 bookingType === 'karaoke_booking' ? 'Guests' : 
                 'Guests'}
              </FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createBookingMutation.isPending}>
            {createBookingMutation.isPending ? "Creating..." : "Create Booking"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
















