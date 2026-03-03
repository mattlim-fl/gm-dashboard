# Claude Code Instructions

## Quick Reference

### Before Writing Code
1. Check existing patterns in similar files
2. Use services from `src/services/`, not direct Supabase calls
3. Use hooks from `src/hooks/`, not raw React Query
4. Check `src/types/` and `src/schemas/` for existing types

### Key Files to Know
| Purpose | Location |
|---------|----------|
| Types | `src/types/{domain}.ts` |
| Services | `src/services/{domain}Service.ts` |
| Hooks | `src/hooks/use{Domain}.ts` |
| Schemas | `src/schemas/{domain}Schemas.ts` |
| Constants | `src/constants/{domain}Constants.ts` |
| Edge functions | `supabase/functions/{name}/index.ts` |
| Shared utils | `supabase/functions/_shared/*.ts` |
| Frontend utils | `src/utils/`, `src/lib/` |

### Common Commands
```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run test             # Run frontend tests (Vitest)
npm run test:run         # Run frontend tests once
npm run test:coverage    # Run frontend tests with coverage
deno task test           # Run edge function tests (from supabase/functions/)
npx supabase functions deploy <name>  # Deploy edge function
npx supabase db push     # Apply database migrations
```

---

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
| `config.ts` | **Centralized environment configuration** - use this instead of inline `Deno.env.get()` |
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
// Centralized config (use this instead of Deno.env.get)
import { config } from "../_shared/config.ts"
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)

// API credentials from database
import { getSquareCredentials, getResendCredentials } from "../_shared/credentials.ts"
const squareCreds = await getSquareCredentials(supabase, venue)
const resendCreds = await getResendCredentials(supabase)

// Other utilities
import { chargeSquare, refundSquarePayment } from "../_shared/square.ts"
import { generateSecureCode, encryptToken } from "../_shared/crypto.ts"
import { withRetry } from "../_shared/retry.ts"
import { PaymentError, errorResponse } from "../_shared/errors.ts"
import { getSameSaturdayLastYear, findSaturdayInRange } from "../_shared/saturday-utils.ts"
```

### Centralized Config (`config.ts`)

Edge functions should use the centralized config module instead of inline `Deno.env.get()` calls:

```typescript
import { config, isXeroConfigured, isGmailConfigured } from "../_shared/config.ts"

// Supabase (auto-injected by runtime)
config.supabaseUrl          // SUPABASE_URL
config.supabaseServiceKey   // SUPABASE_SERVICE_ROLE_KEY
config.supabaseAnonKey      // SUPABASE_ANON_KEY (optional)

// App settings
config.appUrl               // APP_URL (default: http://localhost:5173)
config.allowedOrigins       // ALLOWED_ORIGINS (parsed from comma-separated)
config.guestListSecret      // GUEST_LIST_SECRET

// Encryption
config.credentialsEncryptionKey  // CREDENTIALS_ENCRYPTION_KEY (required)

// OAuth credentials (for checking if configured)
config.xeroClientId         // XERO_CLIENT_ID
config.xeroClientSecret     // XERO_CLIENT_SECRET
config.gmailClientId        // GMAIL_CLIENT_ID
config.gmailClientSecret    // GMAIL_CLIENT_SECRET

// API keys
config.anthropicApiKey      // ANTHROPIC_API_KEY
config.openaiApiKey         // OPENAI_API_KEY
config.whatsappApiKey       // WHATSAPP_BUSINESS_API_KEY
```

### API Credentials (`credentials.ts`)

API credentials are stored encrypted in `venue_api_credentials` with flexible scoping:

| Scope | Integration | Description |
|-------|-------------|-------------|
| **Per-venue** | Gmail | Each venue has its own inbox |
| **Per-organization** | Square, Xero | Grouped venues share one (e.g., Manor+Hippie share Noxfolk's Square/Xero) |
| **Global** | Resend | Single account for all venues |

**Organization mapping:**
- `noxfolk` → manor, hippie
- `daisies` → daisy

**Key functions:**
```typescript
// Get credentials from database (no env var fallbacks)
const squareCreds = await getSquareCredentials(supabase, venue)
const resendCreds = await getResendCredentials(supabase)
const xeroCreds = await getXeroCredentials(supabase, venue)  // resolves to org-level
const gmailCreds = await getGmailCredentials(supabase, venue)

