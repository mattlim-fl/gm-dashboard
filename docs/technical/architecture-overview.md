# GM Dashboard - Architecture Overview

## System Architecture

GM Dashboard is a modern web application built on a serverless architecture with clear separation between frontend, backend, and external integrations.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│                    Hosted on Netlify CDN                         │
│  - React 18 + TypeScript                                        │
│  - TanStack Query for state management                          │
│  - shadcn/ui component library                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Supabase Backend                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              PostgreSQL Database                        │    │
│  │  - Row Level Security (RLS)                            │    │
│  │  - Real-time subscriptions                             │    │
│  │  - Automated backups                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Edge Functions (Deno)                      │    │
│  │  - Booking APIs                                        │    │
│  │  - Payment processing                                  │    │
│  │  - Data sync                                           │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Authentication                             │    │
│  │  - Email/password auth                                 │    │
│  │  - Session management                                  │    │
│  │  - Role-based access control                           │    │
│  └────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐   ┌────────▼───────┐   ┌──────▼───────┐
│ Square API   │   │   Xero API     │   │  Gmail API   │
│ - Payments   │   │   - P&L data   │   │  - Email     │
│ - Per-venue  │   │   - Per-org    │   │  - Per-venue │
└──────────────┘   └────────────────┘   └──────────────┘
        │
