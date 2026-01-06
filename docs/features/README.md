# Feature Documentation

This directory contains detailed documentation for specific features in the GM Dashboard.

## Current Features

### [Occasions System](./occasions-system.md)
Complete guide to the occasions booking system including:
- Creating occasions
- Guest list management
- Capacity constraints
- Share link functionality
- Payment processing

**Related Docs:**
- [Capacity Constraints](../capacity-constraints.md)
- [Capacity Test Plan](../capacity-constraints-test-plan.md)

### [RBAC System](./rbac-system.md)
Role-based access control documentation including:
- Staff and admin roles
- Permission system
- Team management
- RLS policies
- Invitation system

**Related Docs:**
- [RLS Policies](../RLS_POLICIES.md)
- [Architecture Overview](../technical/architecture-overview.md)

## Planned Features

### QR Ticket System
Two implementation approaches documented:
- [Branch 1: URL-Based Scanning](../qr-tickets-branch-1-plan.md) - Simplified MVP
- [Branch 2: Alternative Approach](../qr-tickets-branch-2-plan.md)

**Status:** Planning phase

### Widget Integration
External booking widget for customer websites:
- [Widget Integration Guide](../widget-integration.md)
- [Widget Team Instructions](../widget-team-instructions.md)

**Status:** Implemented, documentation may need updates

## Documentation Standards

When documenting a new feature:

1. **Create a dedicated file** in this directory
2. **Include sections for:**
   - Overview and key concepts
   - Database schema
   - User interface
   - API endpoints
   - Business rules
   - Security considerations
   - Common use cases
   - Troubleshooting
   - Future enhancements

3. **Link to related docs:**
   - Edge functions
   - Database migrations
   - RLS policies
   - Architecture docs

4. **Update this README** with a link to the new feature doc

## Feature Documentation Template

```markdown
# Feature Name

## Overview
Brief description of the feature and its purpose.

## Key Concepts
Core concepts users need to understand.

## Database Schema
Relevant tables and columns.

## User Interface
How users interact with the feature.

## API Endpoints
Edge functions and endpoints used.

## Business Rules
Important rules and constraints.

## Security Considerations
Access control and data protection.

## Common Use Cases
Real-world scenarios and examples.

## Troubleshooting
Common issues and solutions.

## Future Enhancements
Planned improvements.

## Related Documentation
Links to other relevant docs.
```

## Finding Feature Documentation

### By Feature Type

**Booking Features:**
- Occasions System
- QR Tickets (planned)
- Widget Integration

**Administrative Features:**
- RBAC System
- Team Management

**Financial Features:**
- Revenue Analytics (see Architecture docs)
- P&L Integration (see Architecture docs)

### By User Role

**Staff Features:**
- Booking management
- Customer management
- Calendar and run sheets

**Admin Features:**
- RBAC System
- Team Management
- Revenue Analytics
- P&L Integration

## Contributing

When adding a new feature:

1. Document it as you build it
2. Use the template above
3. Include code examples
4. Add troubleshooting section
5. Link from this README
6. Update main README if major feature

