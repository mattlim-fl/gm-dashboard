# Capacity Constraints Implementation

## Overview
This document describes the capacity constraints implementation for occasions in the GM Dashboard and Manor website.

## Implementation Details

### 1. GM Dashboard - Manual Guest Addition

**Location**: `gm-dashboard/src/services/occasionService.ts` - `addManualGuestsToOccasion` method

**Behavior**:
- Before creating a manual booking, the system fetches the occasion's capacity
- Calculates current guest count by summing `ticket_quantity` from all non-cancelled child bookings
- Calculates remaining capacity: `capacity - currentGuestCount`
- Rejects the request if `guestCount > remainingCapacity`
- Returns a clear error message: `"Cannot add X guests. Only Y spots remaining (capacity: Z)"`

**UI Integration** (`gm-dashboard/src/components/occasions/OccasionDetailPanel.tsx`):
- The "Add Guests" dialog displays remaining capacity
- Input field is capped at `remaining_capacity`
- Input automatically adjusts if user tries to exceed capacity
- Submit button is disabled if `guestsToAdd > remaining_capacity`
- Error messages are displayed to the user via alert dialogs

### 2. Edge Function - Occasion Guest Purchases

**Location**: `gm-dashboard/supabase/functions/ticket-pay-and-book/index.ts`

**Behavior**:
- When `parentBookingId` is provided (occasion guest purchase), capacity is checked **before charging the card**
- Fetches the parent occasion's capacity
- Fetches all non-cancelled child bookings and calculates current guest count
- Calculates remaining capacity
- Rejects the purchase if `ticketQuantity > remainingCapacity`
- Returns error response: `{ success: false, error: "Cannot add X guests. Only Y spots remaining (capacity: Z)" }`

**Important**: The capacity check happens **before** the Square payment is processed, ensuring customers are never charged for bookings that would exceed capacity.

### 3. Data Flow

```
User Action (GM Dashboard)
  ↓
OccasionDetailPanel.confirmAddGuests()
  ↓
occasionService.addManualGuestsToOccasion()
  ↓
Check capacity in database
  ↓
Create booking OR throw error
```

```
User Action (Manor Website - Occasion Buy Page)
  ↓
Submit payment form with parentBookingId
  ↓
ticket-pay-and-book Edge Function
  ↓
Check capacity in database
  ↓
Charge Square payment OR return error
  ↓
Create booking
```

## Error Handling

### GM Dashboard
- Capacity errors are caught and displayed via `alert()` dialogs
- Error messages include specific details about remaining capacity
- The occasion list is refreshed after successful additions

### Manor Website
- Capacity errors are returned as `{ success: false, error: "..." }` responses
- The frontend should display these errors to users before they attempt payment
- No charges are made if capacity is exceeded

## Database Schema

The capacity tracking relies on:
- `bookings.capacity` - Maximum number of guests for the occasion
- `bookings.parent_booking_id` - Links child bookings to parent occasion
- `bookings.ticket_quantity` - Number of guests in each booking
- `bookings.status` - Only non-cancelled bookings count toward capacity

## Testing Checklist

- [ ] GM Dashboard: Try to add more guests than remaining capacity
- [ ] GM Dashboard: Add guests up to exact capacity
- [ ] GM Dashboard: Verify error messages are clear and accurate
- [ ] Manor Website: Try to purchase tickets exceeding capacity
- [ ] Manor Website: Verify no charge is made when capacity is exceeded
- [ ] Edge cases: Multiple simultaneous bookings (race conditions)
- [ ] Verify cancelled bookings don't count toward capacity

## Future Improvements

1. **Race Condition Handling**: Consider database-level constraints or locking to prevent simultaneous bookings from exceeding capacity
2. **Real-time Updates**: Use Supabase real-time subscriptions to update capacity in UI
3. **Waitlist**: Allow users to join a waitlist when capacity is reached
4. **Capacity Buffer**: Consider adding a small buffer (e.g., 95% capacity) to account for payment processing delays

