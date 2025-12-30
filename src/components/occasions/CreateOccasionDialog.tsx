import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { occasionService, CreateOccasionInput } from '@/services/occasionService';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { formatDate, formatDateToISO } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

interface CreateOccasionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateOccasionDialog({ open, onOpenChange, onSuccess }: CreateOccasionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [venue, setVenue] = useState<'manor' | 'hippie'>('manor');
  const [name, setName] = useState('');
  const [occasionDate, setOccasionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [capacity, setCapacity] = useState('50');
  const [ticketPrice, setTicketPrice] = useState('10.00');
  const [organiserName, setOrganiserName] = useState('');
  const [organiserEmail, setOrganiserEmail] = useState('');
  const [organiserPhone, setOrganiserPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const resetForm = () => {
    setVenue('manor');
    setName('');
    setOccasionDate(format(new Date(), 'yyyy-MM-dd'));
    setCapacity('50');
    setTicketPrice('10.00');
    setOrganiserName('');
    setOrganiserEmail('');
    setOrganiserPhone('');
    setNotes('');
    setSendEmail(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Occasion name is required');
      return;
    }

    if (!occasionDate) {
      setError('Date is required');
      return;
    }

    const capacityNum = parseInt(capacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setError('Capacity must be a positive number');
      return;
    }

    const priceCents = Math.round(parseFloat(ticketPrice) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setError('Invalid ticket price');
      return;
    }

    if (sendEmail && !organiserEmail) {
      setError('Organiser email is required to send confirmation');
      return;
    }

    setLoading(true);

    try {
      const input: CreateOccasionInput = {
        venue,
        name: name.trim(),
        occasion_date: occasionDate,
        capacity: capacityNum,
        ticket_price_cents: priceCents,
        organiser_name: organiserName.trim() || undefined,
        organiser_email: organiserEmail.trim() || undefined,
        organiser_phone: organiserPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        send_email: sendEmail,
      };

      await occasionService.createOccasion(input);
      
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create occasion';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Occasion</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Basic Details */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-gray-700">Basic Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Select value={venue} onValueChange={(v) => setVenue(v as 'manor' | 'hippie')}>
                  <SelectTrigger id="venue">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manor">Manor</SelectItem>
                    <SelectItem value="hippie">Hippie Club</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="occasion-date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="occasion-date"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !occasionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {occasionDate ? (
                        formatDate(new Date(occasionDate))
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={occasionDate ? new Date(occasionDate) : undefined}
                      onSelect={(date) => {
                        setOccasionDate(date ? formatDateToISO(date) : '');
                      }}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Occasion Name</Label>
              <Input
                id="name"
                placeholder="e.g., Sarah's Birthday, NYE 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Total Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="50"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">Total number of guests allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-price">Ticket Price (AUD)</Label>
                <Input
                  id="ticket-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="10.00"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">Price per ticket</p>
              </div>
            </div>
          </div>

          {/* Organiser Details */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm text-gray-700">Organiser Details</h3>
            
            <div className="space-y-2">
              <Label htmlFor="organiser-name">Organiser Name</Label>
              <Input
                id="organiser-name"
                placeholder="John Doe"
                value={organiserName}
                onChange={(e) => setOrganiserName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organiser-email">Email</Label>
                <Input
                  id="organiser-email"
                  type="email"
                  placeholder="john@example.com"
                  value={organiserEmail}
                  onChange={(e) => setOrganiserEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organiser-phone">Phone</Label>
                <Input
                  id="organiser-phone"
                  type="tel"
                  placeholder="+61 ..."
                  value={organiserPhone}
                  onChange={(e) => setOrganiserPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked as boolean)}
              />
              <Label htmlFor="send-email" className="text-sm font-normal cursor-pointer">
                Send confirmation email to organiser
              </Label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="notes">Internal Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requirements or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Occasion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

