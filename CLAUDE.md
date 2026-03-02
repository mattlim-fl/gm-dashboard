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

## Shared Utilities (`supabase/functions/_shared/`)

Edge functions share common utilities to avoid code duplication:

| Module | Purpose |
|--------|---------|
| `crypto.ts` | HMAC-SHA256, AES-256-GCM encryption, secure random code generation |
| `credentials.ts` | Per-venue/org/global API credential management with encryption |
| `square.ts` | Square API helpers (payments, refunds, orders) with retry logic |
| `retry.ts` | Exponential backoff with jitter for transient failures |
| `errors.ts` | Standardized error classes (`PaymentError`, `BookingError`, etc.) |
| `schemas.ts` | Zod schemas for runtime API response validation |
| `saturday-utils.ts` | Saturday numbering for YoY comparisons (see below) |
| `claude.ts` | Claude API client for email classification and draft generation |
| `gmail.ts` | Gmail API client (OAuth, fetch, draft, labels) |

### Usage in Edge Functions
```typescript
import { chargeSquare, refundSquarePayment } from "../_shared/square.ts"
import { generateSecureCode, encryptToken } from "../_shared/crypto.ts"
import { withRetry } from "../_shared/retry.ts"
import { PaymentError, errorResponse } from "../_shared/errors.ts"
import { getSameSaturdayLastYear, findSaturdayInRange } from "../_shared/saturday-utils.ts"
import { getSquareCredentials, getResendCredentials } from "../_shared/credentials.ts"
```

### API Credentials (`credentials.ts`)

API credentials are stored encrypted in `venue_api_credentials` with flexible scoping:

