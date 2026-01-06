# Edge Functions Documentation

This document describes all Supabase Edge Functions in the GM Dashboard application.

## Base URL

All edge functions are available at:
```
https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/
```

## Authentication

Most endpoints require authentication via:
- **Supabase Auth Token**: Passed automatically by Supabase client
- **API Key**: `apikey` header with anon or service role key

## Booking Functions

### 1. karaoke-availability

**Endpoint:** `GET /karaoke-availability`

**Description:** Check availability for karaoke booths on a specific date.

**Query Parameters:**
- `bookingDate` (required): Date in `YYYY-MM-DD` format
- `boothId` (optional): Specific booth ID to check
- `venue` (optional): `manor` or `hippie`
- `minCapacity` (optional): Minimum booth capacity required
- `granularityMinutes` (optional): Time slot granularity (default: 60)
- `action` (optional): `boothsForSlot` - Get available booths for a specific time
- `startTime` (optional): Start time for `boothsForSlot` action (format: `HH:MM`)
- `endTime` (optional): End time for `boothsForSlot` action (format: `HH:MM`)

**Response:**
```json
{
  "success": true,
  "availability": [
    {
      "startTime": "10:00",
      "endTime": "11:00",
      "available": true
    },
    {
      "startTime": "11:00",
      "endTime": "12:00",
      "available": false,
      "blockedBy": "booking"
    }
  ]
}
```

**Example:**
```bash
curl "https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/karaoke-availability?bookingDate=2025-01-15&venue=manor"
```

---

### 2. karaoke-holds

**Endpoint:** `POST /karaoke-holds`

**Description:** Create or release temporary holds on karaoke booths during the booking process.

**Request Body:**
```json
{
  "action": "create",
  "boothId": "booth-uuid",
  "bookingDate": "2025-01-15",
  "startTime": "14:00",
  "endTime": "16:00",
  "holdToken": "unique-token"
}
```

**Actions:**
- `create` - Create a new hold
- `release` - Release an existing hold
- `extend` - Extend hold expiration

**Response:**
```json
{
  "success": true,
  "holdId": "hold-uuid",
  "expiresAt": "2025-01-15T14:15:00Z"
}
```

**Notes:**
- Holds expire after 15 minutes
- Prevents double-booking during checkout
- Automatically cleaned up on expiration

---

### 3. karaoke-book

**Endpoint:** `POST /karaoke-book`

**Description:** Create a karaoke booking (staff use only).

**Request Body:**
```json
{
  "customerId": "customer-uuid",
  "boothId": "booth-uuid",
  "bookingDate": "2025-01-15",
  "startTime": "14:00",
  "endTime": "16:00",
  "guestCount": 4,
  "notes": "Birthday party"
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": "booking-uuid",
  "booking": {
    "id": "booking-uuid",
    "customer_id": "customer-uuid",
    "booking_type": "karaoke",
    "booking_date": "2025-01-15",
    "start_time": "14:00",
    "end_time": "16:00",
    "total_price": 100.00,
    "status": "confirmed"
  }
}
```

---

### 4. karaoke-pay-and-book

**Endpoint:** `POST /karaoke-pay-and-book`

**Description:** Process payment and create karaoke booking (customer-facing).

**Request Body:**
```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+61400000000",
  "boothId": "booth-uuid",
  "bookingDate": "2025-01-15",
  "startTime": "14:00",
  "endTime": "16:00",
  "guestCount": 4,
  "paymentToken": "square-payment-token",
  "holdToken": "hold-token"
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": "booking-uuid",
  "paymentId": "square-payment-id",
  "message": "Booking confirmed"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Booth not available for selected time"
}
```

**Notes:**
- Validates hold token before processing
- Charges payment via Square API
- Creates booking only if payment succeeds
- Sends confirmation email

---

### 5. ticket-pay-and-book

**Endpoint:** `POST /ticket-pay-and-book`

**Description:** Process payment and create VIP ticket booking or occasion guest purchase.

**Request Body:**
```json
{
  "customerName": "Jane Smith",
  "customerEmail": "jane@example.com",
  "customerPhone": "+61400000000",
  "venue": "manor",
  "bookingDate": "2025-01-20",
  "ticketQuantity": 2,
  "ticketType": "vip_entry",
  "paymentToken": "square-payment-token",
  "parentBookingId": "occasion-uuid",
  "groupToken": "shared-link-token"
}
```

**Parameters:**
- `parentBookingId` (optional): For occasion guest purchases
- `groupToken` (optional): For shared link purchases
- `ticketType` (optional): Type of ticket (default: `vip_entry`)

**Response:**
```json
{
  "success": true,
  "bookingId": "booking-uuid",
  "paymentId": "square-payment-id",
  "remainingCapacity": 18
}
```

**Capacity Checking:**
- If `parentBookingId` is provided, checks occasion capacity
- Validates capacity **before** charging payment
- Returns error if capacity exceeded

**Error Response:**
```json
{
  "success": false,
  "error": "Cannot add 5 guests. Only 3 spots remaining (capacity: 50)"
}
```

---

## Configuration Functions

### 6. venue-config-api

**Endpoint:** `GET /venue-config-api`

**Description:** Returns venue and area configuration (hardcoded data).

**Query Parameters:**
- `venue` (optional): Filter by specific venue (`manor` or `hippie`)

