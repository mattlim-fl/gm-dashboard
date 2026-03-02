import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { CreateBookingFormValues } from '@/schemas/bookingSchemas';

interface AdditionalInfoSectionProps {
  form: UseFormReturn<CreateBookingFormValues>;
}

export function AdditionalInfoSection({ form }: AdditionalInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="specialRequests"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Special Requests / Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any special requirements, dietary restrictions, or additional notes..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>Customer facing notes and special requirements</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="staffNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Staff Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Internal staff notes, reminders, or instructions..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>Internal notes visible only to staff</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
