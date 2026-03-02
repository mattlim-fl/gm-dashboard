import { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SystemSettings } from '@/components/settings/SystemSettings';
import { ApiSettings } from '@/components/settings/ApiSettings';
import { BenchmarkSettings } from '@/components/settings/BenchmarkSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { EmailAgentSettings } from '@/components/settings/EmailAgentSettings';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';

const VALID_TABS = ['integrations', 'notifications', 'email-agent', 'benchmarks', 'system'] as const;
type TabValue = typeof VALID_TABS[number];

export default function Settings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  
  const canManageIntegrations = isAdmin(role);
  const allowedTabs = useMemo(() => {
    return canManageIntegrations ? VALID_TABS : (VALID_TABS.filter((t) => t !== 'integrations') as TabValue[]);
  }, [canManageIntegrations]);

  const defaultTab: TabValue = canManageIntegrations ? 'integrations' : 'notifications';

  // Get tab from URL or default to the first allowed tab
  const tabFromUrl = searchParams.get('tab') as TabValue | null;
  const activeTab = tabFromUrl && allowedTabs.includes(tabFromUrl) ? tabFromUrl : defaultTab;

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    if (!allowedTabs.includes(value as TabValue)) return;
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', value);
    navigate(`/settings?${newSearchParams.toString()}`, { replace: true });
  };

  // Ensure URL has tab parameter on initial load if missing
  useEffect(() => {
    const current = searchParams.get('tab') as TabValue | null;
    if (!current || !allowedTabs.includes(current)) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', defaultTab);
      navigate(`/settings?${newSearchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate, allowedTabs, defaultTab]);

  const tabsListClassName = canManageIntegrations
    ? 'grid w-full grid-cols-5'
    : 'grid w-full grid-cols-4';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gm-neutral-900">Settings</h1>
          <p className="text-gm-neutral-600">
            Manage your account settings and preferences.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={tabsListClassName}>
            {canManageIntegrations && (
              <TabsTrigger value="integrations">API Integrations</TabsTrigger>
            )}
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="email-agent">Email Agent</TabsTrigger>
            <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          {canManageIntegrations && (
            <TabsContent value="integrations" className="mt-6">
              <ApiSettings />
            </TabsContent>
          )}

          <TabsContent value="notifications" className="mt-6">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="email-agent" className="mt-6">
            <EmailAgentSettings />
          </TabsContent>

          <TabsContent value="benchmarks" className="mt-6">
            <BenchmarkSettings />
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
