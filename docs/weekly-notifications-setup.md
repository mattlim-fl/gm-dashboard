# Weekly Notifications (Trade Report + Business Performance)

The weekly notification system currently consists of **two separate reports**:

1. **Trade Report** (typically Sunday morning, AWST) – sales/revenue/attendance highlights\n+2. **Business Performance** (typically Wednesday morning, AWST) – P&L KPIs and cost percentages

Both can send **Email** (long-form analysis) and **WhatsApp** (short summary), and schedules are configurable in the app UI.

## What changed vs legacy docs

- The old `weekly-summary` function is **deprecated**.\n+- Use **`trade-report`** and **`business-performance`** edge functions.\n+- Scheduling is **configurable** via **`update-cron-schedule`** (no manual `cron.schedule(...)` copy/paste required for normal operation).

## Setup / Deployment

### 1) Database

Apply migrations:

```bash
supabase db push
```

Key migrations for the dual-report system:\n+- `20250114000001_add_business_performance_notification.sql`\n+- `20250114000002_add_cron_management.sql`

### 2) Deploy edge functions

```bash
supabase functions deploy trade-report
supabase functions deploy business-performance
supabase functions deploy update-cron-schedule
```

### 3) Configure in UI

In the dashboard:\n+- Go to **Settings → Notifications**\n+- Configure recipients (email + WhatsApp)\n+- Enable each report\n+- Optionally adjust schedule (day/time in AWST)\n+- Use **Preview** and **Test** actions to validate content and delivery

## Monitoring

Useful checks:

```sql
-- Recent notification logs
SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT 20;

-- Cron jobs (names may vary by environment)
SELECT jobname, schedule, active
FROM cron.job
ORDER BY jobname;
```

## Troubleshooting

- **Nothing sends**: confirm notification is enabled in `notification_settings` and cron job is active.\n+- **Preview works but cron doesn’t**: check `cron.job` entries and function logs.\n+- **Delivery failures**: inspect `notification_logs` error fields and edge function logs.

## References

- Implementation notes: `IMPLEMENTATION_SUMMARY.md`\n+- Edge functions catalog: `docs/edge-functions.md`

