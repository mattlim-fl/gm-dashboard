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
| `square.ts` | Square API helpers (payments, refunds, orders) with retry logic |
| `retry.ts` | Exponential backoff with jitter for transient failures |
| `errors.ts` | Standardized error classes (`PaymentError`, `BookingError`, etc.) |
| `schemas.ts` | Zod schemas for runtime API response validation |

### Usage in Edge Functions
```typescript
import { chargeSquare, refundSquarePayment } from "../_shared/square.ts"
import { generateSecureCode, encryptToken } from "../_shared/crypto.ts"
import { withRetry } from "../_shared/retry.ts"
import { PaymentError, errorResponse } from "../_shared/errors.ts"
```

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
```

### Test Coverage
Tests are in `supabase/functions/_shared/__tests__/`:
- **crypto.test.ts** (18 tests) - HMAC, encryption round-trips, secure code generation
- **retry.test.ts** (16 tests) - Retry behavior, exponential backoff, max retries
- **square.test.ts** (10 tests) - Idempotency keys, utility functions

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