┌───────▼──────┐
│ Resend API   │
│ - Email send │
│ - Global     │
└──────────────┘
```

## Technology Stack

### Frontend

**Framework & Build**
- React 18.3 with TypeScript 5.5
- Vite 7.1 for fast builds and HMR
- React Router v6 for client-side routing

**State Management**
- TanStack Query v5 for server state (queries, mutations, caching)
- React Context for auth and theme state
- React Hook Form for form state

**UI & Styling**
- Tailwind CSS 3.4 for utility-first styling
- shadcn/ui components (Radix UI primitives)
- Lucide React for icons
- Recharts for data visualization

**Key Libraries**
- `@supabase/supabase-js` - Supabase client
- `react-hook-form` + `zod` - Form validation
- `date-fns` - Date manipulation
- `sonner` - Toast notifications

### Backend

**Database**
- PostgreSQL (via Supabase)
- Row Level Security (RLS) for access control
- Automated migrations via SQL files
- Real-time subscriptions support

**Edge Functions**
- Deno runtime (TypeScript)
- Serverless deployment
- CORS support for web clients
- Environment variable configuration

**Authentication**
- Supabase Auth (email/password)
- JWT-based sessions
- Role-based access control (RBAC)
- Email whitelist system

### External Integrations

**Square API**
- Payment processing
- Payment sync for revenue tracking
- Location management
- Per-venue credentials (each venue has its own Square account)

**Xero API**
- Profit & Loss data sync
- OAuth2 authentication
- Cached snapshots for performance
- Per-organization credentials (grouped venues share one Xero account)

**Gmail API**
- Email agent for automated responses
- OAuth2 authentication
- Per-venue credentials (each venue has its own inbox)

**Resend API**
- Transactional email delivery
- Global credentials (single account for all venues)

## Database Schema

### Core Tables

#### bookings
Primary table for all booking types.

**Key Columns:**
- `id` (uuid, PK)
- `customer_id` (uuid, FK → customers)
- `booking_type` (text) - `venue_hire`, `karaoke`, `vip_tickets`, `occasions`
- `venue` (text) - `manor`, `hippie`
- `venue_area` (text) - `upstairs`, `downstairs`, `full_venue`, etc.
- `booking_date` (date)
- `start_time` (time)
- `end_time` (time)
- `guest_count` (integer)
- `status` (text) - `confirmed`, `pending`, `cancelled`, `completed`
- `total_price` (numeric)
- `parent_booking_id` (uuid, FK → bookings) - For occasion guests
- `share_token` (text) - For shared booking links
- `ticket_checkins` (jsonb) - Check-in tracking
- `is_organiser` (boolean) - Flags occasion organizer
- `created_at`, `updated_at`

**Indexes:**
- `booking_date`, `venue`, `status`
- `customer_id`, `parent_booking_id`

#### customers
Customer information and contact details.

**Key Columns:**
- `id` (uuid, PK)
- `name` (text)
- `email` (text, unique)
- `phone` (text)
- `created_at`, `updated_at`

#### team_members
Staff accounts with role-based access.

**Key Columns:**
- `id` (uuid, PK)
- `email` (text, unique)
- `name` (text)
- `role` (text) - `staff`, `admin`
- `venue` (text) - Assigned venue
- `created_at`

#### allowed_emails
Email whitelist for account creation.

**Key Columns:**
- `id` (uuid, PK)
- `email` (text, unique)
- `role` (text) - Default role for this email
- `invited_by` (uuid, FK → team_members)
- `invited_at` (timestamp)

### Karaoke Tables

#### karaoke_booths
Booth definitions and configuration.

**Key Columns:**
- `id` (uuid, PK)
- `name` (text) - Display name
- `venue` (text)
- `capacity` (integer)
- `hourly_rate` (numeric)
- `available` (boolean)
- `created_at`, `updated_at`

#### karaoke_holds
Temporary holds during booking checkout.

**Key Columns:**
- `id` (uuid, PK)
- `booth_id` (uuid, FK → karaoke_booths)
- `booking_date` (date)
- `start_time` (time)
- `end_time` (time)
- `hold_token` (text, unique)
- `expires_at` (timestamp)
- `created_at`

**Notes:**
- Holds expire after 15 minutes
- Prevents double-booking during checkout
- Cleaned up automatically

### Financial Tables

#### revenue_events
Synced Square payment data.

**Key Columns:**
- `id` (uuid, PK)
- `square_payment_id` (text, unique)
- `location_id` (text)
- `amount_money` (jsonb) - `{ amount, currency }`
- `status` (text)
- `created_at` (timestamp) - Square payment time
- `synced_at` (timestamp) - When synced to our DB

#### square_locations
Square location metadata.

**Key Columns:**
- `id` (text, PK) - Square location ID
- `name` (text)
- `venue_mapping` (text) - Maps to our venue names
- `created_at`, `updated_at`

### API Credential Tables

#### organizations
Organization groupings for venues.

**Key Columns:**
- `id` (text, PK) - e.g., 'noxfolk', 'daisies'
- `name` (text) - Display name
- `created_at` (timestamp)

**Default Data:**
- `noxfolk` → "Noxfolk" (owns Manor, Hippie Club)
- `daisies` → "Daisies" (owns Daisy)

#### venue_organizations
Maps venues to their parent organizations.

**Key Columns:**
- `venue` (text, PK) - e.g., 'manor', 'hippie', 'daisy'
- `organization_id` (text, FK → organizations)

#### venue_api_credentials
Encrypted API credentials with flexible scoping.

**Key Columns:**
- `id` (uuid, PK)
- `venue` (text, nullable) - Set for per-venue credentials (Square, Gmail)
- `organization_id` (text, nullable, FK → organizations) - Set for per-org credentials (Xero)
- `integration_type` (text) - 'square', 'xero', 'gmail', 'resend'
- `credentials_encrypted` (text) - AES-256-GCM encrypted JSON
- `is_active` (boolean)
- `last_verified_at` (timestamp)
- `verification_status` (text) - 'pending', 'verified', 'failed'
- `verification_error` (text)
- `oauth_expires_at` (timestamp)
- `created_at`, `updated_at`

**Scoping Logic:**
- Per-venue (Square, Gmail): `venue` is set, `organization_id` is null
- Per-organization (Xero): `venue` is null, `organization_id` is set
- Global (Resend): Both `venue` and `organization_id` are null

**Unique Constraint:** One credential per scope+type combination via unique index.

#### xero_pnl_snapshots
Cached Xero P&L data.

**Key Columns:**
- `id` (uuid, PK)
- `tenant_id` (text)
- `report_date` (date)
- `data` (jsonb) - Full P&L report
- `fetched_at` (timestamp)

## Data Flow Patterns

### Booking Creation Flow

```
1. User fills booking form
   ↓
2. Frontend validates with Zod schema
   ↓
3. Frontend calls edge function (e.g., karaoke-book)
   ↓
4. Edge function validates availability
   ↓
5. Edge function creates booking in database
   ↓
6. RLS policies enforce access control
   ↓
7. Edge function sends confirmation email
   ↓
8. Frontend receives response
   ↓
9. TanStack Query invalidates cache
   ↓
10. UI updates with new booking
```

### Payment Flow (Customer-Facing)

```
1. Customer fills booking form
   ↓
2. Frontend creates temporary hold
   ↓
3. Frontend collects payment via Square Web SDK
   ↓
4. Square returns payment token
   ↓
5. Frontend calls pay-and-book edge function
   ↓
6. Edge function validates hold
   ↓
7. Edge function charges payment via Square API
   ↓
8. If payment succeeds, create booking
   ↓
