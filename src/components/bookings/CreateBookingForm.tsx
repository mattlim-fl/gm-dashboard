import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Save, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateToISO } from "@/utils/dateUtils";
import { useCreateBooking } from "@/hooks/useBookings";
import { useKaraokeBooths, useCreateKaraokeHold, useReleaseKaraokeHold, useFinalizeKaraokeHold, useKaraokeAvailability } from "@/hooks/useKaraoke";
import { karaokeService } from "@/services/karaokeService";
import { useToast } from "@/hooks/use-toast";
import { createBookingSchema, type CreateBookingFormValues } from "@/schemas/bookingSchemas";
import { VENUE_OPTIONS, BOOKING_TYPE_OPTIONS, VENUE_AREA_OPTIONS, TIME_SLOTS } from "@/constants/bookingConstants";
import { handleErrorSilently } from "@/utils/errorHandling";
import { CustomerInfoSection, KaraokeAvailabilityGrid, AdditionalInfoSection } from "./form-sections";

interface AvailableBooth {
  id: string;
  name: string;
  capacity: number;
}

interface BoothsForSlotResponse {
  availableBooths?: AvailableBooth[];
}

interface HoldResponse {
  hold?: {
    id: string;
    expires_at: string;
  };
}


interface CreateBookingFormProps {
  onSuccess?: () => void;
  isSidePanel?: boolean;
}

