# Role-Based Access Control (RBAC) System

## Overview

The GM Dashboard implements a two-tier role-based access control system to ensure staff members only have access to the features and data appropriate for their role.

## Roles

### Staff Role

**Permissions:**
- ✅ View and manage bookings for their assigned venue
- ✅ Create new bookings
- ✅ View and manage customers
- ✅ View calendar and run sheets
- ✅ Manage karaoke booths
- ✅ View and manage occasions
- ✅ Update their own profile
- ❌ View revenue analytics
- ❌ View profit & loss data
- ❌ Manage team members
- ❌ View other venues' data (unless admin)

### Admin Role

**Permissions:**
- ✅ All staff permissions
- ✅ View revenue analytics across all venues
- ✅ View profit & loss data
- ✅ Manage team members (invite, edit, remove)
- ✅ Access settings and configuration
- ✅ View data across all venues
- ✅ Manage system-wide settings

## Database Schema

### team_members Table

```sql
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('staff', 'admin')),
  venue text, -- Assigned venue for staff role
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### allowed_emails Table

Email whitelist for account creation and invitations.

```sql
CREATE TABLE allowed_emails (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('staff', 'admin')),
  invited_by uuid REFERENCES team_members(id),
  invited_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);
```

## Authentication Flow

### 1. Account Creation

```
1. Admin adds email to allowed_emails table
   ↓
2. User attempts to sign up with that email
   ↓
3. Supabase Auth creates account
   ↓
4. Trigger checks allowed_emails table
   ↓
5. If email found, create team_members record with specified role
   ↓
6. If email not found, reject signup
   ↓
7. User can now log in with assigned role
```

### 2. Login Flow

```
1. User enters email/password
   ↓
2. Supabase Auth validates credentials
   ↓
3. Query team_members table for user's role
   ↓
4. Return JWT with user metadata:
   {
     "user_id": "uuid",
     "email": "user@example.com",
     "role": "staff",
     "venue": "manor"
   }
   ↓
5. Frontend stores session
   ↓
6. All requests include JWT
   ↓
7. RLS policies enforce access control
```

## Frontend Implementation

### Protected Routes

**ProtectedRoute Component:**

Requires authentication but allows any role.

```tsx
// src/components/auth/ProtectedRoute.tsx
<Route path="/bookings" element={
  <ProtectedRoute>
    <Bookings />
  </ProtectedRoute>
} />
```

**AdminRoute Component:**

Requires authentication AND admin role.

```tsx
// src/components/auth/AdminRoute.tsx
<Route path="/revenue" element={
  <AdminRoute>
    <Revenue />
  </AdminRoute>
} />
```

### Route Configuration

```tsx
// src/App.tsx

// Staff + Admin routes
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
<Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
<Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
<Route path="/occasions" element={<ProtectedRoute><Occasions /></ProtectedRoute>} />
<Route path="/booth-management" element={<ProtectedRoute><BoothManagement /></ProtectedRoute>} />
<Route path="/run-sheet" element={<ProtectedRoute><RunSheet /></ProtectedRoute>} />
<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

// Admin-only routes
<Route path="/revenue" element={<AdminRoute><Revenue /></AdminRoute>} />
<Route path="/pnl" element={<AdminRoute><ProfitAndLoss /></AdminRoute>} />
<Route path="/team" element={<AdminRoute><Team /></AdminRoute>} />
```

### Auth Context

```tsx
// src/contexts/AuthContext.tsx

interface AuthContextType {
  user: User | null;
  profile: TeamMember | null;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Usage in components
const { isAdmin, profile } = useAuth();

if (isAdmin) {
  // Show admin features
}
```

## Backend Implementation (RLS Policies)

### Bookings Table

**Staff Policy:**
```sql
-- Staff can view bookings for their venue
CREATE POLICY "Staff can view own venue bookings"
ON bookings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.venue = bookings.venue
  )
);

-- Staff can insert bookings for their venue
CREATE POLICY "Staff can create own venue bookings"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.venue = bookings.venue
  )
);
```

**Admin Policy:**
```sql
-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
ON bookings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.role = 'admin'
  )
);

-- Admins can modify all bookings
CREATE POLICY "Admins can modify all bookings"
ON bookings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.role = 'admin'
  )
);
```

### Revenue Events Table

**Admin-Only Access:**
```sql
-- Only admins can view revenue data
CREATE POLICY "Admins only can view revenue"
ON revenue_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.role = 'admin'
  )
);
```

### Team Members Table

**Self-View Policy:**
```sql
-- Users can view their own record
CREATE POLICY "Users can view own profile"
ON team_members FOR SELECT
TO authenticated
USING (id = auth.uid());
```

**Admin Policy:**
```sql
-- Admins can view all team members
CREATE POLICY "Admins can view all team members"
ON team_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.role = 'admin'
  )
);

