import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  Mail,
  Bot,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  FileText,
  Clock,
  Activity
} from 'lucide-react';
import { KnowledgeFileEditor } from './KnowledgeFileEditor';
import { config as appConfig } from '@/config/env';

interface EmailAgentConfig {
  id: string;
  venue: string;
  mailbox_email: string;
  enabled: boolean;
  poll_interval_minutes: number;
  last_poll_at: string | null;
  gmail_refresh_token_encrypted: string | null;
}

interface EmailAgentLog {
  id: string;
  gmail_message_id: string;
  from_email: string;
  from_name: string;
  subject: string;
  classified_category: string;
  classification_confidence: number;
  status: string;
  created_at: string;
  processed_at: string | null;
}

interface EmailCategory {
  category_key: string;
  display_name: string;
  description: string;
  auto_draft: boolean;
}

// Fixed venue for PoC
const EMAIL_AGENT_VENUE = 'hippie';

async function fetchEmailAgentData(venue: string) {
  // Fetch config
  const { data: configData, error: configError } = await supabase
    .from('email_agent_config')
    .select('*')
    .eq('venue', venue)
    .single();

  if (configError && configError.code !== 'PGRST116') {
    throw configError;
  }

  // Fetch categories
  const { data: catData, error: catError } = await supabase
    .from('email_categories')
    .select('*')
    .order('priority', { ascending: false });

  if (catError) throw catError;

  // Fetch recent logs
  const { data: logData, error: logError } = await supabase
    .from('email_agent_logs')
    .select('*')
    .eq('venue', venue)
    .order('created_at', { ascending: false })
    .limit(20);

  if (logError) throw logError;

  return {
    config: configData as EmailAgentConfig | null,
    categories: (catData || []) as EmailCategory[],
    recentLogs: (logData || []) as EmailAgentLog[],
  };
}

