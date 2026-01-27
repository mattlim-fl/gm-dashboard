# Claude Code Instructions

## MCP Integrations

### Supabase MCP
You have access to Supabase via MCP. Use the `mcp__supabase__*` tools to:
- Execute SQL queries directly
- List tables and migrations
- Apply migrations
- Get project information
- Deploy edge functions

**Project:** `plksvatjdylpuhjitbfc` (GM Dashboard)

### When to use Supabase MCP vs CLI
- **MCP tools**: Quick queries, checking data, listing tables
- **Supabase CLI**: Deploying edge functions, running migrations

## Deployment

### Edge Functions
After modifying edge functions in `supabase/functions/`, deploy with:
```bash
npx supabase functions deploy <function-name>
```

Example:
```bash
npx supabase functions deploy send-email
npx supabase functions deploy karaoke-availability
```

### Database Migrations
Migrations are in `supabase/migrations/`. Apply via:
```bash
npx supabase db push
```

Or use MCP: `mcp__supabase__apply_migration`

## Key Edge Functions

| Function | Purpose |
|----------|---------|
| `send-email` | Email notifications (booking confirmations, reminders) |
| `karaoke-availability` | Check booth availability |
| `karaoke-pay-and-book` | Process karaoke booking with payment |
| `ticket-pay-and-book` | Process ticket purchases |
| `trade-report` | Weekly trade report notifications |
| `business-performance` | Weekly P&L notifications |

## Testing Email Templates

Go to **Settings → Notifications tab** to test email templates:
- Select venue (Manor / Hippie Club)
- Enter test email address
- Click "Send Test Email" or "Preview"

## Common Tasks

### Check database tables
Use MCP: `mcp__supabase__list_tables`

### Run SQL query
Use MCP: `mcp__supabase__execute_sql`

### View edge function logs
```bash
npx supabase functions logs <function-name>
```

Or check Supabase Dashboard: https://supabase.com/dashboard/project/plksvatjdylpuhjitbfc/functions
