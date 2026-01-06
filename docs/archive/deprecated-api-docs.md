# API Documentation for GM Dashboard Booking System

## Base URL
All API endpoints are available at: `https://your-project.supabase.co/functions/v1/`

## Authentication
All endpoints require the `x-api-key` header with your Supabase service role key.

## Available Endpoints

### 1. Venue Configuration API
**Endpoint:** `venue-config-api`

**Description:** Returns venue and area configurations including capacities, descriptions, and operating hours.

**Query Parameters:**
- `venue` (optional): Filter by specific venue (e.g., 'manor', 'hippie')

**Example Request:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/venue-config-api?venue=manor" \
  -H "x-api-key: your-service-role-key"
```

**Example Response:**
```json
{
  "venue": {
    "id": "manor",
    "name": "The Manor",
    "description": "Premium venue with multiple areas available for hire",
    "operating_hours": {
      "open": "10:00",
      "close": "02:00"
    },
    "areas": [
      {
        "id": "upstairs",
        "name": "Upstairs",
        "capacity": 50,
        "description": "Exclusive upstairs area with premium amenities",
        "base_price": 500,
        "hourly_rate": 100
      },
      {
        "id": "downstairs",
        "name": "Downstairs",
        "capacity": 80,
        "description": "Main downstairs area with full facilities",
        "base_price": 800,
        "hourly_rate": 150
      },
      {
        "id": "full_venue",
        "name": "Full Venue",
        "capacity": 130,
        "description": "Complete venue hire including all areas",
        "base_price": 1200,
        "hourly_rate": 200
      }
    ]
  }
}
```

### 2. Karaoke Booths API
**Endpoint:** `karaoke-booths-api`

**Description:** Returns karaoke booth information from the database.

**Query Parameters:**
- `venue` (optional): Filter by venue
- `available` (optional): Filter by availability (true/false)

**Example Request:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/karaoke-booths-api?venue=manor&available=true" \
  -H "x-api-key: your-service-role-key"
```

**Example Response:**
```json
{
  "booths": [
    {
      "id": 1,
      "name": "Booth A",
      "venue": "manor",
      "capacity": 6,
      "available": true,
      "hourly_rate": 50
    }
  ]
}
```

### 3. Time Slots API
**Endpoint:** `timeslots-api`

**Description:** Returns available time slots for a given date and venue/area, considering existing bookings.

**Required Query Parameters:**
- `date`: Date in YYYY-MM-DD format

**Optional Query Parameters:**
- `venue`: Venue name (defaults to 'manor')
- `venue_area`: Specific area within venue

**Example Request:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/timeslots-api?date=2024-01-15&venue=manor&venue_area=upstairs" \
  -H "x-api-key: your-service-role-key"
```

**Example Response:**
```json
{
  "date": "2024-01-15",
  "venue": "manor",
  "venue_area": "upstairs",
  "time_slots": [
    {
      "time": "10:00",
      "available": true
    },
    {
      "time": "10:30",
      "available": false
    },
    {
      "time": "11:00",
      "available": true
    }
  ]
}
```

### 4. Pricing API
**Endpoint:** `pricing-api`

**Description:** Calculates pricing for venue bookings based on parameters.

**Required Query Parameters:**
- `venue`: Venue name
- `venue_area`: Area within venue
- `date`: Date in YYYY-MM-DD format
- `guests`: Number of guests
- `duration`: Duration in hours

**Example Request:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/pricing-api?venue=manor&venue_area=upstairs&date=2024-01-15&guests=25&duration=3" \
  -H "x-api-key: your-service-role-key"
```

**Example Response:**
```json
{
  "venue": "manor",
  "venue_area": "upstairs",
  "date": "2024-01-15",
  "guests": 25,
  "duration": 3,
  "base_price": 500,
  "per_guest_surcharge": 150,
  "total_price": 950,
  "available_addons": [
    "Sound System",
    "Lighting Package",
    "Bar Service",
    "Security Staff",
    "Cleaning Service"
  ]
}
```

## Widget Integration Guide

### For the Widget Team: Updated Integration Instructions

The widget currently uses hardcoded data. To make it dynamic, you need to update the widget to fetch data from these APIs. Here's how to integrate:

#### 1. Update Widget to Use Dynamic Venue Data

Replace hardcoded venue data with API calls:

```javascript
// Instead of hardcoded venues, fetch from API
async function loadVenues() {
  try {
    const response = await fetch('https://your-project.supabase.co/functions/v1/venue-config-api', {
      headers: {
        'x-api-key': 'your-service-role-key'
      }
    });
    const data = await response.json();
    return data.venues;
  } catch (error) {
    console.error('Error loading venues:', error);
    return []; // Fallback to empty array
  }
}
```

#### 2. Update Time Slot Loading

Replace hardcoded time slots with dynamic API calls:

```javascript
// Instead of hardcoded time slots, fetch from API
async function loadTimeSlots(date, venue, venueArea) {
  try {
    const params = new URLSearchParams({
      date: date,
      venue: venue,
      venue_area: venueArea
    });
    
    const response = await fetch(`https://your-project.supabase.co/functions/v1/timeslots-api?${params}`, {
      headers: {
        'x-api-key': 'your-service-role-key'
      }
    });
    const data = await response.json();
    return data.time_slots.filter(slot => slot.available);
  } catch (error) {
    console.error('Error loading time slots:', error);
    return []; // Fallback to empty array
  }
}
```

#### 3. Update Pricing Calculation

Replace hardcoded pricing with dynamic API calls:

```javascript
// Instead of hardcoded pricing, fetch from API
async function calculatePricing(venue, venueArea, date, guests, duration) {
  try {
    const params = new URLSearchParams({
      venue: venue,
      venue_area: venueArea,
      date: date,
      guests: guests.toString(),
      duration: duration.toString()
    });
    
    const response = await fetch(`https://your-project.supabase.co/functions/v1/pricing-api?${params}`, {
      headers: {
        'x-api-key': 'your-service-role-key'
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calculating pricing:', error);
    return null; // Fallback to null
  }
}
```

#### 4. Update Karaoke Booth Loading

Replace hardcoded karaoke data with dynamic API calls:

```javascript
// Instead of hardcoded karaoke booths, fetch from API
async function loadKaraokeBooths(venue) {
  try {
    const params = new URLSearchParams({
      venue: venue,
      available: 'true'
    });
    
    const response = await fetch(`https://your-project.supabase.co/functions/v1/karaoke-booths-api?${params}`, {
      headers: {
        'x-api-key': 'your-service-role-key'
      }
    });
    const data = await response.json();
    return data.booths;
  } catch (error) {
    console.error('Error loading karaoke booths:', error);
    return []; // Fallback to empty array
  }
}
```

#### 5. Widget Implementation Checklist

- [ ] Replace hardcoded venue data with `venue-config-api` calls
- [ ] Replace hardcoded time slots with `timeslots-api` calls
- [ ] Replace hardcoded pricing with `pricing-api` calls
- [ ] Replace hardcoded karaoke data with `karaoke-booths-api` calls
- [ ] Add error handling for API failures
- [ ] Add loading states while fetching data
- [ ] Add fallback to hardcoded data if APIs fail
- [ ] Test all API integrations
- [ ] Update widget documentation

#### 6. Error Handling Best Practices

```javascript
// Example error handling pattern
async function safeApiCall(apiFunction, fallbackData) {
  try {
    const result = await apiFunction();
    return result;
  } catch (error) {
    console.error('API call failed:', error);
    return fallbackData; // Return fallback data
  }
}

// Usage example
const venues = await safeApiCall(loadVenues, defaultVenues);
```

#### 7. Rate Limiting Considerations

- Implement caching for venue configurations (they don't change often)
- Cache time slots for a few minutes to avoid excessive API calls
- Implement exponential backoff for failed API calls
- Consider implementing a simple in-memory cache

#### 8. Testing the APIs

Use the provided `test-apis.html` file to test all API endpoints before integrating with the widget.

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing parameters)
- `401`: Unauthorized (invalid API key)
- `404`: Not found (venue not found, etc.)
- `500`: Internal server error

## Rate Limiting

- Implement reasonable rate limiting on your end
- Consider caching responses for static data
- Handle API failures gracefully in your widget

## CORS Support

All endpoints support CORS and can be called from web browsers.

## Widget Implementation Checklist

- [ ] Set up API key authentication
- [ ] Implement error handling for API failures
- [ ] Add loading states while fetching data
- [ ] Test all API endpoints
- [ ] Implement fallback mechanisms
- [ ] Add proper error messages for users
- [ ] Test widget on different marketing sites
- [ ] Monitor API usage and performance 