export function EmailAgentSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<EmailAgentConfig | null>(null);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [recentLogs, setRecentLogs] = useState<EmailAgentLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const { toast } = useToast();

  const venue = EMAIL_AGENT_VENUE;

  useQuery({
    queryKey: ['email-agent-data', venue],
    queryFn: () => fetchEmailAgentData(venue),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data) => {
      // Sync to local state for editing
      if (data.config !== undefined && config === null) {
        setConfig(data.config);
        if (data.config?.gmail_refresh_token_encrypted) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('disconnected');
        }
      }
      if (data.categories.length > 0 && categories.length === 0) {
        setCategories(data.categories);
      }
      if (data.recentLogs.length > 0 && recentLogs.length === 0) {
        setRecentLogs(data.recentLogs);
      }
      return data;
    },
  });

  useEffect(() => {
    checkUrlParams();
  }, []);

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'gmail_connected') {
      toast({
        title: 'Gmail Connected',
        description: 'Your Gmail account has been successfully connected.',
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings?tab=email-agent');
    }

    if (error) {
      toast({
        title: 'Connection Error',
        description: decodeURIComponent(error),
        variant: 'destructive',
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings?tab=email-agent');
    }
  }

  function fetchData() {
    queryClient.invalidateQueries({ queryKey: ['email-agent-data', venue] });
  }

  async function toggleEnabled(enabled: boolean) {
    if (!config) return;

    if (enabled && !config.gmail_refresh_token_encrypted) {
      toast({
        title: 'Gmail Not Connected',
        description: 'Please connect your Gmail account first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('email_agent_config')
        .update({ enabled })
        .eq('id', config.id);

      if (error) throw error;

      setConfig({ ...config, enabled });
      toast({
        title: enabled ? 'Email Agent Enabled' : 'Email Agent Disabled',
        description: enabled
          ? 'The agent will start processing emails on the next poll.'
          : 'The agent has been paused.',
      });
    } catch (error) {
      console.error('Error updating config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    try {
      setTesting(true);
      setConnectionStatus('checking');

      const { data, error } = await supabase.functions.invoke('email-agent-oauth/test', {
        body: { venue },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('connected');
        toast({
          title: 'Connection Successful',
          description: `Connected to ${data.mailbox}. Found ${data.labelCount} labels.`,
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: 'Connection Failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
      toast({
        title: 'Test Failed',
        description: 'Could not test Gmail connection',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  }

  async function connectGmail() {
    const oauthUrl = `${appConfig.supabaseUrl}/functions/v1/email-agent-oauth/start?venue=${venue}`;
    window.location.href = oauthUrl;
  }

  async function disconnectGmail() {
    try {
      setSaving(true);

      const { error } = await supabase.functions.invoke('email-agent-oauth/disconnect', {
        body: { venue },
      });

      if (error) throw error;

      setConfig(config ? { ...config, gmail_refresh_token_encrypted: null, enabled: false } : null);
      setConnectionStatus('disconnected');
      toast({
        title: 'Gmail Disconnected',
        description: 'Your Gmail account has been disconnected.',
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Gmail',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'drafted':
        return <Badge className="bg-green-100 text-green-800">Drafted</Badge>;
      case 'skipped':
        return <Badge className="bg-yellow-100 text-yellow-800">Skipped</Badge>;
      case 'classified':
        return <Badge className="bg-blue-100 text-blue-800">Classified</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Noxfolk Email Agent</CardTitle>
              <CardDescription>
                AI-powered email assistant for Hippie Club
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gm-neutral-50">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gm-neutral-500" />
              <div>
                <p className="font-medium text-gm-neutral-900">Gmail Connection</p>
                <p className="text-sm text-gm-neutral-600">
                  {config?.mailbox_email || 'Not configured'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {connectionStatus === 'checking' && (
                <Loader2 className="h-5 w-5 animate-spin text-gm-neutral-400" />
              )}
              {connectionStatus === 'connected' && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {connectionStatus === 'disconnected' && (
                <XCircle className="h-5 w-5 text-gm-neutral-400" />
              )}
              {connectionStatus === 'error' && (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}

              {connectionStatus === 'connected' ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Test</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectGmail}
                    disabled={saving}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button onClick={connectGmail}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Gmail
                </Button>
              )}
            </div>
          </div>

          {/* Enable/Disable Toggle */}
          {connectionStatus === 'connected' && (
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label htmlFor="agent-enabled" className="text-base font-medium">
                  Email Agent Active
                </Label>
                <p className="text-sm text-gm-neutral-600">
                  When enabled, the agent will process incoming emails every 5 minutes
                </p>
              </div>
              <Switch
                id="agent-enabled"
                checked={config?.enabled || false}
                onCheckedChange={toggleEnabled}
                disabled={saving}
              />
            </div>
          )}

          {/* Last Poll Info */}
          {config?.last_poll_at && (
            <div className="flex items-center gap-2 text-sm text-gm-neutral-600">
              <Clock className="h-4 w-4" />
              <span>
                Last checked:{' '}
                {new Date(config.last_poll_at).toLocaleString('en-AU', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Knowledge Base and Activity */}
      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="knowledge">
            <FileText className="h-4 w-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Mail className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeFileEditor venue={venue} />
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Categories</CardTitle>
              <CardDescription>
                How incoming emails are classified and handled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.category_key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{cat.display_name}</p>
                      <p className="text-sm text-gm-neutral-600">{cat.description}</p>
                    </div>
                    <Badge variant={cat.auto_draft ? 'default' : 'secondary'}>
                      {cat.auto_draft ? 'Auto-draft' : 'Label only'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Last 20 emails processed by the agent
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-gm-neutral-500">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No emails processed yet</p>
                  <p className="text-sm mt-1">
                    Enable the agent and send a test email to see activity here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-3 rounded-lg border hover:bg-gm-neutral-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{log.subject || '(No subject)'}</p>
                          {getStatusBadge(log.status)}
                        </div>
                        <p className="text-sm text-gm-neutral-600 truncate">
                          From: {log.from_name || log.from_email}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gm-neutral-500">
                          {log.classified_category && (
                            <span>
                              Category: <strong>{log.classified_category}</strong>
                              {log.classification_confidence && (
                                <span className="ml-1">
                                  ({Math.round(log.classification_confidence * 100)}%)
                                </span>
                              )}
                            </span>
                          )}
                          <span>
                            {new Date(log.created_at).toLocaleString('en-AU', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Alert */}
      <Alert>
        <Bot className="h-4 w-4" />
        <AlertDescription>
          <strong>Draft-only mode:</strong> The agent creates draft replies in Gmail for staff review.
          No emails are sent automatically. Check your Gmail drafts folder to review and send responses.
        </AlertDescription>
      </Alert>
    </div>
  );
}
