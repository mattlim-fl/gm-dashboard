# Weekly Notification System

Automated weekly performance summaries sent every Sunday at 6:00 AM AWST via WhatsApp (short metrics) and Email (AI-generated analysis).

## Setup

### 1. Database

```bash
supabase db push  # Applies migration: 20250107000000-create-notification-tables.sql
```

### 2. Environment Variables

Add to Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
OPENAI_API_KEY=sk-...              # OpenAI (GPT-4 access required)
WHATSAPP_BUSINESS_API_KEY=...      # Meta for Developers → WhatsApp
WHATSAPP_PHONE_NUMBER_ID=...       # WhatsApp Business phone number ID
```

### 3. Deploy

```bash
supabase functions deploy weekly-summary
```

### 4. Schedule Cron Job

In Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'weekly-summary-notification',
  '0 22 * * 6',  -- Saturday 10 PM UTC = Sunday 6 AM AWST
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-summary',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

### 5. Configure & Test

1. Settings → Notifications tab
2. Add emails and WhatsApp numbers (+61412345678 format)
3. Enable notifications
4. Click "Send Test Notification"

## Monitoring

```sql
-- Recent notifications
SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT 10;

-- Cron job status
SELECT * FROM cron.job WHERE jobname = 'weekly-summary-notification';
```

## Troubleshooting

- Check `notification_logs` table for errors
- Verify env variables in Supabase Dashboard
- Check Edge Function logs
- Test with "Send Test Notification" button