| Scope | Integration | Description |
|-------|-------------|-------------|
| **Per-venue** | Square, Gmail | Each venue has its own credentials |
| **Per-organization** | Xero | Grouped venues share one (e.g., Manor+Hippie share Noxfolk's Xero) |
| **Global** | Resend | Single account for all venues |

**Organization mapping:**
- `noxfolk` → manor, hippie
- `daisies` → daisy

**Key functions:**
```typescript
// Get credentials with env var fallback
const squareCreds = await getSquareCredentials(supabase, venue)
const resendCreds = await getResendCredentials(supabase)
const xeroCreds = await getXeroCredentials(supabase, venue)  // resolves to org-level
const gmailCreds = await getGmailCredentials(supabase, venue)

// Save credentials (encrypts automatically)
await saveCredentials(supabase, venue, 'square', { access_token, location_id })
```

**Fallback behavior:** If DB lookup fails, functions fall back to environment variables (`SQUARE_ACCESS_TOKEN`, `RESEND_API_KEY`, etc.) for backwards compatibility.

### Saturday Numbering (YoY Comparisons)

This is a Saturday-only trading business. YoY comparisons use **Saturday numbering** instead of calendar dates:

- "Saturday #15 of 2026" compares to "Saturday #15 of 2025"
- More meaningful than 52-week lookback (which drifts) or calendar subtraction (wrong day-of-week)

**Key functions:**
- `getSaturdayNumber(date)` - Returns 1-53 for which Saturday of the year
- `getSameSaturdayLastYear(date)` - Returns the corresponding Saturday from last year
- `findSaturdayInRange(start, end)` - Finds the Saturday within a date range

**Edge case:** If current year has 53 Saturdays but last year had 52, Saturday #53 maps to #52.

**Trade report boundaries:** Saturday 6am AWST → Sunday 6am AWST (captures full Saturday night trading 6pm-6am).

**Frontend equivalent:** `src/lib/saturday-utils.ts` (same functions for hooks)

## Testing Edge Functions

### Running Tests
From the `supabase/functions/` directory:
```bash
# Run all tests
deno task test

# Run specific test suites
deno task test:crypto   # Encryption, hashing, secure codes
deno task test:retry    # Retry logic, backoff timing
deno task test:square   # Idempotency keys, Square utilities
deno task test:claude   # Claude API client tests
deno task test:gmail    # Gmail API client tests
```

### Test Coverage
Tests are in `supabase/functions/_shared/__tests__/`:
- **crypto.test.ts** (18 tests) - HMAC, encryption round-trips, secure code generation
- **retry.test.ts** (16 tests) - Retry behavior, exponential backoff, max retries
- **square.test.ts** (10 tests) - Idempotency keys, utility functions
- **saturday-utils.test.ts** (29 tests) - Saturday numbering, YoY mapping, edge cases
- **claude.test.ts** - Claude API client, classification parsing
- **gmail.test.ts** - Gmail API client, message parsing, draft creation

### Writing New Tests
```typescript
// Example test structure
Deno.test("description of test", async () => {
  const result = await someFunction()
  assertEquals(result, expected)
})
```

## Key Edge Functions

| Function | Purpose |
|----------|---------|
| `send-email` | Email notifications (booking confirmations, reminders) |
| `karaoke-availability` | Check booth availability |
| `karaoke-pay-and-book` | Process karaoke booking with payment |
| `ticket-pay-and-book` | Process ticket purchases |
| `trade-report` | Weekly trade report notifications |
| `business-performance` | Weekly P&L notifications |
| `email-agent-scheduler` | Cron-triggered poller for email agent |
| `email-agent-process` | Main email processing orchestrator |
| `email-agent-oauth` | Gmail OAuth callback handler |
| `save-credentials` | Save encrypted API credentials to database |
| `test-credentials` | Test API credential connectivity |
| `xero-oauth` | Xero OAuth callback handler |

## Testing Email Templates

Go to **Settings → Notifications tab** to test email templates:
- Select venue (Manor / Hippie Club)
- Enter test email address
- Click "Send Test Email" or "Preview"

## API Integrations Settings

Go to **Settings → API Integrations tab** to manage API credentials:

### Per-Venue Credentials
- **Square**: Access token + Location ID (each venue has its own Square account)
- **Gmail**: OAuth connect for email agent (each venue has its own inbox)

### Organization Credentials
- **Xero**: OAuth connect for financial reporting (shared across venues in same org)

### Global Credentials
- **Resend**: API key for email delivery (single account for all venues)

### Required Environment Variables

For OAuth flows to work, these must be set in Supabase Edge Function secrets:

| Variable | Purpose |
|----------|---------|
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256 key for encrypting stored credentials (or reuse `TOKEN_ENCRYPTION_KEY`) |
| `XERO_CLIENT_ID` | Xero OAuth app client ID |
| `XERO_CLIENT_SECRET` | Xero OAuth app client secret |

Existing env vars (`SQUARE_ACCESS_TOKEN`, `RESEND_API_KEY`, etc.) continue to work as fallbacks.

## UI Patterns

### Detail Views: Sidepanels over Modals

When displaying detail views for records (customers, members, bookings, etc.), **prefer right sidepanels (Sheet) over centered modals (Dialog)**.

**Why sidepanels:**
- Users can still see the list/table context behind the panel
- Better for workflows where users navigate between multiple records
- More natural for editing forms with multiple fields
- Consistent with the app's established patterns

**When to use modals:**
- Quick confirmations ("Are you sure?")
- Simple single-action dialogs (e.g., "Add X guests")
- Alerts and notifications

**Implementation:**
```tsx
// Use Sheet from @/components/ui/sheet
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

<Sheet open={isOpen} onOpenChange={onClose}>
  <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Record Details</SheetTitle>
    </SheetHeader>
    {/* Content */}
  </SheetContent>
</Sheet>
```

**Existing examples:**
- `CustomerProfilePanel` - Customer details and editing
- `MemberProfilePanel` - Member details and editing
- `BookingDetailsSidebar` - Booking details and editing
- `OccasionDetailPanel` - Occasion/event details

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
