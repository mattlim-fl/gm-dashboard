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
import { Loader2, Plus, X, Send, Eye, Clock } from 'lucide-react';
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
      </div>
    </>
  );
}
