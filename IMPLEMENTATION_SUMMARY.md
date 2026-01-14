# Dual Notification Strategy Implementation - Complete

## Overview

Successfully implemented a dual notification strategy with two distinct weekly reports:
1. **Trade Report** (Sunday 6 AM AWST) - Sales, revenue, and attendance metrics
2. **Business Performance** (Wednesday 6 AM AWST) - P&L metrics, cost percentages, and financial KPIs

Both Phase 1 (core functionality) and Phase 2 (configurable scheduling) have been completed.

## Phase 1: Core Implementation ✅

### Database Changes
- ✅ Migration `20250114000001_add_business_performance_notification.sql`
  - Added `schedule_day_of_week` and `schedule_hour_awst` columns
  - Renamed `weekly_summary` to `trade_report`
  - Added `business_performance` notification type
  - Created two cron jobs (Sunday and Wednesday)

### Edge Functions
- ✅ Renamed `weekly-summary` → `trade-report`
  - Updated notification type constant
  - Updated email subject to "Weekly Trade Report"
  - Focuses on sales performance metrics

- ✅ Created `business-performance` function
  - Fetches P&L data from Xero API
  - Calculates cost percentages (wages, COGS, security)
  - Generates AI email with financial analysis
  - Includes WhatsApp summary with key metrics

### Frontend Updates
- ✅ Updated `NotificationSettings.tsx`
  - Displays two separate notification cards
  - Each card has independent enable/disable toggle
  - Separate recipient lists for emails and WhatsApp
  - Preview and test functionality for each type
  - Schedule display showing day and time

### Type Updates
- ✅ Regenerated TypeScript types
  - Added `schedule_day_of_week` and `schedule_hour_awst` fields
  - Updated notification_type to support new types

### Documentation
- ✅ Renamed and updated `notification-system-setup.md`
  - Documents both notification types
  - Includes setup instructions
  - Troubleshooting guide
  - Architecture diagram

## Phase 2: Configurable Scheduling ✅

### Database Changes
- ✅ Migration `20250114000002_add_cron_management.sql`
  - Created `get_cron_expression()` function for AWST→UTC conversion
  - Added `cron_job_name` column to track pg_cron jobs

### Edge Functions
- ✅ Created `update-cron-schedule` function
  - Accepts notification_type, day_of_week, hour_awst
  - Unschedules existing cron job
  - Creates new cron job with updated schedule
  - Updates notification_settings table

### Frontend Updates
- ✅ Enhanced `NotificationSettings.tsx`
  - Added day-of-week dropdown (Sunday-Saturday)
  - Added time picker (0-23 hours in AWST)
  - "Update Schedule" button with loading state
  - Real-time schedule updates via edge function
  - Displays current schedule in readable format

## Files Created/Modified

### Created Files
- `supabase/functions/trade-report/index.ts` (renamed from weekly-summary)
- `supabase/functions/business-performance/index.ts`
- `supabase/functions/update-cron-schedule/index.ts`
- `supabase/migrations/20250114000001_add_business_performance_notification.sql`
- `supabase/migrations/20250114000002_add_cron_management.sql`
- `docs/notification-system-setup.md` (renamed from weekly-notifications-setup.md)

### Modified Files
- `src/components/settings/NotificationSettings.tsx` (complete rewrite)
- `src/integrations/supabase/types.ts` (regenerated)

## Deployment Checklist

### 1. Database Migrations
```bash
cd /Users/matthewlim/Desktop/Fractal\ Projects/gm-dashboard
supabase db push
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy trade-report
supabase functions deploy business-performance
supabase functions deploy update-cron-schedule
```

### 3. Verify Cron Jobs
```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname IN ('trade-report-notification', 'business-performance-notification');
```

### 4. Configure in UI
1. Navigate to Settings → Notifications
2. Configure recipients for each notification type
3. Test with Preview and Test buttons
4. Adjust schedules if needed using the UI pickers

## Key Features

### Trade Report (Sunday 6 AM AWST)
- Bar revenue with week-over-week and YoY comparison
- Door revenue with trends
- Total revenue and percentage changes
- Attendance figures and spend per head
- AI-generated email with sales insights
- Short WhatsApp summary

### Business Performance (Wednesday 6 AM AWST)
- Revenue and net profit with margins
- Wages as % of revenue
- COGS as % of revenue
- Security costs as % of revenue
- Cost efficiency analysis
- AI-generated email with P&L insights
- Short WhatsApp summary with key metrics

### Configurable Scheduling
- Change day of week (Sunday-Saturday)
- Change time (0-23 hours AWST)
- Updates apply immediately via cron job recreation
- No code changes required for schedule adjustments

## Testing

### Preview Mode
```bash
# Test trade report preview
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/trade-report \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"preview_only": true}'

# Test business performance preview
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/business-performance \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"preview_only": true}'
```

### Test Delivery
Use the "Test Email" and "Test WhatsApp" buttons in the UI, or:

```bash
# Test trade report email only
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/trade-report \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"test_email_only": true}'
```

### Schedule Update
Use the UI schedule pickers, or:

```bash
# Update trade report to Monday 9 AM AWST
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/update-cron-schedule \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"notification_type": "trade_report", "day_of_week": 1, "hour_awst": 9}'
```

## Success Criteria

All completed:
- ✅ Two distinct notification types with different schedules
- ✅ Trade report focuses on sales metrics
- ✅ Business performance focuses on P&L and costs
- ✅ Both support email and WhatsApp delivery
- ✅ AI-generated email content for both types
- ✅ Separate recipient lists for each type
- ✅ Preview functionality
- ✅ Test functionality
- ✅ Configurable schedules via UI
- ✅ Real-time cron job updates
- ✅ Comprehensive documentation

## Next Steps (Future Enhancements)

Potential Phase 3 features:
- Custom notification templates
- Conditional sending rules (e.g., only if revenue > X)
- Multiple schedules per notification type
- Notification history viewer in UI
- Custom AI prompt templates
- Additional notification types
