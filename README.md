
# GM Admin - Venue Management Platform

A comprehensive staff management platform for GM's venue operations, starting with Manor's karaoke and venue hire services, then expanding to support multiple venues including Hippie Club.

## Project Overview

GM Admin is an **admin-only application** designed exclusively for venue staff and managers. This platform provides centralized operations management, automated administrative functions, and data-driven insights to reduce booking administration time by 80%.

### Key Features

- **Centralized Dashboard**: Real-time metrics, today's schedule, and quick actions
- **Booking Management**: Complete booking lifecycle for karaoke, venue hire, and VIP tickets
- **Occasions System**: Special event bookings with guest list management and capacity constraints
- **Customer Database**: Centralized customer information and booking history
- **Analytics & Reporting**: Revenue tracking, performance metrics, and trend analysis
- **Financial Integration**: Square payment sync and Xero P&L integration
- **Team Management**: Staff accounts with role-based access control (RBAC)
- **Multi-Venue Support**: Scalable architecture for managing multiple venues
- **Mobile Optimization**: Touch-friendly tools for venue floor management

### Target Users

- **Venue Managers**: Day-to-day operational oversight and performance monitoring
- **Staff Members**: Booking creation, customer service, and daily operations
- **Regional Managers**: Multi-venue oversight and strategic planning

## Implementation Roadmap

### Stage 1: Core Management Platform ✅
- Staff Dashboard with key metrics and quick actions
- Booking Management for Manor karaoke and venue hire
- Customer Database with booking history
- Basic automation for confirmations and notifications

### Stage 2: Advanced Analytics (In Progress)
- Enhanced reporting and customer segmentation
- Workflow automation and communication tools
- Administrative tools for promo codes and pricing
- Revenue intelligence and capacity optimization

### Stage 3: Multi-Venue Expansion
- Hippie Club integration
- Cross-venue booking management
- Comparative analytics and benchmarking
- Advanced mobile optimization

### Stage 4: Business Intelligence
- Predictive analytics and forecasting
- Performance optimization tools
- Scalability framework for new venues
- Strategic planning features

## Technologies Used

This project is built with modern web technologies:

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS for responsive design
- **UI Components**: shadcn/ui component library
- **State Management**: TanStack React Query
- **Icons**: Lucide React
- **Charts**: Recharts for analytics visualization
- **Backend**: Supabase for database and Edge Functions
- **Widget**: Standalone embeddable booking form

## Development Setup

### Prerequisites
- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Getting Started

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i

# Start development server
npm run dev
```

The application will be available at `http://localhost:8080` with hot-reload enabled.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (shadcn/ui)
│   ├── layout/         # AppSidebar, navigation components
│   ├── revenue/        # Revenue analytics components
│   ├── occasions/      # Occasion management components
│   └── auth/           # ProtectedRoute, AdminRoute
├── pages/              # Application pages/routes
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Bookings.tsx    # Booking list and management
│   ├── Occasions.tsx   # Special event bookings
│   ├── Revenue.tsx     # Square payment analytics (admin)
│   ├── ProfitAndLoss.tsx # Xero P&L integration (admin)
│   ├── Team.tsx        # Staff management (admin)
│   └── ...             # Other pages
├── contexts/           # React contexts (Auth, Theme)
├── services/           # Business logic and API calls
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── types/              # TypeScript type definitions
└── integrations/       # External service integrations (Supabase)

supabase/
├── functions/          # Edge functions (Deno)
│   ├── karaoke-availability/
│   ├── karaoke-book/
│   ├── ticket-pay-and-book/
│   ├── venue-config-api/
│   ├── sync-and-transform/
│   └── ...
└── migrations/         # Database schema migrations

public/
└── widget/             # Standalone booking widget files

docs/
├── product/            # Product documentation and PRDs
├── design/             # Design specifications and assets
├── technical/          # Technical documentation
└── user-guides/        # User manuals and guides
```

## Core Features

### Booking Types

The system supports multiple booking types:

1. **Venue Hire** - Full venue or area rentals (upstairs, downstairs, full venue)
2. **Karaoke Bookings** - Time-based booth reservations with availability checking
3. **VIP Tickets** - Event entry tickets with check-in tracking
4. **Occasions** - Special event bookings with:
   - Guest list management
   - Capacity constraints
   - Shared booking links for guest purchases
   - Organizer and guest tracking

### Square Integration

The system integrates with Square for payment processing and revenue tracking:

1. **Payment Sync**: `sync-and-transform` function fetches payments from Square API
2. **Data Storage**: Revenue data stored in `revenue_events` table
3. **Analytics**: Revenue page displays trends with monthly/weekly/yearly views
4. **Scheduled Updates**: Automatic sync via `sync-scheduler` function
5. **Backfill**: Historical data import via `square-sync-backfill`

### Xero Integration

Profit & Loss data is synced from Xero:

1. **OAuth Connection**: Stored in `xero_connections` table
2. **P&L Snapshots**: Cached in `xero_pnl_snapshots` table
3. **Manual Refresh**: Available in P&L page for admins

### RBAC (Role-Based Access Control)

Two-tier permission system:

- **Staff Role**: Can manage bookings, customers, and daily operations
- **Admin Role**: Full access including revenue, P&L, team management, and settings
- **Email Whitelist**: `allowed_emails` table controls who can create accounts
- **RLS Policies**: Database-level security enforces access control

## Deployment

### Production Deployment

The application is deployed to Netlify with automatic deployments from the main branch:

- **Frontend URL**: `https://gm-dashboard.getproductbox.com`
- **Deployment**: Automatic via Netlify (connected to Git repository)
- **Build Command**: `npm run build`
- **Publish Directory**: `dist/`

### Edge Functions Deployment

Supabase Edge Functions are deployed separately:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy karaoke-availability
```

### Widget Files

The booking widget files are located in `public/widget/` and are served as static assets.

## Success Metrics

- **Stage 1**: 100% of Manor venue hire bookings processed through the platform
- **Stage 3**: 100% of all bookings across all venues managed through the platform
- **Ultimate Goal**: 80% reduction in time spent on booking administration tasks

## Security & Compliance

- Role-based access control for different user types
- Complete audit trails for all booking and customer data changes
- Secure handling of customer information and payment data
- Staff authentication with session management
- API key authentication for external booking widget

## Support & Documentation

- **Development Guidelines**: See `.cursor/rules/gm-dashboard.mdc`
- **Product Requirements**: See `docs/product/prd/main-product-prd.md`
- **API Documentation**: See `docs/api-documentation.md`
- **Architecture**: See `docs/technical/architecture-overview.md`
- **RLS Policies**: See `docs/RLS_POLICIES.md`
- **Refactor History**: See `REFACTOR_SUMMARY.md`

## Contributing

This is an internal GM project. For development questions or feature requests, please contact the development team.

---

**Production URL**: https://gm-dashboard.getproductbox.com
