# GM API Runbook

Base URL (Netlify Functions): `/.netlify/functions/api`

All routes require `Authorization: Bearer <user_jwt>` unless stated.

## How requests flow

- Frontend calls these endpoints using `VITE_API_BASE_URL` (typically `/.netlify/functions/api`).\n+- Netlify entrypoint: `netlify/functions/api.ts`\n+- Router implementation: `apps/api/src/app.ts`\n+- Some routes are thin proxies to Supabase Edge Functions (see `docs/edge-functions.md`).

## Routes

- GET `/health`
  - Returns `{ ok: true }`

- POST `/karaoke/holds`
  - Headers: `x-action: create|extend|release`
  - `create` body:
    - `boothId` (uuid), `venue` ("manor"|"hippie"), `bookingDate` (YYYY-MM-DD), `startTime` (HH:mm), `endTime` (HH:mm), `sessionId` (string), `customerEmail?` (string), `ttlMinutes?` (1–60)
  - `extend` body: `holdId` (uuid), `sessionId` (string), `ttlMinutes?`
  - `release` body: `holdId` (uuid), `sessionId` (string)
  - Responses: `201 { success, hold }` or `200 { success, hold }`

- POST `/karaoke/finalize`
  - Body: `holdId?` (uuid) OR `sessionId?` (string), plus `customerName` and optional `customerEmail`, `customerPhone`, `guestCount`
  - Idempotency/uniqueness:
    - DB unique index prevents double-booking per booth/date/start/end when `status='confirmed'`
    - Endpoint returns existing booking if duplicate
  - Response: `201 { success, bookingId }` or `200` if existing booking reused

- POST `/square/sync`
  - Proxies to Supabase function `sync-and-transform`
  - Body: passes through; typical fields: `since`, `start_ts`, `end_ts`, `locations`, `dry_run`

- POST `/square/backfill`
  - Proxies to Supabase function `square-sync-backfill`
  - Body: `start_time?`, `end_time?`, `locations?`, `dry_run?`

## Environment Variables

Set on the Netlify site hosting the dashboard (used by Functions):

- `SUPABASE_URL` = `https://plksvatjdylpuhjitbfc.supabase.co`
- `SUPABASE_ANON_KEY` = publishable key
- `SUPABASE_SERVICE_ROLE_KEY` = service role (server-only; not exposed client-side)
- `API_ALLOWED_ORIGINS` = comma-separated origins allowed for CORS, e.g.
  - `https://gm-dashboard.getproductbox.com,https://api.getproductbox.com,http://localhost:8082,http://localhost:5173`

Frontend env:

- `VITE_API_BASE_URL` = `/.netlify/functions/api` (all Netlify contexts)

## CORS

API (Netlify Functions): Controlled by `API_ALLOWED_ORIGINS`.

Supabase Edge Functions: Controlled by `ALLOWED_ORIGINS` secret. Keep in sync with `docs/technical/allowed-origins.md`. Redeploy functions after changes.

## Smoke Tests

1) Health
```bash
curl -sS https://<site>.netlify.app/.netlify/functions/api/health
```

2) Create hold (replace values)
```bash
curl -sS -X POST \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -H "x-action: create" \
  -d '{
    "boothId":"<uuid>",
    "venue":"manor",
    "bookingDate":"2025-11-08",
    "startTime":"19:00",
    "endTime":"20:00",
    "sessionId":"cli-test"
  }' \
  https://<site>.netlify.app/.netlify/functions/api/karaoke/holds
```

3) Finalize (with holdId from step 2)
```bash
curl -sS -X POST \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "holdId":"<hold-uuid>",
    "customerName":"CLI Test"
  }' \
  https://<site>.netlify.app/.netlify/functions/api/karaoke/finalize
```

## Common Errors

- 401: Missing/invalid `Authorization` header.
- 400: Validation error (Zod). Check fields and `x-action`.
- 404: Hold not found (expired/invalid). Recreate a hold.
- 409: Conflict on booking insert. Unique index prevents double-booking; endpoint returns existing booking if detected.

## Operations Notes

- Change allowed origins:
  - API: update `API_ALLOWED_ORIGINS` in Netlify → redeploy
  - Supabase EFs: update `ALLOWED_ORIGINS` secret → redeploy affected functions
- DB uniqueness index name: `uq_karaoke_booking_slot`
- Service role is required in production for cross-table admin flows; never expose to frontend.


