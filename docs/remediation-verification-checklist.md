# Remediation Verification Checklist (Credentials + Docs)

Use this checklist after deploying/applying the changes from the “Credential & Docs Remediation” work.

## A) Credential management is admin-only (UI)

- [ ] Sign in as a **staff** user.\n  - Navigate to `/settings`.\n  - Confirm there is **no “API Integrations” tab**.\n  - Navigate directly to `/settings?tab=integrations`.\n  - Confirm you are redirected to an allowed tab (e.g. Notifications) and cannot see integrations UI.

- [ ] Sign in as an **admin** user.\n  - Navigate to `/settings?tab=integrations`.\n  - Confirm integrations UI renders and allows viewing/saving/testing credentials.

## B) Credential management is admin-only (Edge Functions)

From the browser/app (or any client), as **staff**:

- [ ] Attempt to invoke `save-credentials`.\n  - Expect `403 Forbidden` (or `{ success:false, error:"Forbidden" }`).
- [ ] Attempt to invoke `test-credentials`.\n  - Expect `403 Forbidden`.

As **admin**:

- [ ] Invoke `save-credentials` for each integration (Square, Gmail, Xero, Resend).\n  - Expect `{ success: true }`.\n  - Confirm UI refresh shows “configured” state.\n- [ ] Invoke `test-credentials`.\n  - Expect `{ success: true, message: ... }` for valid credentials.\n  - Confirm `last_verified_at`/`verification_status` updates.

## C) Credential management is admin-only (Database/RLS)

Using Supabase SQL editor (impersonating a user JWT) or by validating via the app:

- [ ] As **staff**, attempts to `SELECT/INSERT/UPDATE` rows in `venue_api_credentials` should fail under RLS.\n+- [ ] As **admin**, `SELECT/INSERT/UPDATE` should succeed.\n+- [ ] Service-role edge functions should continue to work normally.

## D) Documentation consistency

- [ ] `README.md` Support & Documentation links resolve:\n  - `docs/api-runbook.md`\n  - `docs/edge-functions.md`\n  - `docs/RLS_POLICIES.md`\n  - `docs/technical/architecture-overview.md`\n  - `IMPLEMENTATION_SUMMARY.md`

- [ ] `docs/README.md` reflects the split:\n  - `api-runbook.md` = runtime Netlify API\n  - `edge-functions.md` = Supabase Edge Functions catalog

- [ ] `docs/weekly-notifications-setup.md` matches current function names:\n  - `trade-report`\n  - `business-performance`\n  - `update-cron-schedule`

## E) Smoke checks (dev)

- [ ] `npm run lint` passes.\n+- [ ] Start app and verify Settings tab behavior for admin vs staff.\n+