**Response:**
```json
{
  "success": true,
  "venues": [
    {
      "id": "manor",
      "name": "Manor",
      "description": "Our flagship venue with multiple spaces",
      "operating_hours": {
        "start": "09:00",
        "end": "23:00"
      },
      "areas": [
        {
          "id": "upstairs",
          "name": "Upstairs",
          "capacity": 50,
          "description": "Elegant upstairs space",
          "base_price": 500.00,
          "hourly_rate": 100.00
        },
        {
          "id": "downstairs",
          "name": "Downstairs",
          "capacity": 80,
          "description": "Main downstairs area",
          "base_price": 800.00,
          "hourly_rate": 150.00
        },
        {
          "id": "full_venue",
          "name": "Full Venue",
          "capacity": 130,
          "description": "Complete venue hire",
          "base_price": 1200.00,
          "hourly_rate": 200.00
        }
      ]
    }
  ]
}
```

**Notes:**
- Configuration is hardcoded in the function
- Rarely changes, safe to cache client-side
- No authentication required

---

## Sync Functions

### 7. sync-and-transform

**Endpoint:** `POST /sync-and-transform`

**Description:** Sync Square payments and transform to revenue events.

**Authentication:** Requires service role key or scheduled invocation

**Request Body:**
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "paymentsProcessed": 145,
  "revenueEventsCreated": 145,
  "errors": []
}
```

**Process:**
1. Fetches payments from Square API
2. Fetches location data
3. Transforms to `revenue_events` format
4. Inserts into database
5. Handles duplicates gracefully

---

### 8. square-sync-backfill

**Endpoint:** `POST /square-sync-backfill`

**Description:** Backfill historical Square payment data.

**Authentication:** Requires service role key

**Request Body:**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "batchSize": 100
}
```

**Response:**
```json
{
  "success": true,
  "totalProcessed": 1250,
  "batches": 13,
  "duration": "45s"
}
```

**Notes:**
- Use for initial data import
- Processes in batches to avoid timeouts
- Can be run multiple times (idempotent)

---

### 9. sync-scheduler

**Endpoint:** `POST /sync-scheduler`

**Description:** Scheduled trigger for automatic Square sync.

**Authentication:** Invoked by Supabase cron (internal)

**Schedule:** Runs every 6 hours

**Response:**
```json
{
  "success": true,
  "syncTriggered": true,
  "timestamp": "2025-01-15T10:00:00Z"
}
```

**Notes:**
- Configured in Supabase dashboard
- Automatically syncs last 7 days of data
- Logs results for monitoring

---

## Utility Functions

### 10. send-email

**Endpoint:** `POST /send-email`

**Description:** Send transactional emails (confirmations, reminders, etc.).

**Request Body:**
```json
{
  "to": "customer@example.com",
  "subject": "Booking Confirmation",
  "template": "booking_confirmation",
  "data": {
    "customerName": "John Doe",
    "bookingDate": "2025-01-15",
    "bookingTime": "14:00",
    "venue": "Manor"
  }
}
```

**Templates:**
- `booking_confirmation` - Booking confirmation email
- `booking_reminder` - Reminder before booking
- `booking_cancellation` - Cancellation notification
- `occasion_invitation` - Occasion guest invitation

**Response:**
```json
{
  "success": true,
  "messageId": "email-id",
  "message": "Email sent successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid email address"
}
```

---

## Error Handling

All functions return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_REQUEST` - Missing or invalid parameters
- `NOT_FOUND` - Resource not found
- `CAPACITY_EXCEEDED` - Booking exceeds capacity
- `PAYMENT_FAILED` - Payment processing failed
- `UNAUTHORIZED` - Authentication failed
- `CONFLICT` - Resource conflict (e.g., double booking)

## CORS Configuration

All functions support CORS for web browser access:

- **Allowed Origins:** Configurable via `ALLOWED_ORIGINS` environment variable
- **Allowed Methods:** `GET, POST, OPTIONS`
- **Allowed Headers:** `Content-Type, Authorization, apikey, x-client-info, x-action`

## Rate Limiting

- Functions include basic caching (10-second TTL for availability checks)
- No hard rate limits currently enforced
- Consider implementing rate limiting for production

## Testing

Test functions locally using Supabase CLI:

```bash
# Start local functions
supabase functions serve

# Test a function
curl -X POST http://localhost:54321/functions/v1/karaoke-availability \
  -H "Content-Type: application/json" \
  -d '{"bookingDate": "2025-01-15"}'
```

## Deployment

Deploy functions using Supabase CLI:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy karaoke-availability

# View function logs
supabase functions logs karaoke-availability
```

## Environment Variables

Required environment variables (set in Supabase dashboard):

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SQUARE_ACCESS_TOKEN` - Square API access token
- `SQUARE_LOCATION_ID` - Square location ID
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `XERO_CLIENT_ID` - Xero OAuth client ID
- `XERO_CLIENT_SECRET` - Xero OAuth client secret

## Monitoring

Monitor function performance and errors:

1. **Supabase Dashboard**: View logs and metrics
2. **Error Tracking**: Functions log errors with context
3. **Performance**: Monitor execution time and cold starts
4. **Usage**: Track invocation counts and costs

## Best Practices

1. **Error Handling**: Always return consistent error responses
2. **Validation**: Validate all input parameters
3. **Authentication**: Check user permissions before operations
4. **Idempotency**: Design functions to be safely retried
5. **Logging**: Log important events and errors
6. **Testing**: Test functions locally before deploying
7. **Versioning**: Consider versioning for breaking changes

