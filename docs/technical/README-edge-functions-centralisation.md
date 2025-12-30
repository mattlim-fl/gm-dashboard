# Edge Functions – Centralised Source of Truth

All Supabase Edge Functions for the GM project (`project_id = "plksvatjdylpuhjitbfc"`) are now **owned and maintained in this repo** (`gm-dashboard`).

This includes functions that are called from:
- The GM Dashboard app
- The public booking widget
- The Manor marketing site / karaoke booking UI

## Function locations

Source code lives under:

```text
gm-dashboard/supabase/functions/<function-name>/index.ts
```

Key shared functions:
- `karaoke-availability`
- `karaoke-holds`
- `karaoke-book`
- `karaoke-pay-and-book`
- `send-email`
- `venue-config-api`

> Note: The Manor marketing repo (`manor-perth-nightlife-ui`) no longer contains its own copies of `karaoke-pay-and-book` or `send-email`. Those functions are now defined only here.

## Deployment

From the `gm-dashboard` project root:

```bash
supabase functions deploy \
  karaoke-availability \
  karaoke-holds \
  karaoke-book \
  karaoke-pay-and-book \
  send-email \
  venue-config-api
```

See `docs/technical/allowed-origins.md` for the CORS (`ALLOWED_ORIGINS`) configuration used by these public-facing functions.


