9. If payment fails, release hold and return error
   ↓
10. Send confirmation email
   ↓
11. Return booking details to frontend
```

### Square Sync Flow

```
1. Cron trigger (every 6 hours)
   ↓
2. sync-scheduler edge function invoked
   ↓
3. Calls sync-and-transform function
   ↓
4. Fetches payments from Square API (last 7 days)
   ↓
5. Fetches location data
   ↓
6. Transforms to revenue_events format
   ↓
7. Inserts into database (handles duplicates)
   ↓
8. Logs results for monitoring
```

### Occasion Guest Purchase Flow

```
1. Organizer creates occasion booking
   ↓
2. System generates share_token
   ↓
3. Organizer shares link with guests
   ↓
4. Guest clicks link and fills form
   ↓
5. Frontend includes parentBookingId in request
   ↓
6. Edge function checks capacity BEFORE payment
   ↓
7. If capacity available, process payment
   ↓
8. Create child booking with parent_booking_id
   ↓
9. Update occasion guest list
   ↓
10. Send confirmation to guest
```

## Security Architecture

### Row Level Security (RLS)

All tables have RLS policies that enforce:

**Staff Access:**
- Can view/edit bookings for their assigned venue
- Can view/edit customers
- Cannot access financial data

**Admin Access:**
- Full access to all data
- Can manage team members
- Can view revenue and P&L

**Public Access:**
- No direct database access
- All operations via edge functions
- Edge functions validate permissions

### Authentication Flow

```
1. User enters email/password
   ↓
2. Supabase Auth validates credentials
   ↓
3. Check if email in allowed_emails table
   ↓
4. Check team_members for role
   ↓
5. Return JWT with user metadata
   ↓
6. Frontend stores session
   ↓
7. All requests include JWT
   ↓
8. RLS policies check auth.uid() and role
```

### API Security

**Edge Functions:**
- Validate all input parameters
- Check authentication status
- Enforce business rules (capacity, availability)
- Rate limiting via caching
- CORS restrictions via allowlist

**Database:**
- RLS policies on all tables
- Service role key never exposed to frontend
- Anon key used for frontend (limited permissions)
- API credentials encrypted with AES-256-GCM before storage
- Credentials encryption key stored as environment variable

**Credential Storage:**
- All API credentials (Square, Xero, Gmail, Resend) stored encrypted in `venue_api_credentials`
- Encryption/decryption happens in edge functions only
- Frontend never has access to raw credentials
- Verification status tracked for monitoring

## Performance Optimizations

### Frontend

**Code Splitting:**
- Route-based code splitting via React Router
- Lazy loading for heavy components
- Dynamic imports for charts

**Caching:**
- TanStack Query caching (5-minute default)
- Aggressive caching for static data (venue config)
- Optimistic updates for mutations

**Asset Optimization:**
- Vite build optimization
- Tree shaking for unused code
- Minification and compression

### Backend

**Database:**
- Indexes on frequently queried columns
- Materialized views for complex queries (future)
- Connection pooling via Supabase

**Edge Functions:**
- In-memory caching (10-second TTL)
- Batch operations where possible
- Efficient SQL queries

**External APIs:**
- Cached Xero P&L data (daily refresh)
- Batched Square payment sync
- Rate limiting to avoid API limits

## Scalability Considerations

### Current Capacity

- **Database:** Supabase Pro plan (unlimited connections)
- **Edge Functions:** Serverless (auto-scaling)
- **Frontend:** CDN distribution (global)

### Growth Strategy

**Phase 1 (Current):**
- 3 venues (Manor, Hippie Club, Daisy)
- ~500 bookings/month
- 10-20 staff users

**Phase 2 (Next 6 months):**
- 5 venues
- ~2000 bookings/month
- 50 staff users

**Phase 3 (1-2 years):**
- 10+ venues
- ~5000 bookings/month
- 100+ staff users

### Scaling Strategies

**Database:**
- Partition large tables by date (future)
- Archive old bookings (future)
- Read replicas for analytics (future)

**Edge Functions:**
- Already serverless (auto-scales)
- Monitor cold start times
- Optimize function size

**Frontend:**
- Already on CDN (scales automatically)
- Implement virtual scrolling for large lists
- Lazy load heavy features

## Monitoring & Observability

### Current Monitoring

**Supabase Dashboard:**
- Database performance metrics
- Edge function logs and errors
- Authentication metrics
- Storage usage

**Netlify Dashboard:**
- Build status and logs
- Deploy previews
- Performance metrics

### Logging Strategy

**Edge Functions:**
- Log all errors with context
- Log important business events
- Include request IDs for tracing

**Frontend:**
- Console errors in development
- Error boundary for React errors
- TanStack Query DevTools in development

### Alerting (Future)

- Database connection pool exhaustion
- Edge function error rate spikes
- Payment processing failures
- Sync job failures

## Deployment Strategy

### Frontend Deployment

**Process:**
1. Push to main branch
2. Netlify detects changes
3. Runs `npm run build`
4. Deploys to CDN
5. Atomic deployment (zero downtime)

**Environments:**
- Production: `gm-dashboard.getproductbox.com`
- Preview: Auto-generated for PRs

### Edge Function Deployment

**Process:**
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy karaoke-availability
```

