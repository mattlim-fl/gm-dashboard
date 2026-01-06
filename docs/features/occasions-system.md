# Occasions System

## Overview

The Occasions system allows venue staff to create special event bookings where an organizer can invite guests to purchase tickets through a shared link. This is ideal for birthday parties, corporate events, and other group gatherings.

## Key Concepts

### Occasion (Parent Booking)

An occasion is a special booking type that serves as a "parent" for guest purchases:

- Created by staff or the organizer
- Has a capacity limit
- Generates a shareable link for guests
- Tracks all guest purchases as "child bookings"
- Manages guest list with organizer designation

### Guest Purchases (Child Bookings)

When guests purchase tickets through the shared link:

- A new booking is created with `parent_booking_id` pointing to the occasion
- The booking is linked via the occasion's `share_token`
- Capacity is checked before payment processing
- Guest appears in the occasion's guest list

## Database Schema

### Relevant Columns in `bookings` Table

```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  booking_type text, -- 'occasions' for parent, 'vip_tickets' for guests
  parent_booking_id uuid REFERENCES bookings(id), -- Links guest to occasion
  share_token text, -- Unique token for shared links
  guest_count integer, -- Capacity for occasions
  is_organiser boolean DEFAULT false, -- Flags the organizer
  ticket_quantity integer, -- Number of tickets purchased by guest
  -- ... other columns
);
```

### Key Relationships

```
Occasion (Parent Booking)
├── id: abc-123
├── booking_type: 'occasions'
├── share_token: 'xyz789'
├── guest_count: 50 (capacity)
├── is_organiser: true
└── Child Bookings
    ├── Guest 1
    │   ├── parent_booking_id: abc-123
    │   ├── ticket_quantity: 2
    │   └── is_organiser: false
    ├── Guest 2
    │   ├── parent_booking_id: abc-123
    │   ├── ticket_quantity: 3
    │   └── is_organiser: false
    └── ...
```

## Features

### 1. Creating an Occasion

**Location:** `/occasions` page in GM Dashboard

**Process:**
1. Staff clicks "Create Occasion"
2. Fills in occasion details:
   - Event name
   - Date and time
   - Venue
   - Capacity (max guests)
   - Organizer information
3. System creates occasion booking with:
   - `booking_type: 'occasions'`
   - Unique `share_token`
   - `is_organiser: true` for organizer
4. Shareable link is generated

**Code Reference:**
- Service: `src/services/occasionService.ts`
- Component: `src/pages/Occasions.tsx`

### 2. Sharing the Link

**Shareable Link Format:**
```
https://manor-website.com/occasion?token=xyz789
```

**What the Link Does:**
- Pre-fills the occasion details
- Shows remaining capacity
- Allows guest to purchase tickets
- Processes payment and creates child booking

### 3. Guest Purchase Flow

**Customer-Facing Website:**

1. Guest clicks shared link
2. Website displays occasion details and remaining capacity
3. Guest fills in their information:
   - Name
   - Email
   - Phone
   - Number of tickets
4. Guest enters payment information
5. Frontend calls `ticket-pay-and-book` edge function with:
   ```json
   {
     "parentBookingId": "abc-123",
     "groupToken": "xyz789",
     "ticketQuantity": 2,
     "paymentToken": "square-token",
     "customerName": "John Doe",
     "customerEmail": "john@example.com",
     "customerPhone": "+61400000000"
   }
   ```
6. Edge function:
   - Validates `share_token` matches occasion
   - **Checks capacity BEFORE charging payment**
   - Processes payment if capacity available
   - Creates child booking with `parent_booking_id`
   - Updates guest list
7. Guest receives confirmation email

### 4. Capacity Management

**Capacity Checking Logic:**

```typescript
// Calculate current guest count
const currentGuests = childBookings
  .filter(b => b.status !== 'cancelled')
  .reduce((sum, b) => sum + b.ticket_quantity, 0)

// Calculate remaining capacity
const remainingCapacity = occasion.guest_count - currentGuests

// Validate new purchase
if (ticketQuantity > remainingCapacity) {
  throw new Error(
    `Cannot add ${ticketQuantity} guests. ` +
    `Only ${remainingCapacity} spots remaining ` +
    `(capacity: ${occasion.guest_count})`
  )
}
```

**Where Capacity is Checked:**

1. **Before Payment** (Customer Purchase):
   - Edge function: `ticket-pay-and-book`
   - Prevents charging customers for unavailable spots

2. **Manual Guest Addition** (Staff):
   - Service: `occasionService.addManualGuestsToOccasion()`
   - UI: `OccasionDetailPanel` component
   - Input field capped at remaining capacity

