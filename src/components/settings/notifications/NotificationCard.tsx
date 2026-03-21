import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Send, Eye, Clock } from 'lucide-react';
import { formatHour } from '@/utils/dateUtils';

export interface NotificationSettingsData {
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
  settings: NotificationSettingsData;
  title: string;
  description: string;
  functionName: string;
  onUpdate: (settings: NotificationSettingsData) => void;
  onSave: () => void;
  onTest: (type: 'email' | 'whatsapp', recipient?: string) => void;
  onPreview: () => void;
  onScheduleChange: (dayOfWeek: number, hourAwst: number) => void;
  saving: boolean;
  testing: { email: boolean; whatsapp: boolean };
  previewing: boolean;
  updatingSchedule: boolean;
}

export function NotificationCard({
  settings,
  title,
  description,
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
  const [testEmail, setTestEmail] = useState('');
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
          <div className="flex space-x-2">
            <Input
              type="email"
              placeholder="Enter email for test send"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (testEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
                    onTest('email', testEmail);
                  }
                }
              }}
              disabled={testing.email || !settings.enabled}
            />
            <Button
              onClick={() => onTest('email', testEmail)}
              variant="outline"
              disabled={testing.email || !settings.enabled || !testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)}
            >
              {testing.email ? (
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
        </div>
      </CardContent>
    </Card>
  );
}