**Best Practices:**
- Test locally first
- Deploy during low-traffic periods
- Monitor logs after deployment
- Have rollback plan ready

### Database Migrations

**Process:**
1. Create migration file in `supabase/migrations/`
2. Test locally with `supabase db reset`
3. Review migration SQL
4. Apply to production via Supabase CLI
5. Verify with database queries

**Migration Naming:**
- Format: `YYYYMMDDHHMMSS-description.sql`
- Include RLS policies
- Include rollback comments

## Disaster Recovery

### Backup Strategy

**Database:**
- Supabase automated daily backups
- Point-in-time recovery (7 days)
- Manual backups before major changes

**Code:**
- Git repository (primary source of truth)
- Netlify build cache
- Local development copies

### Recovery Procedures

**Database Corruption:**
1. Identify corruption scope
2. Restore from Supabase backup
3. Replay recent transactions if needed
4. Verify data integrity

**Edge Function Failure:**
1. Check Supabase logs
2. Rollback to previous version
3. Fix issue locally
4. Redeploy fixed version

**Frontend Failure:**
1. Rollback Netlify deployment
2. Fix issue locally
3. Redeploy fixed version

## Future Architecture Improvements

### Short Term (3-6 months)

- [ ] Implement proper error tracking (Sentry)
- [ ] Add performance monitoring (Vercel Analytics)
- [ ] Implement rate limiting on edge functions
- [ ] Add automated testing (unit + integration)
- [ ] Set up staging environment

### Medium Term (6-12 months)

- [ ] Implement real-time updates via Supabase Realtime
- [ ] Add webhook system for external integrations
- [ ] Implement data archival strategy
- [ ] Add comprehensive audit logging
- [ ] Implement feature flags

### Long Term (1-2 years)

- [ ] Microservices for complex domains
- [ ] Event-driven architecture
- [ ] Advanced analytics with data warehouse
- [ ] Multi-region deployment
- [ ] Mobile app (React Native)

## Development Workflow

### Local Development

```bash
# Start frontend
npm run dev

# Start Supabase locally (optional)
supabase start

# Run migrations locally
supabase db reset

# Test edge functions locally
supabase functions serve
```

### Testing Strategy

**Current:**
- Manual testing of critical paths
- Database migration testing locally
- Edge function testing via curl/Postman

**Future:**
- Unit tests for business logic
- Integration tests for edge functions
- E2E tests for critical user flows
- Visual regression tests

### Code Review Process

1. Create feature branch
2. Implement changes
3. Test locally
4. Create pull request
5. Code review by team
6. Address feedback
7. Merge to main
8. Auto-deploy to production

## Troubleshooting Guide

### Common Issues

**"User not authenticated"**
- Check if user is logged in
- Verify JWT token is valid
- Check RLS policies

**"Booking not available"**
- Check for conflicting bookings
- Verify hold hasn't expired
- Check booth availability

**"Payment failed"**
- Check Square API credentials
- Verify payment token is valid
- Check Square dashboard for details

**"Capacity exceeded"**
- Check occasion capacity setting
- Verify guest count calculation
- Check for cancelled bookings

### Debug Tools

- Browser DevTools (Network, Console)
- React Query DevTools
- Supabase Dashboard (Logs, Database)
- Square Dashboard (Payments)
- Xero Dashboard (P&L)

## Conclusion

The GM Dashboard architecture is designed for:

- **Scalability**: Serverless architecture scales automatically
- **Security**: RLS policies and RBAC enforce access control
- **Performance**: Caching and optimization at every layer
- **Maintainability**: Clear separation of concerns
- **Reliability**: Automated backups and recovery procedures

The system is production-ready and actively serving multiple venues with plans for continued expansion.

