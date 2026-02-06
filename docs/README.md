# Documentation

## Quick Start

**New to project?**
1. `/README.md` - Setup and overview
2. `.cursor/rules/gm-dashboard.mdc` - Development guidelines
3. `docs/technical/architecture-overview.md` - System architecture

**Building features?**
1. `docs/IMPLEMENTATION_STATUS.md` - What's done/planned
2. `docs/edge-functions.md` - API reference
3. `docs/features/` - Feature-specific docs

## Essential Documentation

### Core Technical
- **`.cursor/rules/gm-dashboard.mdc`** ⭐ - AI coding guidelines, conventions, patterns
- **`technical/architecture-overview.md`** ⭐ - Complete system architecture, DB schema, data flows
- **`edge-functions.md`** ⭐ - All edge function APIs with examples
- **`RLS_POLICIES.md`** ⭐ - Database security policies

### Features
- **`features/occasions-system.md`** - Occasions with capacity management
- **`features/rbac-system.md`** - Role-based access control
- **`capacity-constraints.md`** - Capacity implementation details

### Product & Planning
- **`product/prd/main-product-prd.md`** - Product requirements
- **`IMPLEMENTATION_STATUS.md`** - Feature status and roadmap
- **`ROADMAP.md`** - GM Dashboard development roadmap

## Directory Structure

```
docs/
├── README.md (this file)
├── IMPLEMENTATION_STATUS.md     # Feature tracking
├── ROADMAP.md                   # Development roadmap
├── edge-functions.md            # API reference
├── RLS_POLICIES.md              # Security policies
├── api-runbook.md               # API operations guide
├── capacity-constraints.md      # Capacity implementation
├── technical/
│   ├── architecture-overview.md # System architecture ⭐
│   ├── allowed-origins.md
│   └── README.md
├── features/
│   ├── occasions-system.md      # Occasions feature ⭐
│   ├── rbac-system.md           # Access control ⭐
│   └── README.md
├── product/prd/
│   └── main-product-prd.md      # Product requirements
├── design/
│   └── design-spec.md
├── postman/                     # API testing collections
├── templates/                   # Documentation templates
├── user-guides/                 # End-user documentation
└── archive/                     # Historical/deprecated docs
```

## Documentation by Task

**Understand system:** `technical/architecture-overview.md`
**Create edge function:** `edge-functions.md` + `.cursor/rules/gm-dashboard.mdc`
**Work with database:** `technical/architecture-overview.md` (schema) + `RLS_POLICIES.md`
**Implement security:** `features/rbac-system.md` + `RLS_POLICIES.md`
**Work with occasions:** `features/occasions-system.md`
**Deploy:** `/README.md` (deployment section)

## Maintenance

**Always update docs when:**
- Adding features
- Changing DB schema
- Modifying edge functions
- Changing security/RLS policies

**Priority:**
1. **Critical:** Architecture, edge functions, RLS, RBAC, main README
2. **Important:** Feature docs, implementation guides
3. **Nice to have:** Planning docs, templates

## Recently Cleaned Up

The following interim/planning documents have been removed:
- ~~`qr-tickets-branch-1-plan.md`~~ - QR ticket planning (interim)
- ~~`qr-tickets-branch-2-plan.md`~~ - Alternative QR approach (interim)
- ~~`capacity-constraints-test-plan.md`~~ - Testing checklist (completed)
- ~~`notification-system-setup.md`~~ - One-time setup guide
- ~~`technical/README-edge-functions-centralisation.md`~~ - Migration note

## Archive

- **`archive/`** - Historical/deprecated docs and one-time migration guides