export const CreateBookingForm = ({ onSuccess, isSidePanel = false }: CreateBookingFormProps = {}) => {
  const navigate = useNavigate();
  const createBookingMutation = useCreateBooking();
  const { data: karaokeBooths } = useKaraokeBooths();
  const createHold = useCreateKaraokeHold();
  const releaseHold = useReleaseKaraokeHold();
  const finalizeHold = useFinalizeKaraokeHold();
  const { toast } = useToast();
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);

  const form = useForm<CreateBookingFormValues>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      bookingType: undefined,
      venue: undefined,
      venueArea: undefined,
      karaokeBoothId: undefined,
      bookingDate: "",
      startTime: "",
      endTime: "",
      guestCount: "1",
      ticketQuantity: "",
      specialRequests: "",
      totalAmount: "",
      costPerTicket: "",
      staffNotes: "",
    },
  });

  const bookingType = form.watch("bookingType");
  const venue = form.watch("venue");
  const ticketQuantity = form.watch("ticketQuantity");
  const costPerTicket = form.watch("costPerTicket");
  const karaokeBoothId = form.watch("karaokeBoothId");
  const bookingDate = form.watch("bookingDate");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const guestCountVal = form.watch("guestCount");
  const guestCountNum = guestCountVal ? parseInt(guestCountVal) : 1;

  const [availableBoothsForSlot, setAvailableBoothsForSlot] = useState<any[] | null>(null);

  // Filter karaoke booths based on selected venue
  const availableKaraokeBooths = karaokeBooths?.filter(booth => 
    (!venue || booth.venue === venue) && booth.is_available
  ) || [];

  // Get selected booth for dynamic time slots
  const selectedBooth = availableKaraokeBooths.find(booth => booth.id === karaokeBoothId);

  // Generate time slots based on booth operating hours
  const generateTimeSlots = (startTime: string, endTime: string) => {
    const slots = [];
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    
    for (let time = new Date(start); time <= end; time.setMinutes(time.getMinutes() + 30)) {
      const timeStr = time.toTimeString().slice(0, 5);
      slots.push(timeStr);
    }
    
    return slots;
  };

  // Available time slots based on selected booth or default
  const availableTimeSlots = selectedBooth && selectedBooth.operating_hours_start && selectedBooth.operating_hours_end
    ? generateTimeSlots(selectedBooth.operating_hours_start, selectedBooth.operating_hours_end)
    : TIME_SLOTS;

  // Venue-level availability for karaoke (choose time first, then booth)
  const { data: venueAvailability } = useKaraokeAvailability({
    venue: bookingType === 'karaoke_booking' ? venue : undefined,
    bookingDate: bookingType === 'karaoke_booking' ? bookingDate : undefined,
    minCapacity: bookingType === 'karaoke_booking' ? guestCountNum : undefined,
    granularityMinutes: 60,
  });

  // Calendar event handlers
  const handleDateSelect = (date: string) => {
    form.setValue("bookingDate", date);
  };

  const handleTimeSlotSelect = (startTime: string, endTime: string) => {
    // Toggle selection: if the same slot is clicked again, deselect and release hold
    const currentStart = form.getValues("startTime");
    const currentEnd = form.getValues("endTime");
    if (currentStart === startTime && currentEnd === endTime) {
      // Deselect
      form.setValue("startTime", "");
      form.setValue("endTime", "");
      if (activeHoldId) {
        const sessionIdPrev = localStorage.getItem('karaoke_session_id') || '';
        if (sessionIdPrev) {
          releaseHold.mutate({ holdId: activeHoldId, sessionId: sessionIdPrev });
        }
        setActiveHoldId(null);
        setHoldExpiresAt(null);
      }
      return;
    }

    form.setValue("startTime", startTime);
    form.setValue("endTime", endTime);
    const type = form.getValues("bookingType");
    const venueVal = form.getValues("venue");
    const dateVal = form.getValues("bookingDate");
    if (type === 'karaoke_booking' && venueVal && dateVal) {
      // Release any existing hold when changing slot
      if (activeHoldId) {
        const sessionIdPrev = localStorage.getItem('karaoke_session_id') || '';
        if (sessionIdPrev) {
          releaseHold.mutate({ holdId: activeHoldId, sessionId: sessionIdPrev });
        }
        setActiveHoldId(null);
        setHoldExpiresAt(null);
      }
      // Fetch booths available for this slot
      karaokeService.getAvailability({
        action: 'boothsForSlot',
        venue: venueVal,
        bookingDate: dateVal,
        startTime,
        endTime,
        minCapacity: guestCountNum,
      }).then((res: BoothsForSlotResponse) => {
        const list = res?.availableBooths || [];
        setAvailableBoothsForSlot(list);
        // If current booth not in list, clear selection
        if (form.getValues('karaokeBoothId') && !list.find((b) => b.id === form.getValues('karaokeBoothId'))) {
          form.setValue('karaokeBoothId', undefined as unknown as string);
        }
      }).catch(() => {
        setAvailableBoothsForSlot([]);
      });
    }
  };

  // Calculate total amount for VIP tickets
  const calculateTotalAmount = () => {
    if (bookingType === "vip_tickets" && ticketQuantity && costPerTicket) {
      const quantity = parseInt(ticketQuantity);
      const cost = parseFloat(costPerTicket);
      if (!isNaN(quantity) && !isNaN(cost)) {
        return (quantity * cost).toFixed(2);
      }
    }
    return "";
  };

  const onSubmit = async (data: CreateBookingFormValues) => {
    try {
      if (data.bookingType === 'karaoke_booking') {
        if (!activeHoldId) {
          toast({ title: 'Hold required', description: 'Select a time slot to create a hold before confirming.', variant: 'destructive' });
          return;
        }
        // Finalize from hold if available, else fall back to direct booking creation
        const sessionId = localStorage.getItem('karaoke_session_id') || '';
        await finalizeHold.mutateAsync({
          holdId: activeHoldId,
          sessionId,
          customerName: data.customerName,
          customerEmail: data.customerEmail || undefined,
          customerPhone: data.customerPhone || undefined,
          guestCount: data.guestCount ? parseInt(data.guestCount) : undefined,
        });
      } else {
        await createBookingMutation.mutateAsync({
          customerName: data.customerName,
          customerEmail: data.customerEmail || undefined,
          customerPhone: data.customerPhone || undefined,
          bookingType: data.bookingType,
          venue: data.venue,
          venueArea: data.venueArea,
          karaokeBoothId: data.karaokeBoothId || undefined,
          bookingDate: data.bookingDate,
          startTime: data.startTime || undefined,
          endTime: data.endTime || undefined,
          durationHours: undefined,
          guestCount: data.guestCount ? parseInt(data.guestCount) : undefined,
          ticketQuantity: data.ticketQuantity ? parseInt(data.ticketQuantity) : undefined,
          specialRequests: data.specialRequests || undefined,
          totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : undefined,
          costPerTicket: data.costPerTicket ? parseFloat(data.costPerTicket) : undefined,
          staffNotes: data.staffNotes || undefined,
        });
      }
      
      // Call onSuccess callback if provided (for side panel), otherwise navigate
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/bookings');
      }
    } catch (error) {
      handleErrorSilently(error, {
        operation: "Create booking",
        component: "CreateBookingForm",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className={`grid gap-6 ${isSidePanel ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {/* Customer Information */}
          <CustomerInfoSection form={form} />

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <FormLabel>Booking Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
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

              {/* Show venue area only for venue hire */}
              {bookingType === "venue_hire" && (
                <FormField
                  control={form.control}
                  name="venueArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue Area *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select area" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VENUE_AREA_OPTIONS.map((option) => (
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
              )}

              {/* Show booking date early in the flow for all types */}
              {bookingType && (
                <FormField
                  control={form.control}
                  name="bookingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                formatDate(new Date(field.value))
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              field.onChange(date ? formatDateToISO(date) : "");
                            }}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Booth selection moved below time slots; rendered after time is chosen */}

              

              {/* Show venue-level availability grid for karaoke bookings */}
              {bookingType === "karaoke_booking" && venue && bookingDate && (
                <KaraokeAvailabilityGrid
                  slots={venueAvailability?.slots || []}
                  selectedStartTime={startTime}
                  selectedEndTime={endTime}
                  onSlotSelect={handleTimeSlotSelect}
                  activeHoldId={activeHoldId}
                  holdExpiresAt={holdExpiresAt}
                />
              )}

              {/* Karaoke booth field placeholder when time not selected */}
              {bookingType === "karaoke_booking" && bookingDate && !(startTime && endTime) && (
                <div className="col-span-2 text-sm text-gray-500">Select a time slot to see available booths.</div>
              )}

              {/* Karaoke booth dropdown below time slots, after time selected */}
              {bookingType === "karaoke_booking" && bookingDate && startTime && endTime && (
                <FormField
                  control={form.control}
                  name="karaokeBoothId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Karaoke Booth *</FormLabel>
                      <Select onValueChange={(v) => {
                        // On booth selection, create a hold for the selected booth and times
                        field.onChange(v);
                        const timeStart = form.getValues('startTime');
                        const timeEnd = form.getValues('endTime');
                        const dateVal = form.getValues('bookingDate');
                        const venueVal = form.getValues('venue');
                        if (timeStart && timeEnd && dateVal && venueVal) {
                          // Release previous hold if exists
                          if (activeHoldId) {
                            const sessionIdPrev = localStorage.getItem('karaoke_session_id') || '';
                            if (sessionIdPrev) {
                              releaseHold.mutate({ holdId: activeHoldId, sessionId: sessionIdPrev });
                            }
                            setActiveHoldId(null);
                            setHoldExpiresAt(null);
                          }
                          const sessionId = localStorage.getItem('karaoke_session_id') || crypto.randomUUID();
                          localStorage.setItem('karaoke_session_id', sessionId);
                          createHold.mutate({
                            boothId: v,
                            venue: venueVal,
                            bookingDate: dateVal,
                            startTime: timeStart,
                            endTime: timeEnd,
                            sessionId,
                            customerEmail: form.getValues('customerEmail') || undefined,
                            ttlMinutes: 10,
                          }, {
                            onSuccess: (res: HoldResponse) => {
                              setActiveHoldId(res.hold?.id || null);
                              setHoldExpiresAt(res.hold?.expires_at || null);
                            }
                          });
                        }
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select karaoke booth" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(availableBoothsForSlot ?? availableKaraokeBooths).map((booth) => (
                            <SelectItem key={booth.id} value={booth.id}>
                              {booth.name} - cap {booth.capacity} (${booth.hourly_rate}/hour)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select a karaoke booth that supports your group size
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Show time fields only for venue hire - just start and end time */}
              {bookingType === "venue_hire" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Start time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTimeSlots.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
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
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="End time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTimeSlots.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* For karaoke bookings, we use calendar time slots only; hide manual time inputs */}

              {/* Show guest/ticket fields only after booking type is selected */}
              {bookingType && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Show guest count only for venue hire */}
                  {bookingType === "venue_hire" && (
                    <FormField
                      control={form.control}
                      name="guestCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Guests *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" max="500" placeholder="e.g. 8" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Show ticket quantity for VIP tickets */}
                  {bookingType === "vip_tickets" && (
                    <FormField
                      control={form.control}
                      name="ticketQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ticket Quantity *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" max="100" placeholder="e.g. 4" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Show cost per ticket for VIP tickets */}
                  {bookingType === "vip_tickets" && (
                    <FormField
                      control={form.control}
                      name="costPerTicket"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost per Ticket ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" placeholder="e.g. 30.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Show total amount only for venue hire (hide for karaoke) */}
                  {bookingType === "venue_hire" && (
                    <FormField
                      control={form.control}
                      name="totalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" placeholder="e.g. 120.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Show guest count for karaoke bookings */}
                  {bookingType === "karaoke_booking" && (
                    <FormField
                      control={form.control}
                      name="guestCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Guests *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" max="20" placeholder="e.g. 6" {...field} />
                          </FormControl>
                          <FormDescription>
                            Number of people for your karaoke session
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              {/* Show calculated total for VIP tickets */}
              {bookingType === "vip_tickets" && ticketQuantity && costPerTicket && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-600">Total Cost</div>
                  <div className="text-lg font-semibold text-gray-900">
                    ${calculateTotalAmount()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Information - only show for non-VIP bookings */}
        {bookingType && bookingType !== "vip_tickets" && (
          <AdditionalInfoSection form={form} />
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/bookings')}
            disabled={createBookingMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createBookingMutation.isPending}>
            {createBookingMutation.isPending ? (
              <>Creating...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Booking
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
