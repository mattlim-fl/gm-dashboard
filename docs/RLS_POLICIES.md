# Row Level Security (RLS) Policies

This document outlines the Row Level Security policies implemented across all tables in the GM Dashboard database.

## Overview

All tables in the `public` schema have RLS enabled with appropriate policies to ensure data security while maintaining functionality for authenticated staff users.

## Security Model

### Authentication Requirements
- All policies require users to be authenticated (`authenticated` role)
- System operations use the `service_role` for automated processes
- No public access is granted to any table

### Access Levels

#### 1. **Full CRUD Access (Staff Tables)**
These tables allow authenticated users complete Create, Read, Update, Delete operations:

- `bookings` - Customer booking records
- `customers` - Customer information
- `email_templates` - Email template configurations
- `karaoke_booth_holds` - Temporary booth reservations
- `karaoke_booths` - Booth configuration
- `orders` - Processed order data
- `square_locations` - Square POS location data
- `staff_profiles` - Staff member information
- `venue_area_hours` - Venue operating hours
- `venue_areas` - Venue area configurations

**Policies Applied:**
- `Staff can view all [table]` (SELECT)
- `Staff can create [table]` (INSERT)
- `Staff can update [table]` (UPDATE)
- `Staff can delete [table]` (DELETE)

#### 2. **Read + System Write Access**
These tables allow staff to read data, but only the system can write:

- `email_events` - Email delivery tracking
- `square_orders_raw` - Raw Square order data
- `square_payments_raw` - Raw Square payment data

**Policies Applied:**
- `Staff can view [table]` (SELECT) - authenticated role
- `System can insert [table]` (INSERT) - service_role

#### 3. **Read + System Update Access**
These tables allow staff to read and system to update:

- `revenue_events` - Revenue tracking data
- `square_location_sync_status` - Sync status tracking

**Policies Applied:**
- `Staff can view all [table]` (SELECT) - authenticated role
- `Staff can insert [table]` (INSERT) - authenticated role
- `Staff can update [table]` (UPDATE) - authenticated role
- `System can update [table]` (UPDATE) - service_role (where applicable)

## Table-Specific Details

### Core Business Tables
| Table | RLS Status | Staff Access | System Access |
|-------|------------|--------------|---------------|
| `bookings` | ✅ Enabled | Full CRUD | None |
| `customers` | ✅ Enabled | Full CRUD | None |
| `orders` | ✅ Enabled | Full CRUD | None |
| `revenue_events` | ✅ Enabled | Read/Insert/Update | Update |

### Configuration Tables
| Table | RLS Status | Staff Access | System Access |
|-------|------------|--------------|---------------|
| `karaoke_booths` | ✅ Enabled | Full CRUD | None |
| `venue_areas` | ✅ Enabled | Full CRUD | None |
| `venue_area_hours` | ✅ Enabled | Full CRUD | None |
| `email_templates` | ✅ Enabled | Full CRUD | None |

### System/Integration Tables
| Table | RLS Status | Staff Access | System Access |
|-------|------------|--------------|---------------|
| `square_locations` | ✅ Enabled | Full CRUD | None |
| `square_orders_raw` | ✅ Enabled | Read Only | Insert |
| `square_payments_raw` | ✅ Enabled | Read Only | Insert |
| `square_location_sync_status` | ✅ Enabled | Read Only | Insert/Update |

### Staff & Communication Tables
| Table | RLS Status | Staff Access | System Access |
|-------|------------|--------------|---------------|
| `staff_profiles` | ✅ Enabled | Full CRUD | None |
| `karaoke_booth_holds` | ✅ Enabled | Full CRUD | None |
| `email_events` | ✅ Enabled | Read Only | Insert |

### API Credential Tables
| Table | RLS Status | Staff Access | System Access |
|-------|------------|--------------|---------------|
| `organizations` | ✅ Enabled | Read Only | Full CRUD |
| `venue_organizations` | ✅ Enabled | Read Only | Full CRUD |
| `venue_api_credentials` | ✅ Enabled | Read/Insert/Update | Full CRUD |

**Note:** Credentials in `venue_api_credentials` are encrypted with AES-256-GCM before storage. Only edge functions can decrypt them using the server-side encryption key.

## Policy Implementation Details

### Authentication Check
All policies use the standard authentication check:
```sql
USING (auth.uid() IS NOT NULL)
```

### Service Role Access
System operations use the service role for:
- Data synchronization from Square POS
- Email event tracking
- Sync status updates

### Policy Naming Convention
- Staff policies: `"Staff can [action] [table]"`
- System policies: `"System can [action] [table]"`

## Testing RLS Policies

### For Authenticated Users
- Should have full access to all business and configuration tables
- Should be able to read system tables but not modify them
- Dashboard functionality should work normally

### For Anonymous Users
- Should be blocked from accessing all tables
- Should receive authentication errors when attempting database operations

### For System Operations
- Edge functions using service role should work normally
- Sync operations should continue to function
- Automated processes should not be affected

## Maintenance

### Adding New Tables
When adding new tables to the database:

1. Enable RLS: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;`
2. Create appropriate policies based on the table's purpose
3. Test with both authenticated and anonymous users
4. Update this documentation

### Modifying Policies
When modifying existing policies:

1. Test changes in a development environment first
2. Ensure dashboard functionality remains intact
3. Update this documentation
4. Consider impact on existing integrations

### Monitoring
- Monitor Supabase logs for RLS policy violations
- Check dashboard functionality after policy changes
- Verify sync operations continue to work

## Security Considerations

### Current Approach
- **Permissive Model**: All authenticated users have full access
- **Suitable for**: Internal staff dashboard with trusted users
- **Benefits**: Simple to manage, no complex role hierarchies

### Future Enhancements
Consider implementing more granular access control:

1. **Role-based Access**: Different permissions for admin vs regular staff
2. **User-specific Restrictions**: Users can only see their own data
3. **Time-based Access**: Restrict access to business hours
4. **IP-based Restrictions**: Limit access to office networks
5. **Audit Logging**: Track who accessed what data when

## Troubleshooting

### Common Issues

#### Dashboard Not Loading
- Check if user is properly authenticated
- Verify RLS policies allow the required operations
- Check browser console for authentication errors

#### Sync Operations Failing
- Ensure service role has necessary permissions
- Verify system policies are correctly configured
- Check Edge function logs for RLS violations

#### Data Not Appearing
- Confirm user has SELECT permissions on the table
- Check if policies are too restrictive
- Verify authentication status

### Debugging Commands

```sql
-- Check RLS status for all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- List all policies
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test policy with current user
SELECT auth.uid(), auth.role();
```

## Last Updated
- **Date**: February 2026
- **Version**: 1.1
- **Status**: All tables secured with RLS policies
- **Changes**: Added API credential tables (organizations, venue_organizations, venue_api_credentials)
