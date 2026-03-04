import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { formatSchedule } from '@/utils/dateUtils';
import { ContactFormRouting } from './ContactFormRouting';
import {
  NotificationCard,
  EmailTemplateTester,
  TicketEmailTester,
  type NotificationSettingsData,
} from './notifications';

async function fetchNotificationSettings() {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .in('notification_type', ['trade_report', 'business_performance']);

  if (error) throw error;

  return {
    tradeReport: data?.find(s => s.notification_type === 'trade_report') || null,
    businessPerf: data?.find(s => s.notification_type === 'business_performance') || null,
  };
}

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const [tradeReportSettings, setTradeReportSettings] = useState<NotificationSettingsData | null>(null);
  const [businessPerfSettings, setBusinessPerfSettings] = useState<NotificationSettingsData | null>(null);
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

  const { isLoading: loading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: fetchNotificationSettings,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data) => {
      // Sync React Query data to local state for editing
      if (data.tradeReport && !tradeReportSettings) {
        setTradeReportSettings(data.tradeReport);
      }
      if (data.businessPerf && !businessPerfSettings) {
        setBusinessPerfSettings(data.businessPerf);
      }
      return data;
    },
  });

  async function fetchSettings() {
    queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
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

      const { error } = await supabase.functions.invoke(functionName, {
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

      const { error } = await supabase.functions.invoke('update-cron-schedule', {
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
            title="Saturday Trade Report"
            description="Saturday night (6am-6am AWST) sales, revenue, and attendance metrics"
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

        <ContactFormRouting />

        <EmailTemplateTester />
        <TicketEmailTester />
      </div>
    </>
  );
}
