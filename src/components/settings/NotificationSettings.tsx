import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, X, Send, Eye, Clock, Mail } from 'lucide-react';
import { formatHour, formatSchedule } from '@/utils/dateUtils';

interface NotificationSettings {
  id: string;
  notification_type: string;
  enabled: boolean;
  recipient_emails: string[];
  whatsapp_numbers: string[];
  last_sent_at: string | null;
  schedule_day_of_week: number | null;
  schedule_hour_awst: number | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface NotificationCardProps {
  settings: NotificationSettings;
  title: string;
  description: string;
  functionName: string;
  onUpdate: (settings: NotificationSettings) => void;
  onSave: () => void;
  onTest: (type: 'email' | 'whatsapp') => void;
  onPreview: () => void;
  onScheduleChange: (dayOfWeek: number, hourAwst: number) => void;
  saving: boolean;
  testing: { email: boolean; whatsapp: boolean };
  previewing: boolean;
  updatingSchedule: boolean;
}

function NotificationCard({
  settings,
  title,
  description,
  functionName,
  onUpdate,
  onSave,
  onTest,
  onPreview,
  onScheduleChange,
  saving,
  testing,
  previewing,
  updatingSchedule,
}: NotificationCardProps) {
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [tempDayOfWeek, setTempDayOfWeek] = useState<number>(settings.schedule_day_of_week ?? 0);
  const [tempHourAwst, setTempHourAwst] = useState<number>(settings.schedule_hour_awst ?? 6);
  const { toast } = useToast();

  // Update temp values when settings change
  useEffect(() => {
    if (settings.schedule_day_of_week !== null) {
      setTempDayOfWeek(settings.schedule_day_of_week);
    }
    if (settings.schedule_hour_awst !== null) {
      setTempHourAwst(settings.schedule_hour_awst);
    }
  }, [settings.schedule_day_of_week, settings.schedule_hour_awst]);

  function addEmail() {
    if (!newEmail) return;
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (settings.recipient_emails.includes(newEmail)) {
      toast({
        title: 'Duplicate Email',
        description: 'This email is already in the list',
        variant: 'destructive',
      });
      return;
    }

    onUpdate({
      ...settings,
      recipient_emails: [...settings.recipient_emails, newEmail],
    });
    setNewEmail('');
  }

  function removeEmail(email: string) {
    onUpdate({
      ...settings,
      recipient_emails: settings.recipient_emails.filter(e => e !== email),
    });
  }

  function addPhone() {
    if (!newPhone) return;
    
    if (!/^\+\d{10,15}$/.test(newPhone)) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid phone number with country code (e.g., +61412345678)',
        variant: 'destructive',
      });
      return;
    }

    if (settings.whatsapp_numbers.includes(newPhone)) {
      toast({
        title: 'Duplicate Phone',
        description: 'This phone number is already in the list',
        variant: 'destructive',
      });
      return;
    }

    onUpdate({
      ...settings,
      whatsapp_numbers: [...settings.whatsapp_numbers, newPhone],
    });
    setNewPhone('');
  }

  function removePhone(phone: string) {
    onUpdate({
      ...settings,
      whatsapp_numbers: settings.whatsapp_numbers.filter(p => p !== phone),
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor={`enabled-${settings.notification_type}`}>Enabled</Label>
            <Switch
              id={`enabled-${settings.notification_type}`}
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                onUpdate({ ...settings, enabled: checked })
              }
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.last_sent_at && (
          <div className="rounded-lg bg-gm-neutral-50 p-4">
            <p className="text-sm text-gm-neutral-600">
              Last sent:{' '}
              <span className="font-medium text-gm-neutral-900">
                {new Date(settings.last_sent_at).toLocaleString('en-AU', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </p>
          </div>
        )}

        {/* Schedule Configuration */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gm-neutral-500" />
            <Label>Delivery Schedule</Label>
          </div>
          <div className="flex space-x-3">
            <Select 
              value={tempDayOfWeek.toString()} 
              onValueChange={(val) => setTempDayOfWeek(parseInt(val))}
              disabled={updatingSchedule}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((day, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={tempHourAwst.toString()} 
              onValueChange={(val) => setTempHourAwst(parseInt(val))}
              disabled={updatingSchedule}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => onScheduleChange(tempDayOfWeek, tempHourAwst)}
              disabled={
                updatingSchedule ||
                (tempDayOfWeek === settings.schedule_day_of_week && 
                 tempHourAwst === settings.schedule_hour_awst)
              }
              variant="outline"
            >
              {updatingSchedule ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Schedule'
              )}
            </Button>
          </div>
          <p className="text-xs text-gm-neutral-500">
            All times in Australian Western Standard Time (AWST). Changes take effect immediately.
          </p>
        </div>

        {/* Email Recipients */}
        <div className="space-y-3">
          <Label>Email Recipients</Label>
          <div className="flex space-x-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addEmail();
                }
              }}
            />
            <Button onClick={addEmail} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.recipient_emails.map((email) => (
              <Badge key={email} variant="secondary" className="px-3 py-1">
                {email}
                <button
                  onClick={() => removeEmail(email)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.recipient_emails.length === 0 && (
              <p className="text-sm text-gm-neutral-500">
                No email recipients configured
              </p>
            )}
          </div>
        </div>

        {/* WhatsApp Numbers */}
        <div className="space-y-3">
          <Label>WhatsApp Numbers</Label>
          <div className="flex space-x-2">
            <Input
              type="tel"
              placeholder="+61412345678"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPhone();
                }
              }}
            />
            <Button onClick={addPhone} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gm-neutral-500">
            Include country code (e.g., +61 for Australia)
          </p>
          <div className="flex flex-wrap gap-2">
            {settings.whatsapp_numbers.map((phone) => (
              <Badge key={phone} variant="secondary" className="px-3 py-1">
                {phone}
                <button
                  onClick={() => removePhone(phone)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.whatsapp_numbers.length === 0 && (
              <p className="text-sm text-gm-neutral-500">
                No WhatsApp numbers configured
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3 pt-4 border-t">
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={onPreview}
              variant="outline"
              disabled={previewing || !settings.enabled}
              className="flex-1"
            >
              {previewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button
              onClick={() => onTest('email')}
              variant="outline"
              disabled={testing.email || !settings.enabled || settings.recipient_emails.length === 0}
              className="flex-1"
            >
              {testing.email ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Test Email
                </>
              )}
            </Button>
            <Button
              onClick={() => onTest('whatsapp')}
              variant="outline"
              disabled={testing.whatsapp || !settings.enabled || settings.whatsapp_numbers.length === 0}
              className="flex-1"
            >
              {testing.whatsapp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Test WhatsApp
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmailTemplateTester() {
  const [venue, setVenue] = useState<'manor' | 'hippie'>('manor');
  const [testEmail, setTestEmail] = useState('');
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
          template: 'karaoke-confirmation',
          to: testEmail,
          data: {
            customerName: 'Test User',
            customerEmail: testEmail,
            referenceCode: 'K-TEST01',
            venue: venue,
            boothName: 'Karaoke Room A',
            bookingDate: 'Saturday 1 February 2026',
            startTime: '7:00 PM',
            endTime: '8:00 PM',
            guestCount: '4',
            guestListUrl: `https://${venue === 'manor' ? 'manorleederville.com' : 'hippieclub.com'}/guest-list?token=test123`,
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

  async function generatePreview() {
    try {
      setPreviewing(true);
      // Build the HTML locally for preview using the same template structure
      const venueDisplayName = venue === 'manor' ? 'Manor' : 'Hippie Club';
      const instagramHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth';
      const facebookHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Karaoke Booking Confirmation - ${venueDisplayName}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1);">
              <div style="text-align: center; color: #6c757d; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;">
                ${venueDisplayName} Karaoke
              </div>
              <h1 style="margin: 0 0 8px 0; color: #333; font-size: 24px; font-weight: 600; text-align: center;">
                You're all set, Test User!
              </h1>
              <p style="text-align: center; color: #495057; font-size: 16px; margin: 0 0 32px 0;">
                Your karaoke booth is confirmed for Saturday 1 February 2026.
              </p>
              <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
                <p style="margin: 0 0 8px 0; color: white; font-size: 18px; font-weight: 600;">
                  Who's joining you?
                </p>
                <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                  Add your guests now so they're on the door list when they arrive.
                </p>
                <a href="#" style="display: inline-block; background: white; color: #ee5a24; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
                  Add Guest Names
                </a>
              </div>
              <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Date</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">Saturday 1 February 2026</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Time</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">7:00 PM - 8:00 PM</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Booth</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">Karaoke Room A</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Guests</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">Up to 4 people</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6c757d; font-size: 13px;">Reference</td>
                    <td style="padding: 10px 0; color: #6c757d; font-size: 13px; text-align: right; font-family: 'Courier New', monospace;">K-TEST01</td>
                  </tr>
                </table>
              </div>
              <div style="margin: 0 0 32px 0;">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">
                  On the day
                </h3>
                <div style="background: #fff8e6; border-radius: 8px; padding: 20px; border-left: 4px solid #ffc107;">
                  <p style="margin: 0 0 12px 0; color: #495057;">
                    <strong>1.</strong> Arrive 10 minutes before your booking time
                  </p>
                  <p style="margin: 0 0 12px 0; color: #495057;">
                    <strong>2.</strong> Head to the bar upstairs at ${venueDisplayName} to check in
                  </p>
                  <p style="margin: 0; color: #495057;">
                    <strong>3.</strong> Collect your wristbands and you're ready to sing!
                  </p>
                </div>
              </div>
              <p style="color: #6c757d; font-size: 14px; margin: 0 0 32px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
                <strong>Tip:</strong> If you purchased guest list entries, they'll arrive by email the day before. Don't want to queue? Message us on Instagram.
              </p>
              <div style="text-align: center; margin: 0 0 32px 0;">
                <p style="color: #333; font-size: 16px; margin: 0 0 8px 0;">
                  See you soon! 🎤
                </p>
                <p style="color: #6c757d; font-size: 14px; margin: 0;">
                  The ${venueDisplayName} Team
                </p>
              </div>
              <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 12px 0;">
                  <a href="https://instagram.com/${instagramHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
                    Instagram
                  </a>
                  <span style="color: #dee2e6;">|</span>
                  <a href="https://facebook.com/${facebookHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
                    Facebook
                  </a>
                </p>
                <p style="margin: 16px 0 0 0; font-size: 12px; color: #adb5bd;">
                  This confirmation was sent to test@example.com
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

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
            <DialogTitle>Karaoke Confirmation Email Preview</DialogTitle>
            <DialogDescription>
              Preview of the {venue === 'manor' ? 'Manor' : 'Hippie Club'} karaoke booking confirmation email
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
              <CardTitle>Email Template Testing</CardTitle>
              <CardDescription>Send test karaoke confirmation emails to preview the template</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

function TicketEmailTester() {
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
            guestListUrl: `https://${venue === 'manor' ? 'manorleederville.com' : 'hippieclub.com'}/guest-list?token=test123`,
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

  async function generatePreview() {
    try {
      setPreviewing(true);
      const venueDisplayName = venue === 'manor' ? 'Manor' : 'Hippie Club';
      const instagramHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth';
      const facebookHandle = venue === 'manor' ? 'manorleederville' : 'hipeclubperth';
      const qty = Number(ticketQuantity);
      const ticketLabel = qty === 1 ? 'ticket' : 'tickets';
      const isAre = qty === 1 ? 'is' : 'are';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Ticket Confirmation - ${venueDisplayName}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1);">
              <div style="text-align: center; color: #6c757d; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;">
                ${venueDisplayName}
              </div>
              <h1 style="margin: 0 0 8px 0; color: #333; font-size: 24px; font-weight: 600; text-align: center;">
                You're on the list, Test User!
              </h1>
              <p style="text-align: center; color: #495057; font-size: 16px; margin: 0 0 32px 0;">
                Your ${ticketQuantity} ${ticketLabel} ${isAre} confirmed for Saturday 1 February 2026.
              </p>
              <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
                <p style="margin: 0 0 8px 0; color: white; font-size: 18px; font-weight: 600;">
                  Who's coming with you?
                </p>
                <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                  Add your guest names now so they're on the door list when they arrive.
                </p>
                <a href="#" style="display: inline-block; background: white; color: #ee5a24; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
                  Add Guest Names
                </a>
              </div>
              <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Event</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">Saturday Night Special</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Date</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">Saturday 1 February 2026</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Tickets</td>
                    <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${ticketQuantity}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6c757d; font-size: 13px;">Reference</td>
                    <td style="padding: 10px 0; color: #6c757d; font-size: 13px; text-align: right; font-family: 'Courier New', monospace;">T-TEST01</td>
                  </tr>
                </table>
              </div>
              <div style="margin: 0 0 32px 0;">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">
                  On the night
                </h3>
                <div style="background: #fff8e6; border-radius: 8px; padding: 20px; border-left: 4px solid #ffc107;">
                  <p style="margin: 0 0 12px 0; color: #495057;">
                    <strong>1.</strong> Head to ${venueDisplayName} on the night of your event
                  </p>
                  <p style="margin: 0 0 12px 0; color: #495057;">
                    <strong>2.</strong> Give your name at the door - you're on the guest list!
                  </p>
                  <p style="margin: 0; color: #495057;">
                    <strong>3.</strong> Enjoy your night!
                  </p>
                </div>
              </div>
              <p style="color: #6c757d; font-size: 14px; margin: 0 0 32px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
                <strong>Tip:</strong> Make sure all your guests are added to the list before the event. They'll need to give their name at the door.
              </p>
              <div style="text-align: center; margin: 0 0 32px 0;">
                <p style="color: #333; font-size: 16px; margin: 0 0 8px 0;">
                  See you there! 🎉
                </p>
                <p style="color: #6c757d; font-size: 14px; margin: 0;">
                  The ${venueDisplayName} Team
                </p>
              </div>
              <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 12px 0;">
                  <a href="https://instagram.com/${instagramHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
                    Instagram
                  </a>
                  <span style="color: #dee2e6;">|</span>
                  <a href="https://facebook.com/${facebookHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
                    Facebook
                  </a>
                </p>
                <p style="margin: 16px 0 0 0; font-size: 12px; color: #adb5bd;">
                  This confirmation was sent to test@example.com
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

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

export function NotificationSettings() {
  const [tradeReportSettings, setTradeReportSettings] = useState<NotificationSettings | null>(null);
  const [businessPerfSettings, setBusinessPerfSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ tradeReport: boolean; businessPerf: boolean }>({
    tradeReport: false,
    businessPerf: false,
  });
  const [testing, setTesting] = useState<{
    tradeReport: { email: boolean; whatsapp: boolean };
    businessPerf: { email: boolean; whatsapp: boolean };
  }>({
    tradeReport: { email: false, whatsapp: false },
    businessPerf: { email: false, whatsapp: false },
  });
  const [previewing, setPreviewing] = useState<{ tradeReport: boolean; businessPerf: boolean }>({
    tradeReport: false,
    businessPerf: false,
  });
  const [updatingSchedule, setUpdatingSchedule] = useState<{ tradeReport: boolean; businessPerf: boolean }>({
    tradeReport: false,
    businessPerf: false,
  });
  const [previewContent, setPreviewContent] = useState<{ html: string; whatsapp: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .in('notification_type', ['trade_report', 'business_performance']);

      if (error) throw error;

      const tradeReport = data?.find(s => s.notification_type === 'trade_report') || null;
      const businessPerf = data?.find(s => s.notification_type === 'business_performance') || null;

      setTradeReportSettings(tradeReport);
      setBusinessPerfSettings(businessPerf);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(type: 'trade_report' | 'business_performance') {
    const settings = type === 'trade_report' ? tradeReportSettings : businessPerfSettings;
    if (!settings) return;

    try {
      setSaving(prev => ({ ...prev, [type === 'trade_report' ? 'tradeReport' : 'businessPerf']: true }));
      const { error } = await supabase
        .from('notification_settings')
        .update({
          enabled: settings.enabled,
          recipient_emails: settings.recipient_emails,
          whatsapp_numbers: settings.whatsapp_numbers,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Notification settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(prev => ({ ...prev, [type === 'trade_report' ? 'tradeReport' : 'businessPerf']: false }));
    }
  }

  async function testNotification(type: 'trade_report' | 'business_performance', method: 'email' | 'whatsapp') {
    const settings = type === 'trade_report' ? tradeReportSettings : businessPerfSettings;
    const functionName = type === 'trade_report' ? 'trade-report' : 'business-performance';
    
    if (!settings) return;

    const recipients = method === 'email' ? settings.recipient_emails : settings.whatsapp_numbers;
    if (recipients.length === 0) {
      toast({
        title: 'No Recipients',
        description: `Please add at least one ${method === 'email' ? 'email' : 'WhatsApp number'} first`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const key = type === 'trade_report' ? 'tradeReport' : 'businessPerf';
      setTesting(prev => ({ ...prev, [key]: { ...prev[key], [method]: true } }));
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          test_email_only: method === 'email',
          test_whatsapp_only: method === 'whatsapp',
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Test ${method} sent to ${recipients.length} recipient(s)`,
      });
    } catch (error) {
      console.error(`Error sending test ${method}:`, error);
      toast({
        title: 'Error',
        description: `Failed to send test ${method}. Check the console for details.`,
        variant: 'destructive',
      });
    } finally {
      const key = type === 'trade_report' ? 'tradeReport' : 'businessPerf';
      setTesting(prev => ({ ...prev, [key]: { ...prev[key], [method]: false } }));
    }
  }

  async function previewNotification(type: 'trade_report' | 'business_performance') {
    const settings = type === 'trade_report' ? tradeReportSettings : businessPerfSettings;
    const functionName = type === 'trade_report' ? 'trade-report' : 'business-performance';
    
    if (!settings) return;

    try {
      const key = type === 'trade_report' ? 'tradeReport' : 'businessPerf';
      setPreviewing(prev => ({ ...prev, [key]: true }));
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { preview_only: true },
      });

      if (error) throw error;

      if (data?.preview) {
        setPreviewContent({
          html: data.preview.email_html,
          whatsapp: data.preview.whatsapp_message,
        });
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      const key = type === 'trade_report' ? 'tradeReport' : 'businessPerf';
      setPreviewing(prev => ({ ...prev, [key]: false }));
    }
  }

  async function updateSchedule(type: 'trade_report' | 'business_performance', dayOfWeek: number, hourAwst: number) {
    try {
      const key = type === 'trade_report' ? 'tradeReport' : 'businessPerf';
      setUpdatingSchedule(prev => ({ ...prev, [key]: true }));

      const { data, error } = await supabase.functions.invoke('update-cron-schedule', {
        body: {
          notification_type: type,
          day_of_week: dayOfWeek,
          hour_awst: hourAwst,
        },
      });

      if (error) throw error;

      // Refresh settings to get updated schedule
      await fetchSettings();

      toast({
        title: 'Success',
        description: `Schedule updated to ${formatSchedule(dayOfWeek, hourAwst)}`,
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update schedule. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      const key = type === 'trade_report' ? 'tradeReport' : 'businessPerf';
      setUpdatingSchedule(prev => ({ ...prev, [key]: false }));
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gm-primary-500" />
        </CardContent>
      </Card>
    );
  }

  if (!tradeReportSettings && !businessPerfSettings) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gm-neutral-600">
            No notification settings found. Please contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Preview</DialogTitle>
            <DialogDescription>
              Preview of what will be sent to recipients
            </DialogDescription>
          </DialogHeader>
          
          {previewContent && (
            <div className="space-y-6">
              {/* WhatsApp Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-2">WhatsApp Message</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {previewContent.whatsapp}
                  </pre>
                </div>
              </div>

              {/* Email Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Email Content</h3>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={previewContent.html}
                    className="w-full h-[500px] bg-white"
                    title="Email Preview"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {tradeReportSettings && (
          <NotificationCard
            settings={tradeReportSettings}
            title="Trade Report"
            description="Sales, revenue, and attendance metrics sent weekly"
            functionName="trade-report"
            onUpdate={setTradeReportSettings}
            onSave={() => saveSettings('trade_report')}
            onTest={(method) => testNotification('trade_report', method)}
            onPreview={() => previewNotification('trade_report')}
            onScheduleChange={(day, hour) => updateSchedule('trade_report', day, hour)}
            saving={saving.tradeReport}
            testing={testing.tradeReport}
            previewing={previewing.tradeReport}
            updatingSchedule={updatingSchedule.tradeReport}
          />
        )}

        {businessPerfSettings && (
          <NotificationCard
            settings={businessPerfSettings}
            title="Business Performance Analysis"
            description="P&L metrics, cost percentages, and financial KPIs sent weekly"
            functionName="business-performance"
            onUpdate={setBusinessPerfSettings}
            onSave={() => saveSettings('business_performance')}
            onTest={(method) => testNotification('business_performance', method)}
            onPreview={() => previewNotification('business_performance')}
            onScheduleChange={(day, hour) => updateSchedule('business_performance', day, hour)}
            saving={saving.businessPerf}
            testing={testing.businessPerf}
            previewing={previewing.businessPerf}
            updatingSchedule={updatingSchedule.businessPerf}
          />
        )}

        <EmailTemplateTester />
        <TicketEmailTester />
      </div>
    </>
  );
}
