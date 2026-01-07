import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, X, Send, Eye } from 'lucide-react';

interface NotificationSettings {
  id: string;
  notification_type: string;
  enabled: boolean;
  recipient_emails: string[];
  whatsapp_numbers: string[];
  last_sent_at: string | null;
}

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ html: string; whatsapp: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
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
        .eq('notification_type', 'weekly_summary')
        .single();

      if (error) throw error;
      setSettings(data);
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

  async function saveSettings() {
    if (!settings) return;

    try {
      setSaving(true);
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
      setSaving(false);
    }
  }

  async function testEmailNotification() {
    if (!settings || settings.recipient_emails.length === 0) {
      toast({
        title: 'No Recipients',
        description: 'Please add at least one email recipient first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTestingEmail(true);
      const { data, error } = await supabase.functions.invoke('weekly-summary', {
        body: { test_email_only: true },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Test email sent to ${settings.recipient_emails.length} recipient(s)`,
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test email. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setTestingEmail(false);
    }
  }

  async function testWhatsAppNotification() {
    if (!settings || settings.whatsapp_numbers.length === 0) {
      toast({
        title: 'No Recipients',
        description: 'Please add at least one WhatsApp number first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTestingWhatsApp(true);
      const { data, error } = await supabase.functions.invoke('weekly-summary', {
        body: { test_whatsapp_only: true },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Test WhatsApp sent to ${settings.whatsapp_numbers.length} recipient(s)`,
      });
    } catch (error) {
      console.error('Error sending test WhatsApp:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test WhatsApp. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setTestingWhatsApp(false);
    }
  }

  async function previewNotifications() {
    try {
      setPreviewing(true);
      const { data, error } = await supabase.functions.invoke('weekly-summary', {
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
      setPreviewing(false);
    }
  }

  function addEmail() {
    if (!settings || !newEmail) return;
    
    // Basic email validation
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

    setSettings({
      ...settings,
      recipient_emails: [...settings.recipient_emails, newEmail],
    });
    setNewEmail('');
  }

  function removeEmail(email: string) {
    if (!settings) return;
    setSettings({
      ...settings,
      recipient_emails: settings.recipient_emails.filter(e => e !== email),
    });
  }

  function addPhone() {
    if (!settings || !newPhone) return;
    
    // Basic phone validation (should start with + and contain only digits)
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

    setSettings({
      ...settings,
      whatsapp_numbers: [...settings.whatsapp_numbers, newPhone],
    });
    setNewPhone('');
  }

  function removePhone(phone: string) {
    if (!settings) return;
    setSettings({
      ...settings,
      whatsapp_numbers: settings.whatsapp_numbers.filter(p => p !== phone),
    });
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

  if (!settings) {
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly Summary Notifications</CardTitle>
              <CardDescription>
                Automated weekly performance summaries sent every Sunday morning
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enabled: checked })
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
                    className="ml-2 hover:text-red-600"
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
                    className="ml-2 hover:text-red-600"
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
              <Button onClick={saveSettings} disabled={saving}>
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
                onClick={previewNotifications}
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
                onClick={testEmailNotification}
                variant="outline"
                disabled={testingEmail || !settings.enabled || settings.recipient_emails.length === 0}
                className="flex-1"
              >
                {testingEmail ? (
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
                onClick={testWhatsAppNotification}
                variant="outline"
                disabled={testingWhatsApp || !settings.enabled || settings.whatsapp_numbers.length === 0}
                className="flex-1"
              >
                {testingWhatsApp ? (
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

      <Card>
        <CardHeader>
          <CardTitle>Notification Schedule</CardTitle>
          <CardDescription>
            Weekly summaries are automatically sent every Sunday at 6:00 AM AWST
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Frequency</span>
              <Badge>Weekly</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Day</span>
              <Badge>Sunday</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Time</span>
              <Badge>6:00 AM AWST</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Period Covered</span>
              <Badge variant="outline">Last 7 Days</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}