-- Admins can manage team members
CREATE POLICY "Admins can manage team members"
ON team_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.id = auth.uid()
    AND team_members.role = 'admin'
  )
);
```

## Invitation System

### Inviting New Team Members

**Process:**

1. Admin navigates to `/team` page
2. Clicks "Invite Team Member"
3. Fills in invitation form:
   - Email address
   - Role (staff or admin)
   - Venue (for staff role)
4. System adds email to `allowed_emails` table
5. Invitation email sent to user (future feature)
6. User can now sign up with that email

**Code Reference:**

```typescript
// src/services/teamService.ts
async inviteTeamMember(
  email: string,
  role: 'staff' | 'admin',
  venue?: string
): Promise<void> {
  // Add to allowed_emails table
  await supabase
    .from('allowed_emails')
    .insert({
      email,
      role,
      invited_by: currentUser.id
    });
  
  // Send invitation email (future)
  // await sendInvitationEmail(email);
}
```

### Database Trigger

Automatically creates team member record on signup:

```sql
-- Migration: 20251204134500-allowed-emails-invite-trigger.sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email is in allowed_emails
  IF EXISTS (
    SELECT 1 FROM allowed_emails
    WHERE email = NEW.email
  ) THEN
    -- Create team_members record
    INSERT INTO team_members (id, email, name, role, venue)
    SELECT 
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      allowed_emails.role,
      allowed_emails.venue
    FROM allowed_emails
    WHERE email = NEW.email;
  ELSE
    -- Reject signup if email not allowed
    RAISE EXCEPTION 'Email not authorized';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## UI Components

### Team Management Page

**Location:** `/team` (Admin only)

**Features:**
- List all team members
- View role and venue assignments
- Invite new team members
- Edit team member details
- Remove team members
- Filter by role and venue

**Components:**
- `src/pages/Team.tsx` - Main team page
- `src/components/team/TeamMemberList.tsx` - List view
- `src/components/team/InviteDialog.tsx` - Invitation form
- `src/components/team/TeamMemberCard.tsx` - Member details

### Conditional UI Elements

**Example: Hide admin features from staff**

```tsx
import { useAuth } from '@/contexts/AuthContext';

function Sidebar() {
  const { isAdmin } = useAuth();
  
  return (
    <nav>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/bookings">Bookings</NavLink>
      <NavLink to="/customers">Customers</NavLink>
      
      {isAdmin && (
        <>
          <NavLink to="/revenue">Revenue</NavLink>
          <NavLink to="/pnl">P&L</NavLink>
          <NavLink to="/team">Team</NavLink>
        </>
      )}
    </nav>
  );
}
```

## Security Considerations

### JWT Security

**Token Storage:**
- Stored in httpOnly cookies (Supabase handles this)
- Not accessible via JavaScript
- Automatically included in requests

**Token Expiration:**
- Tokens expire after 1 hour
- Refresh token used for renewal
- User logged out if refresh fails

### RLS Policy Security

**Defense in Depth:**
- Frontend checks role (UX)
- Backend enforces via RLS (security)
- Never trust frontend alone
- Always validate on backend

**Testing RLS:**
```sql
-- Test as staff user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "staff-user-id"}';

-- Try to access admin data
SELECT * FROM revenue_events; -- Should return 0 rows

-- Test as admin user
SET LOCAL request.jwt.claims TO '{"sub": "admin-user-id"}';
SELECT * FROM revenue_events; -- Should return all rows
```

### Preventing Privilege Escalation

**Protection Mechanisms:**

1. **RLS Policies**: Prevent direct database manipulation
2. **Edge Functions**: Validate permissions before operations
3. **Frontend Guards**: Prevent UI access to unauthorized features
4. **Audit Logging**: Track all permission changes (future)

**Example: Prevent staff from promoting themselves**

```sql
-- Staff cannot change their own role
CREATE POLICY "Users cannot change own role"
ON team_members FOR UPDATE
TO authenticated
USING (id != auth.uid())
WITH CHECK (id != auth.uid());
```

## Common Scenarios

### Scenario 1: New Venue Staff Member

**Steps:**
1. Admin adds email to `allowed_emails` with role='staff', venue='manor'
2. User signs up with that email
3. Trigger creates team_members record
4. User logs in and sees Manor bookings only
5. User cannot access revenue or admin features