**Documentation:**
- See `docs/capacity-constraints.md` for detailed implementation

### 5. Guest List Management

**Viewing Guest List:**

Location: `/occasions` page → Click occasion → Guest List tab

**Guest List Shows:**
- Guest name
- Email and phone
- Ticket quantity
- Payment status
- Check-in status
- Organizer flag

**Adding Manual Guests:**

Staff can add guests manually (e.g., for phone bookings):

1. Click "Add Guests" in occasion detail panel
2. Enter guest information
3. Enter number of tickets
4. System validates capacity
5. Creates booking without payment (staff handles payment separately)

**Code Reference:**
```typescript
// src/services/occasionService.ts
async addManualGuestsToOccasion(
  occasionId: string,
  guestData: {
    name: string,
    email: string,
    phone: string,
    ticketQuantity: number
  }
)
```

### 6. Organizer Management

**Organizer Flag:**

The `is_organiser` column identifies the main organizer:

- Set to `true` for the organizer's booking
- Set to `false` for all guest bookings
- Used to distinguish organizer in guest list
- Helps with communication and coordination

**Use Cases:**
- Display organizer prominently in guest list
- Send organizer-specific communications
- Grant organizer special privileges (future)

## User Interface

### Occasions Page (`/occasions`)

**Main View:**
- List of all occasions
- Filters: date range, venue, status
- Search by event name or organizer
- Create new occasion button

**Occasion Detail Panel:**

Tabs:
1. **Details**: Event information, capacity, status
2. **Guest List**: All guests with ticket counts
3. **Actions**: Add guests, share link, cancel occasion

**Key Metrics:**
- Total capacity
- Current guest count
- Remaining capacity
- Total revenue

### Components

**Main Components:**
- `src/pages/Occasions.tsx` - Main occasions page
- `src/components/occasions/OccasionDetailPanel.tsx` - Detail view
- `src/components/occasions/OccasionList.tsx` - List view
- `src/components/occasions/GuestList.tsx` - Guest list display

**Services:**
- `src/services/occasionService.ts` - Business logic

## Edge Function Integration

### ticket-pay-and-book

**Purpose:** Process guest ticket purchases for occasions

**Key Parameters:**
```typescript
{
  parentBookingId?: string,  // Occasion ID
  groupToken?: string,        // Share token for validation
  ticketQuantity: number,     // Number of tickets
  paymentToken: string,       // Square payment token
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  venue: string,
  bookingDate: string
}
```

**Capacity Validation:**
```typescript
// Check capacity BEFORE charging payment
if (parentBookingId) {
  const occasion = await getOccasion(parentBookingId)
  const currentGuests = await getCurrentGuestCount(parentBookingId)
  const remainingCapacity = occasion.guest_count - currentGuests
  
  if (ticketQuantity > remainingCapacity) {
    return {
      success: false,
      error: `Cannot add ${ticketQuantity} guests. Only ${remainingCapacity} spots remaining`
    }
  }
}

// Process payment only if capacity available
const payment = await processSquarePayment(paymentToken, amount)

// Create child booking
const booking = await createBooking({
  parent_booking_id: parentBookingId,
  ticket_quantity: ticketQuantity,
  // ... other fields
})
```

**Response:**
```json
{
  "success": true,
  "bookingId": "guest-booking-uuid",
  "paymentId": "square-payment-id",
  "remainingCapacity": 15
}
```

## Business Rules

### Capacity Constraints

1. **Hard Limit**: Cannot exceed occasion capacity
2. **Pre-Payment Check**: Capacity validated before charging customer
3. **Real-Time Updates**: Capacity recalculated on each purchase
4. **Cancelled Bookings**: Excluded from capacity calculation

### Booking Status

**Occasion Statuses:**
- `confirmed` - Active occasion, accepting guests
- `completed` - Event has occurred
- `cancelled` - Occasion cancelled (all guest bookings should be cancelled)

**Guest Booking Statuses:**
- `confirmed` - Guest ticket purchased and confirmed
- `cancelled` - Guest cancelled their ticket (frees up capacity)

### Payment Handling

**Guest Purchases:**
- Payment processed via Square API
- Payment must succeed before booking is created
- If payment fails, capacity is not affected

**Manual Guest Addition:**
- No payment processing
- Staff handles payment separately
- Capacity still enforced

## Security & Access Control

### RLS Policies

**Occasions (Parent Bookings):**
- Staff can view occasions for their venue
- Admins can view all occasions
- Customers cannot directly access occasions table

**Guest Bookings (Child Bookings):**
- Follow standard booking RLS policies
- Linked via `parent_booking_id`

