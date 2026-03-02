import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Eye, Mail } from 'lucide-react';
import { getGuestListUrl } from '@/config/urls';
import { generateTicketConfirmationHtml } from './templates/ticketConfirmationTemplate';
import type { Venue } from '@/types/venue';

export function TicketEmailTester() {
  const [venue, setVenue] = useState<'manor' | 'hippie'>('manor');
  const [testEmail, setTestEmail] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState('2');
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const { toast } = useToast();

  async function sendTestEmail() {
    if (!testEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSending(true);
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          template: 'priority-ticket-confirmation',
          to: testEmail,
          data: {
            customerName: 'Test User',
            customerEmail: testEmail,
            referenceCode: 'T-TEST01',
            venue: venue,
            occasionName: 'Saturday Night Special',
            bookingDate: 'Saturday 1 February 2026',
            ticketQuantity: ticketQuantity,
            guestListUrl: getGuestListUrl(venue as Venue, 'test123'),
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Test email sent to ${testEmail}`,
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test email. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }

  function generatePreview() {
    setPreviewing(true);
    try {
      const html = generateTicketConfirmationHtml({
        venue,
        customerName: 'Test User',
        bookingDate: 'Saturday 1 February 2026',
        occasionName: 'Saturday Night Special',
        ticketQuantity,
        referenceCode: 'T-TEST01',
        customerEmail: 'test@example.com',
      });
      setPreviewHtml(html);
      setShowPreview(true);
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <>
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Confirmation Email Preview</DialogTitle>
            <DialogDescription>
              Preview of the {venue === 'manor' ? 'Manor' : 'Hippie Club'} ticket confirmation email
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[600px] bg-white"
              title="Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-gm-primary-500" />
            <div>
              <CardTitle>Ticket Email Testing</CardTitle>
              <CardDescription>Send test ticket confirmation emails to preview the template</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Venue</Label>
              <Select value={venue} onValueChange={(val) => setVenue(val as 'manor' | 'hippie')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manor">Manor</SelectItem>
                  <SelectItem value="hippie">Hippie Club</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ticket Quantity</Label>
              <Select value={ticketQuantity} onValueChange={setTicketQuantity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 ticket</SelectItem>
                  <SelectItem value="2">2 tickets</SelectItem>
                  <SelectItem value="4">4 tickets</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Test Email Address</Label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendTestEmail();
                }
              }}
            />
          </div>

          <div className="flex space-x-2 pt-2">
            <Button
              onClick={generatePreview}
              variant="outline"
              disabled={previewing}
              className="flex-1"
            >
              {previewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button
              onClick={sendTestEmail}
              disabled={sending || !testEmail}
              className="flex-1"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