// Save credentials (encrypts automatically)
await saveCredentials(supabase, venue, 'square', { access_token })
```

**Note:** Credentials must be configured in the database via Settings → API Integrations. There are no environment variable fallbacks.

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
| `karaoke-holds` | Create/release temporary holds during booking checkout |
| `karaoke-book` | Create karaoke booking (staff use) |
| `karaoke-pay-and-book` | Process karaoke booking with payment (customer-facing) |
| `ticket-pay-and-book` | Process ticket purchases |
| `venue-config-api` | Return venue and area configuration |
| `sync-and-transform` | Sync Square payments and transform to revenue events |
| `sync-scheduler` | Scheduled trigger for automatic Square sync |
| `square-sync-backfill` | Backfill historical Square payment data |
| `list-catalog` | List Square catalog items |
| `trade-report` | Weekly trade report notifications (Sunday) |
| `weekly-summary` | Weekly summary notifications |
| `business-performance` | Weekly P&L notifications (Wednesday) |
| `email-agent-scheduler` | Cron-triggered poller for email agent |
| `email-agent-process` | Main email processing orchestrator |
| `email-agent-oauth` | Gmail OAuth callback handler |
| `save-credentials` | Save encrypted API credentials to database |
| `check-credentials-status` | Check status of stored credentials |
| `test-credentials` | Test API credential connectivity |
| `xero-oauth` | Xero OAuth callback handler |
| `update-cron-schedule` | Update cron job schedules |

**Note on `business-performance`:** This function sends emails directly via the Resend API instead of calling the `send-email` edge function. This avoids edge-function-to-edge-function HTTP calls, which can fail due to JWT issues with Supabase's gateway.

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

### Environment Variables

#### Supabase Edge Function Secrets
Set these in Supabase Dashboard → Edge Functions → Secrets:

| Variable | Required | Purpose |
|----------|----------|---------|
| `CREDENTIALS_ENCRYPTION_KEY` | **Yes** | AES-256 key (64-char hex) for encrypting stored credentials |
| `APP_URL` | No | App base URL for OAuth redirects (default: http://localhost:5173) |
| `XERO_CLIENT_ID` | For Xero | Xero OAuth app client ID |
| `XERO_CLIENT_SECRET` | For Xero | Xero OAuth app client secret |
| `GMAIL_CLIENT_ID` | For Gmail | Google Cloud OAuth client ID |
| `GMAIL_CLIENT_SECRET` | For Gmail | Google Cloud OAuth client secret |
| `ANTHROPIC_API_KEY` | For email agent | Claude API key for email classification |
| `GUEST_LIST_SECRET` | No | Secret for signing guest list tokens |

**Backup Keys (Workaround for Corrupted Reserved Secrets):**

Supabase reserved secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) can become corrupted and cannot be edited or deleted via CLI/UI. If this happens, set backup keys:

| Variable | Purpose |
|----------|---------|
| `SERVICE_ROLE_KEY_BACKUP` | Backup service role key (JWT, ~200 chars starting with `eyJ`) |
| `ANON_KEY_BACKUP` | Backup anon key (JWT, ~200 chars starting with `eyJ`) |

The `config.ts` module automatically tries backup keys first if they exist and are valid JWTs.

#### Netlify Environment Variables (API Server)
Set these in Netlify Dashboard → Site settings → Environment variables:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CREDENTIALS_ENCRYPTION_KEY` | Same as Supabase secrets |
| `XERO_CLIENT_ID` | Xero OAuth app client ID |
| `XERO_CLIENT_SECRET` | Xero OAuth app client secret |
| `XERO_REDIRECT_URI` | OAuth callback URL |
| `API_ALLOWED_ORIGINS` | CORS allowed origins |

**Important:** Square and Resend credentials are stored in the database, not as environment variables. Configure them via Settings → API Integrations.

---

## Error Handling Patterns

### Frontend Errors
Use the centralized error handler from `src/utils/errorHandling.ts`:
```typescript
import { handleError, handleErrorSilently, isNetworkError } from '@/utils/errorHandling'

// Standard error handling (shows toast + logs)
try {
  await bookingService.create(data)
} catch (error) {
  handleError(error, { operation: 'creating booking', component: 'BookingForm' })
}

// Silent error handling (logs only in development)
try {
  await analytics.track(event)
} catch (error) {
  handleErrorSilently(error, { operation: 'analytics tracking' })
}
```

### Edge Function Errors
Use standardized error classes from `_shared/errors.ts`:
```typescript
import { ValidationError, PaymentError, AuthError, errorResponse } from "../_shared/errors.ts"

// Throw typed errors
throw new ValidationError('Invalid booking date', 'booking_date')
throw new PaymentError('Square charge failed', paymentId, 500)
throw new AuthError()  // defaults to 'Unauthorized'

// Return consistent error responses (uses getStatusCode automatically)
return errorResponse(error, corsHeaders)
```

**Error classes available:**
- `ValidationError` - 400, for invalid input
- `AuthError` - 401, for authentication failures
- `NotFoundError` - 404, for missing resources
- `PaymentError` - 500, for payment processing failures
- `BookingError` - 500, for booking creation/update failures
- `ConfigError` - 500, for missing configuration

---

## Form Validation with Zod

Schemas are in `src/schemas/`. Follow these patterns:

### Base Schema with Extensions
```typescript
// src/schemas/bookingSchemas.ts
export const baseBookingSchema = z.object({
  customerName: z.string().min(2, "Customer name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  venue: z.enum(["manor", "hippie"], { required_error: "Please select a venue" }),
  bookingDate: z.string().min(1, "Please select a date"),
})

// Extended for specific forms
export const createBookingSchema = baseBookingSchema.extend({
  guestCount: z.string().min(1, "Required"),
})
```

### Cross-Field Validation with Refine
```typescript
export const createBookingSchema = baseBookingSchema
  .refine((data) => {
    // At least one contact method required
    return data.customerEmail || data.customerPhone
  }, {
    message: "Please provide either email or phone number",
    path: ["customerEmail"],  // Shows error on this field
  })
  .refine((data) => {
    // Conditional validation based on booking type
    if (data.bookingType === "venue_hire" && !data.venueArea) {
      return false
    }
    return true
  }, {
    message: "Please select a venue area for venue hire bookings",
    path: ["venueArea"],
  })

// Export inferred types
export type CreateBookingFormValues = z.infer<typeof createBookingSchema>
```

### Using with React Hook Form
```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { createBookingSchema, type CreateBookingFormValues } from "@/schemas/bookingSchemas"

const form = useForm<CreateBookingFormValues>({
  resolver: zodResolver(createBookingSchema),
  defaultValues: { venue: "manor", bookingDate: "" },
})
```

---

## React Query Cache Strategy

### Query Key Conventions
```typescript
// List queries include filters
['bookings', { venue, date, status }]
['customers', { venue, search }]

// Detail queries use ID
['booking', bookingId]
['customer', customerId]
```

### Invalidation Rules
- Creating/updating booking → invalidate `['bookings']` AND `['booking', id]`
- Updating customer → invalidate `['customer', id]` AND `['customers']`
- Always invalidate parent list when mutating children

### Standard Mutation Pattern
```typescript
// src/hooks/useBookings.ts
export const useUpdateBooking = () => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ id, data }) => bookingService.updateBooking(id, data),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] })
      toast({ title: "Booking Updated" })
    },
    onError: (error: Error) => {
      toast({
        title: "Error Updating Booking",
        description: error.message,
        variant: "destructive",
      })
    },
  })
}
```

---

## Testing

### Edge Functions (Deno)
Tests exist in `supabase/functions/_shared/__tests__/`:
```bash
# From supabase/functions/ directory
deno task test           # Run all tests
deno task test:crypto    # crypto.test.ts
deno task test:retry     # retry.test.ts
deno task test:square    # square.test.ts
deno task test:claude    # claude.test.ts
deno task test:gmail     # gmail.test.ts
```

### Frontend (Vitest)
Frontend tests use Vitest with React Testing Library:
```bash
npm run test             # Watch mode
npm run test:run         # Run once
npm run test:coverage    # Run with coverage report
```

**Test locations:**
- `src/lib/__tests__/` - Utility function tests (e.g., `saturday-utils.test.ts`)
- `src/{feature}/__tests__/{Component}.test.tsx` - Component tests

**Priority for new tests:** Business-critical paths (booking creation, payments, revenue calculations)

---

## Coding Practices (Avoiding Bloat)

### File Size Limits
- **Components:** Max ~300 lines. Split if larger.
- **Services:** Max ~200 lines per service file.
- **Pages:** If > 200 lines, extract sub-components.

### When to Split
- Component has > 3 distinct responsibilities
- Multiple large return blocks with conditional rendering
- Reusable logic that could benefit other components

### Anti-Patterns to Avoid
- **God components:** One component doing everything. Split by responsibility.
- **Inline types:** Define in `src/types/`, not in component files.
- **Inline validation:** Use `src/schemas/`, not ad-hoc validation.
- **Copy-paste code:** Extract to utilities or shared components.
- **Premature abstraction:** Don't create utilities for one-off logic.
- **Feature creep:** Implement only what's requested.

### Splitting Pattern
```
// Before: BookingForm.tsx (400 lines)
// After:
BookingForm.tsx           # Main form orchestration (~100 lines)
├── BookingFormFields.tsx # Form fields section (~100 lines)
├── BookingFormSummary.tsx # Summary/preview section (~80 lines)
└── useBookingForm.ts     # Form logic hook (~100 lines)
```

---

## Agent Development Workflow

### Before Making Changes
1. Read existing implementation of similar features
2. Check for reusable utilities in `src/utils/`, `src/lib/`, `_shared/`
3. Verify naming conventions match existing code
4. Check if types/schemas already exist

### Code Review Checklist (Self-Check)
- [ ] Using existing service pattern, not raw Supabase calls
- [ ] Using existing hooks, not raw React Query
- [ ] Types defined in `src/types/`, not inline
- [ ] Validation in `src/schemas/`, not component
- [ ] Error handling uses `handleError()` utility
- [ ] Query invalidation matches existing patterns
- [ ] No duplicate systems (see global CLAUDE.md)

---

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