### Share Token Security

**Token Generation:**
```typescript
// Generate unique, hard-to-guess token
const shareToken = crypto.randomUUID()
```

**Token Validation:**
- Edge function validates token matches occasion
- Token required for guest purchases
- Token can be regenerated if compromised

### Data Privacy

- Guest information only visible to staff
- Organizer can see guest list (future feature)
- Email addresses not shared between guests

## Common Use Cases

### 1. Birthday Party

**Scenario:**
- Organizer books venue for 30 people
- Shares link with friends
- Friends purchase their own tickets
- Staff tracks guest list and capacity

**Setup:**
1. Create occasion: "Sarah's 30th Birthday"
2. Set capacity: 30
3. Share link with guests
4. Monitor guest list as purchases come in

### 2. Corporate Event

**Scenario:**
- Company books venue for team event
- Employees purchase tickets via shared link
- Company tracks attendance
- Some guests added manually (phone bookings)

**Setup:**
1. Create occasion: "Tech Corp Team Building"
2. Set capacity: 50
3. Share link via company email
4. Add manual guests for phone bookings
5. Export guest list for check-in

### 3. Wedding Reception

**Scenario:**
- Couple books full venue
- Guests RSVP via shared link
- Couple tracks confirmed guests
- Capacity management for venue limits

**Setup:**
1. Create occasion: "John & Jane Wedding"
2. Set capacity: 100
3. Share link with wedding invitations
4. Monitor RSVPs in real-time
5. Close bookings when capacity reached

## Troubleshooting

### "Capacity Exceeded" Error

**Cause:** More tickets requested than available

**Solution:**
1. Check current guest count
2. Verify capacity setting is correct
3. Check for cancelled bookings (should free capacity)
4. Consider increasing capacity if venue allows

### Guest Can't Access Link

**Cause:** Invalid or expired token

**Solution:**
1. Verify share token is correct
2. Check occasion status (must be confirmed)
3. Regenerate share token if needed
4. Ensure occasion date hasn't passed

### Duplicate Guest Purchases

**Cause:** Guest purchases multiple times

**Solution:**
1. Check guest list for duplicates
2. Cancel duplicate bookings
3. Process refund if needed
4. Consider adding email validation (future)

### Capacity Not Updating

**Cause:** Cancelled bookings still counted

**Solution:**
1. Verify booking status is 'cancelled'
2. Check capacity calculation logic
3. Refresh occasion detail panel
4. Check database directly if needed

## Future Enhancements

### Short Term
- [ ] Email validation to prevent duplicate guest purchases
- [ ] Organizer dashboard (view guest list without staff access)
- [ ] Automated reminder emails to guests
- [ ] QR code check-in for guests

### Medium Term
- [ ] Guest messaging system
- [ ] Dietary preferences and special requests
- [ ] Seating arrangements
- [ ] Guest plus-ones management

### Long Term
- [ ] Occasion templates for common event types
- [ ] Integration with calendar systems
- [ ] Automated waitlist management
- [ ] Guest survey and feedback collection

## Related Documentation

- **Capacity Constraints**: `docs/capacity-constraints.md`
- **Capacity Test Plan**: `docs/capacity-constraints-test-plan.md`
- **Edge Functions**: `docs/edge-functions.md`
- **Database Schema**: `docs/RLS_POLICIES.md`
- **Architecture**: `docs/technical/architecture-overview.md`

## API Reference

### Get Occasion Details

```typescript
// src/services/occasionService.ts
async getOccasion(occasionId: string): Promise<Occasion>
```

### Get Guest List

```typescript
async getOccasionGuests(occasionId: string): Promise<Booking[]>
```

### Add Manual Guest

```typescript
async addManualGuestsToOccasion(
  occasionId: string,
  guestData: GuestData
): Promise<Booking>
```

### Calculate Remaining Capacity

```typescript
async getRemainingCapacity(occasionId: string): Promise<number>
```

## Testing Checklist

When testing occasions:

- [ ] Create occasion with capacity
- [ ] Generate and copy share link
- [ ] Test guest purchase flow
- [ ] Verify capacity decreases
- [ ] Test capacity limit enforcement
- [ ] Test manual guest addition
- [ ] Verify organizer flag is set
- [ ] Test cancelled booking frees capacity
- [ ] Test payment failure doesn't affect capacity
- [ ] Verify guest list displays correctly
- [ ] Test share link on customer website
- [ ] Verify confirmation emails sent

## Support

For questions or issues with the Occasions system:

1. Check this documentation
2. Review capacity constraints docs
3. Check edge function logs
4. Verify database state
5. Contact development team

