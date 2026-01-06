# Capacity Constraints Test Plan

## Test Environment
- GM Dashboard: http://localhost:5173
- Manor Website: http://localhost:5174
- Edge Function: Deployed to Supabase

## Test Scenarios

### 1. GM Dashboard - Add Guests Dialog

#### Test 1.1: Display Remaining Capacity
**Steps**:
1. Open GM Dashboard
2. Navigate to Occasions page
3. Click on an occasion with some remaining capacity (e.g., 5/10 guests)
4. Click "Add guests" button
5. Observe the dialog

**Expected Result**:
- Dialog shows "X spots remaining (Capacity: Y)"
- Input field max value is set to remaining capacity

#### Test 1.2: Prevent Exceeding Capacity via Input
**Steps**:
1. In the Add Guests dialog
2. Try to enter a number greater than remaining capacity
3. Observe the input behavior

**Expected Result**:
- Input automatically adjusts to max remaining capacity
- Error message appears: "Cannot exceed remaining capacity"
- Submit button is disabled

#### Test 1.3: Add Guests Up to Capacity
**Steps**:
1. Add guests equal to remaining capacity
2. Click submit
3. Wait for success

**Expected Result**:
- Guests are added successfully
- Guest list updates
- Capacity shows 0 remaining

#### Test 1.4: Try to Add Guests When Full
**Steps**:
1. Find an occasion at full capacity
2. Try to click "Add guests" or "Add single guest"

**Expected Result**:
- Error alert: "Cannot add X guests. Only 0 spots remaining (capacity: Y)"

### 2. GM Dashboard - Add Single Guest

#### Test 2.1: Add Single Guest with Capacity
**Steps**:
1. Open an occasion with at least 1 spot remaining
2. Click "Add single guest" button at bottom of guest list

**Expected Result**:
- Single guest is added
- Guest list updates with new row
- Remaining capacity decreases by 1

#### Test 2.2: Add Single Guest at Full Capacity
**Steps**:
1. Open an occasion at full capacity
2. Click "Add single guest"

**Expected Result**:
- Error alert: "Cannot add 1 guests. Only 0 spots remaining (capacity: X)"

### 3. Manor Website - Occasion Guest Purchase

#### Test 3.1: Purchase Within Capacity
**Steps**:
1. Navigate to Manor website occasion buy page
2. Enter details for 2 guests (assuming capacity allows)
3. Complete payment form
4. Submit

**Expected Result**:
- Payment is processed
- Booking is created
- Confirmation page shows success

#### Test 3.2: Purchase Exceeding Capacity
**Steps**:
1. Find an occasion with only 2 spots remaining
2. Try to purchase 5 tickets
3. Complete payment form
4. Submit

**Expected Result**:
- Payment is NOT processed
- Error message: "Cannot add 5 guests. Only 2 spots remaining (capacity: X)"
- User is not charged

#### Test 3.3: Race Condition Test (Advanced)
**Steps**:
1. Find an occasion with 3 spots remaining
2. Open two browser windows
3. In both windows, try to purchase 2 tickets simultaneously
4. Submit both forms at the same time

**Expected Result**:
- First request succeeds (2 guests added, 1 spot remaining)
- Second request either:
  - Succeeds with 1 guest only, OR
  - Fails with capacity error
- Total guests never exceed capacity

### 4. Edge Cases

#### Test 4.1: Cancelled Bookings Don't Count
**Steps**:
1. Create an occasion with capacity 10
2. Add 5 guests
3. Cancel one booking (2 guests)
4. Check remaining capacity

**Expected Result**:
- Remaining capacity should be 7 (not 5)
- Cancelled bookings don't count toward capacity

#### Test 4.2: Organiser Doesn't Count Toward Capacity
**Steps**:
1. Create a new occasion with capacity 10
2. Check initial guest count

**Expected Result**:
- Organiser is shown in guest list
- But remaining capacity is still 10 (organiser doesn't count)

#### Test 4.3: Multiple Bookings from Same Person
**Steps**:
1. Person A purchases 3 tickets
2. Person A purchases 2 more tickets (separate booking)
3. Check total guest count

**Expected Result**:
- Total guests: 5
- Both bookings are tracked separately
- Capacity decreases by 5

## Automated Testing (Future)

Consider adding automated tests for:
- `occasionService.addManualGuestsToOccasion()` capacity validation
- Edge function capacity check logic
- Race condition handling

## Known Limitations

1. **Race Conditions**: Current implementation may allow capacity to be slightly exceeded if multiple requests happen simultaneously. Consider adding database-level constraints or optimistic locking.

2. **Real-time Updates**: Capacity information is not updated in real-time. Users need to refresh to see latest capacity.

3. **Payment Processing Window**: Brief window between capacity check and booking creation where capacity could be exceeded.

## Success Criteria

- ✅ GM users cannot add guests exceeding capacity
- ✅ Customers cannot purchase tickets exceeding capacity
- ✅ No charges are made for bookings that exceed capacity
- ✅ Clear error messages guide users
- ✅ Cancelled bookings don't count toward capacity
- ✅ Capacity information is accurate and up-to-date

