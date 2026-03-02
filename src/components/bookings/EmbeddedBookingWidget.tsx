import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateToISO } from '@/utils/dateUtils';

// Widget configuration interface
interface WidgetConfig {
  venue?: 'manor' | 'hippie' | 'both';
  defaultVenueArea?: 'upstairs' | 'downstairs' | 'full_venue';
  theme?: 'light' | 'dark';
  primaryColor?: string;
  showSpecialRequests?: boolean;
  apiEndpoint?: string;
  apiKey?: string;
}

// Booking form data interface
interface BookingFormData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  venue: 'manor' | 'hippie';
  venueArea: 'upstairs' | 'downstairs' | 'full_venue';
  bookingDate: string;
  startTime?: string;
  endTime?: string;
  guestCount: number;
  specialRequests?: string;
}

// API response interface
interface ApiResponse {
  success: boolean;
  bookingId?: string;
  message: string;
  errors?: Record<string, string>;
}

interface EmbeddedBookingWidgetProps {
  config?: WidgetConfig;
  onSuccess?: (bookingId: string) => void;
  onError?: (error: string) => void;
}

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00",
];

const venueOptions = [
  { value: "manor", label: "Manor" },
  { value: "hippie", label: "Hippie" },
];

const venueAreaOptions = [
  { value: "upstairs", label: "Upstairs" },
  { value: "downstairs", label: "Downstairs" },
  { value: "full_venue", label: "Full Venue" },
];

export const EmbeddedBookingWidget: React.FC<EmbeddedBookingWidgetProps> = ({
  config = {},
  onSuccess,
  onError
}) => {
  const [formData, setFormData] = useState<BookingFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    venue: config.defaultVenueArea ? 'manor' : 'manor',
    venueArea: config.defaultVenueArea || 'upstairs',
    bookingDate: '',
    startTime: '',
    endTime: '',
    guestCount: 1,
    specialRequests: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Default configuration
  const defaultConfig: WidgetConfig = {
    venue: 'both',
    defaultVenueArea: 'upstairs',
    theme: 'light',
    primaryColor: '#007bff',
    showSpecialRequests: true,
    apiEndpoint: 'https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/public-booking-api-v2',
    apiKey: 'demo-api-key-2024',
    ...config
  };

  // Filter venue options based on config
  const availableVenues = defaultConfig.venue === 'both' 
    ? venueOptions 
    : venueOptions.filter(v => v.value === defaultConfig.venue);

  const handleInputChange = (field: keyof BookingFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      errors.customerName = 'Customer name is required';
    }

    if (!formData.venue) {
      errors.venue = 'Please select a venue';
    }

    if (!formData.venueArea) {
      errors.venueArea = 'Please select a venue area';
    }

    if (!formData.bookingDate) {
      errors.bookingDate = 'Please select a booking date';
    } else {
      const bookingDate = new Date(formData.bookingDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (bookingDate < today) {
        errors.bookingDate = 'Booking date cannot be in the past';
      }
    }

    if (!formData.guestCount || formData.guestCount < 1) {
      errors.guestCount = 'Guest count must be at least 1';
    }

    if (!formData.customerEmail && !formData.customerPhone) {
      errors.customerEmail = 'Either email or phone number is required';
    }

    if (formData.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      errors.customerEmail = 'Please provide a valid email address';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateForm();
    if (!validation.isValid) {
      setErrorMessage('Please fix the errors above');
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(defaultConfig.apiEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': defaultConfig.apiKey!
        },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail || undefined,
          customerPhone: formData.customerPhone || undefined,
          venue: formData.venue,
          venueArea: formData.venueArea,
          bookingDate: formData.bookingDate,
          startTime: formData.startTime || undefined,
          endTime: formData.endTime || undefined,
          guestCount: formData.guestCount,
          specialRequests: formData.specialRequests || undefined,
        })
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        setSuccessMessage(result.message);
        onSuccess?.(result.bookingId!);
        
        // Reset form after successful submission
        setTimeout(() => {
          setFormData({
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            venue: defaultConfig.defaultVenueArea ? 'manor' : 'manor',
            venueArea: defaultConfig.defaultVenueArea || 'upstairs',
            bookingDate: '',
            startTime: '',
            endTime: '',
            guestCount: 1,
            specialRequests: '',
          });
          setSubmitStatus('idle');
          setSuccessMessage('');
        }, 3000);
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.message || 'Failed to create booking');
        onError?.(result.message);
      }
    } catch (error) {
      setSubmitStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set default date to tomorrow
  React.useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormData(prev => ({
      ...prev,
      bookingDate: tomorrow.toISOString().split('T')[0]
    }));
  }, []);

  return (
    <div className={`gm-booking-widget ${defaultConfig.theme === 'dark' ? 'dark' : ''}`}>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Book Your Venue</CardTitle>
        </CardHeader>
        <CardContent>
          {submitStatus === 'success' ? (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-green-700">Booking Successful!</h3>
              <p className="text-green-600">{successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Information */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name *</label>
                  <Input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                    placeholder="+44 123 456 7890"
                  />
                </div>
              </div>

              {/* Venue Selection */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Venue *</label>
                  <Select
                    value={formData.venue}
                    onValueChange={(value) => handleInputChange('venue', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVenues.map((venue) => (
                        <SelectItem key={venue.value} value={venue.value}>
                          {venue.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Venue Area *</label>
                  <Select
                    value={formData.venueArea}
                    onValueChange={(value) => handleInputChange('venueArea', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {venueAreaOptions.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date and Time */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Booking Date *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.bookingDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.bookingDate ? (
                          formatDate(new Date(formData.bookingDate))
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.bookingDate ? new Date(formData.bookingDate) : undefined}
                        onSelect={(date) => {
                          handleInputChange('bookingDate', date ? formatDateToISO(date) : '');
                        }}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time</label>
                    <Select
                      value={formData.startTime}
                      onValueChange={(value) => handleInputChange('startTime', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <Select
                      value={formData.endTime}
                      onValueChange={(value) => handleInputChange('endTime', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="End time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Guest Count */}
              <div>
                <label className="block text-sm font-medium mb-1">Number of Guests *</label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={formData.guestCount}
                  onChange={(e) => handleInputChange('guestCount', parseInt(e.target.value) || 1)}
                  placeholder="e.g. 8"
                  required
                />
              </div>

              {/* Special Requests */}
              {defaultConfig.showSpecialRequests && (
                <div>
                  <label className="block text-sm font-medium mb-1">Special Requests</label>
                  <Textarea
                    value={formData.specialRequests}
                    onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                    placeholder="Any special requirements..."
                    rows={3}
                  />
                </div>
              )}

              {/* Error Message */}
              {submitStatus === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-red-700 text-sm">{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                style={{ backgroundColor: defaultConfig.primaryColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Booking...
                  </>
                ) : (
                  'Create Booking'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 