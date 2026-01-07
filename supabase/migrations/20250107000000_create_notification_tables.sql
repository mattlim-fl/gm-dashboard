-- Create notification_settings table for configurable notification recipients
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('weekly_summary', 'daily_summary')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  whatsapp_numbers TEXT[] NOT NULL DEFAULT '{}',
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_type)
);

-- Create notification_logs table for tracking notification history
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'whatsapp')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);

-- Add trigger for updated_at on notification_settings
DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insert default weekly_summary notification settings
INSERT INTO notification_settings (notification_type, enabled, recipient_emails, whatsapp_numbers)
VALUES ('weekly_summary', true, '{}', '{}')
ON CONFLICT (notification_type) DO NOTHING;

-- Enable RLS on both tables
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Admins can update notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Admins can view notification logs" ON notification_logs;

-- RLS policies: Only authenticated users with admin role can view/modify notification settings
-- Note: Adjust the auth check based on your actual auth schema
CREATE POLICY "Admins can view notification settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (true); -- Simplified for now - adjust based on your auth system

CREATE POLICY "Admins can update notification settings"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (true); -- Simplified for now - adjust based on your auth system

-- RLS policies: Only authenticated users can view notification logs
CREATE POLICY "Admins can view notification logs"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (true); -- Simplified for now - adjust based on your auth system

COMMENT ON TABLE notification_settings IS 'Stores configuration for automated notifications (weekly summaries, etc.)';
COMMENT ON TABLE notification_logs IS 'Audit log of all notification deliveries and their status';