### Scenario 2: Promoting Staff to Admin

**Steps:**
1. Admin navigates to Team page
2. Finds staff member in list
3. Clicks "Edit" and changes role to 'admin'
4. Updates team_members record
5. User logs out and back in
6. User now has admin access

### Scenario 3: Multi-Venue Staff

**Current Limitation:**
- Staff can only be assigned to one venue
- To access multiple venues, user needs admin role

**Future Enhancement:**
- Support multiple venue assignments
- Venue-specific permissions

### Scenario 4: Temporary Access

**Current Approach:**
1. Admin invites user with staff role
2. User completes work
3. Admin removes user from team_members
4. User can no longer log in

**Future Enhancement:**
- Temporary access with expiration dates
- Deactivate instead of delete (audit trail)

## Troubleshooting

### User Can't Sign Up

**Possible Causes:**
1. Email not in `allowed_emails` table
2. Email typo in invitation
3. User using different email than invited

**Solution:**
1. Check `allowed_emails` table for exact email
2. Add email if missing
3. Verify email spelling

### User Has Wrong Permissions

**Possible Causes:**
1. Wrong role in `team_members` table
2. User hasn't logged out/in after role change
3. RLS policy issue

**Solution:**
1. Check `team_members` table for correct role
2. Ask user to log out and back in
3. Test RLS policies directly

### Staff Can See Other Venues

**Possible Causes:**
1. User has admin role
2. RLS policy not working
3. Venue field not set correctly

**Solution:**
1. Check user's role in `team_members`
2. Verify RLS policies are enabled
3. Check venue field matches booking venue

### Admin Can't Access Admin Features

**Possible Causes:**
1. Role not set to 'admin' in database
2. Frontend not detecting admin role
3. Cache issue

**Solution:**
1. Check `team_members.role` in database
2. Check `useAuth()` hook returns `isAdmin: true`
3. Clear browser cache and log out/in

## Testing Checklist

When testing RBAC:

- [ ] Staff can view own venue bookings
- [ ] Staff cannot view other venue bookings
- [ ] Staff cannot access revenue page
- [ ] Staff cannot access P&L page
- [ ] Staff cannot access team page
- [ ] Admin can view all bookings
- [ ] Admin can access revenue page
- [ ] Admin can access P&L page
- [ ] Admin can access team page
- [ ] Admin can invite new users
- [ ] New user signup requires allowed email
- [ ] New user gets correct role
- [ ] Role changes take effect after re-login
- [ ] RLS policies enforce access control
- [ ] Edge functions validate permissions

## Future Enhancements

### Short Term
- [ ] Email invitations with signup links
- [ ] User deactivation (instead of deletion)
- [ ] Audit log for permission changes
- [ ] Password reset flow

### Medium Term
- [ ] Multi-venue staff assignments
- [ ] Granular permissions (e.g., read-only staff)
- [ ] Temporary access with expiration
- [ ] Team member activity tracking

### Long Term
- [ ] Custom roles with configurable permissions
- [ ] Permission groups/templates
- [ ] SSO integration (Google, Microsoft)
- [ ] Advanced audit logging and compliance

## Related Documentation

- **RLS Policies**: `docs/RLS_POLICIES.md`
- **Architecture**: `docs/technical/architecture-overview.md`
- **Edge Functions**: `docs/edge-functions.md`
- **Team Management**: User guide (future)

## API Reference

### Check User Role

```typescript
// src/contexts/AuthContext.tsx
const { isAdmin, isStaff, profile } = useAuth();
```

### Invite Team Member

```typescript
// src/services/teamService.ts
await teamService.inviteTeamMember(
  'newuser@example.com',
  'staff',
  'manor'
);
```

### Update Team Member Role

```typescript
await teamService.updateTeamMember(userId, {
  role: 'admin'
});
```

### Remove Team Member

```typescript
await teamService.removeTeamMember(userId);
```

## Database Queries

### Check User's Role

```sql
SELECT role, venue
FROM team_members
WHERE id = auth.uid();
```

### List All Admins

```sql
SELECT id, email, name
FROM team_members
WHERE role = 'admin';
```

### List Staff by Venue

```sql
SELECT id, email, name
FROM team_members
WHERE role = 'staff'
AND venue = 'manor';
```

### Check Allowed Emails

```sql
SELECT email, role, invited_at
FROM allowed_emails
ORDER BY invited_at DESC;
```

## Support

For RBAC-related questions or issues:

1. Check this documentation
2. Review RLS policies documentation
3. Test permissions with different user accounts
4. Check database state directly
5. Contact development team

