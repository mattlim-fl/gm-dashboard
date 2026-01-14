# Notification System Setup

Automated weekly notifications for venue performance tracking:
- **Trade Report** (Sunday 6 AM AWST): Sales, revenue, and attendance metrics
- **Business Performance** (Wednesday 6 AM AWST): P&L metrics, cost percentages, and financial KPIs

Both notifications support Email (AI-generated analysis) and WhatsApp (short metrics summary).

## Setup

### 1. Database

```bash
supabase db push  # Applies all migrations including notification system
```

### 2. Environment Variables

Add to Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
OPENAI_API_KEY=sk-...              # OpenAI (GPT-4 access required)
WHATSAPP_BUSINESS_API_KEY=...      # Meta for Developers → WhatsApp
WHATSAPP_PHONE_NUMBER_ID=...       # WhatsApp Business phone number ID
```

### 3. Deploy Edge Functions

```bash
# Deploy trade report function (sales/revenue/attendance)
supabase functions deploy trade-report

# Deploy business performance function (P&L/costs/margins)
supabase functions deploy business-performance
```

### 4. Cron Jobs

The cron jobs are automatically created by the migration.

**Trade Report** (Sunday 6 AM AWST = Saturday 10 PM UTC)
**Business Performance** (Wednesday 6 AM AWST = Tuesday 10 PM UTC)

### 5. Configure & Test

1. Navigate to Settings → Notifications tab
2. Configure each notification type separately
3. Enable notifications for each type
4. Click "Preview" to see generated content
5. Click "Test Email" or "Test WhatsApp" to send test notifications

## Monitoring

```sql
-- Recent notifications
SELECT * FROM notification_logs 
WHERE notification_type IN ('trade_report', 'business_performance')
ORDER BY sent_at DESC 
LIMIT 20;

-- Cron job status
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname IN ('trade-report-notification', 'business-performance-notification');
```

## Troubleshooting

- Check notification_logs table for errors
- Verify env variables in Supabase Dashboard
- Check Edge Function logs
- Test with "Preview" and "Test" buttons in UI
