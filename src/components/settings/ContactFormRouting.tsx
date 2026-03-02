import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, X, Mail, MessageSquare } from 'lucide-react';
import { ALL_VENUES, VENUE_LABELS } from '@/types/venue';
import type { Venue } from '@/types/venue';

interface ContactNotificationSettings {
  id: string;
  notification_type: string;
  enabled: boolean;
  recipient_emails: string[];
}

type Category = 'lost_property' | 'scantech' | 'general';

const VENUES: { id: Venue; name: string }[] = ALL_VENUES.map(v => ({
  id: v,
  name: VENUE_LABELS[v],
}));

const CATEGORIES: { id: Category; name: string; description: string }[] = [
  { id: 'lost_property', name: 'Lost Property', description: 'Inquiries about lost items' },
  { id: 'scantech', name: 'Scantech', description: 'Security-related inquiries and ban appeals' },
  { id: 'general', name: 'General', description: 'Opening hours follow-ups and other inquiries' },
];

interface CategoryCardProps {
  settings: ContactNotificationSettings | null;
  category: typeof CATEGORIES[number];
  venue: Venue;
  onUpdate: (settings: ContactNotificationSettings) => void;
  onSave: () => void;
  saving: boolean;
}

function CategoryCard({ settings, category, venue, onUpdate, onSave, saving }: CategoryCardProps) {
  const [newEmail, setNewEmail] = useState('');
  const { toast } = useToast();

  if (!settings) {
    return (
      <Card className="opacity-50">
        <CardHeader>
          <CardTitle className="text-base">{category.name}</CardTitle>
          <CardDescription>{category.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gm-neutral-500">
            Settings not configured. Run the database migration to set up contact form routing.
          </p>
        </CardContent>
      </Card>
    );
  }

  function addEmail() {
    if (!newEmail || !settings) return;

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
    if (!settings) return;
    onUpdate({
      ...settings,
      recipient_emails: settings.recipient_emails.filter((e) => e !== email),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{category.name}</CardTitle>
            <CardDescription className="text-sm">{category.description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor={`enabled-${settings.notification_type}`} className="text-sm">
              Active
            </Label>
            <Switch
              id={`enabled-${settings.notification_type}`}
              checked={settings.enabled}
              onCheckedChange={(checked) => onUpdate({ ...settings, enabled: checked })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Recipients */}
        <div className="space-y-2">
          <Label className="text-sm">Email Recipients</Label>
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
              className="text-sm"
            />
            <Button onClick={addEmail} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {settings.recipient_emails.map((email) => (
              <Badge key={email} variant="secondary" className="px-2 py-1 text-xs">
                {email}
                <button onClick={() => removeEmail(email)} className="ml-1.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.recipient_emails.length === 0 && (
              <p className="text-xs text-gm-neutral-500 py-1">No recipients configured</p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={saving} size="sm">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContactFormRouting() {
  const [settings, setSettings] = useState<Record<string, ContactNotificationSettings | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [activeVenue, setActiveVenue] = useState<Venue>('manor');
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const notificationTypes = VENUES.flatMap((venue) =>
        CATEGORIES.map((cat) => `${venue.id}_contact_${cat.id}`)
      );

      const { data, error } = await supabase
        .from('notification_settings')
        .select('id, notification_type, enabled, recipient_emails')
        .in('notification_type', notificationTypes);

      if (error) throw error;

      const settingsMap: Record<string, ContactNotificationSettings | null> = {};
      notificationTypes.forEach((type) => {
        const found = data?.find((s) => s.notification_type === type);
        settingsMap[type] = found || null;
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching contact form settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load contact form routing settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(notificationType: string) {
    const settingsToSave = settings[notificationType];
    if (!settingsToSave) return;

    try {
      setSaving((prev) => ({ ...prev, [notificationType]: true }));

      const { error } = await supabase
        .from('notification_settings')
        .update({
          enabled: settingsToSave.enabled,
          recipient_emails: settingsToSave.recipient_emails,
        })
        .eq('id', settingsToSave.id);

      if (error) throw error;

      toast({
        title: 'Saved',
        description: 'Contact form routing updated successfully',
      });
    } catch (error) {
      console.error('Error saving contact form settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving((prev) => ({ ...prev, [notificationType]: false }));
    }
  }

  function updateSettings(notificationType: string, newSettings: ContactNotificationSettings) {
    setSettings((prev) => ({
      ...prev,
      [notificationType]: newSettings,
    }));
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gm-primary-500" />
          <div>
            <CardTitle>Contact Form Routing</CardTitle>
            <CardDescription>
              Configure which email addresses receive contact form submissions for each venue and
              category
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeVenue} onValueChange={(v) => setActiveVenue(v as Venue)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {VENUES.map((venue) => (
              <TabsTrigger key={venue.id} value={venue.id}>
                {venue.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {VENUES.map((venue) => (
            <TabsContent key={venue.id} value={venue.id} className="space-y-4">
              {CATEGORIES.map((category) => {
                const notificationType = `${venue.id}_contact_${category.id}`;
                return (
                  <CategoryCard
                    key={notificationType}
                    settings={settings[notificationType]}
                    category={category}
                    venue={venue.id}
                    onUpdate={(newSettings) => updateSettings(notificationType, newSettings)}
                    onSave={() => saveSettings(notificationType)}
                    saving={saving[notificationType] || false}
                  />
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
