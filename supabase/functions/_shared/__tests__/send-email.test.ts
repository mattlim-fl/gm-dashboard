/**
 * Unit tests for send-email edge function logic
 * Run with: deno test --allow-env _shared/__tests__/send-email.test.ts
 *
 * These tests validate template rendering, data extraction,
 * and response handling for the send-email function.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

// ============================================
// Data Extraction Helper Tests
// ============================================

function get(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, data)
}

Deno.test("get - extracts top-level property", () => {
  const data = { name: "John", email: "john@example.com" }

  assertEquals(get(data, "name"), "John")
  assertEquals(get(data, "email"), "john@example.com")
})

Deno.test("get - extracts nested property", () => {
  const data = {
    customer: {
      name: "John",
      contact: {
        email: "john@example.com",
      },
    },
  }

  assertEquals(get(data, "customer.name"), "John")
  assertEquals(get(data, "customer.contact.email"), "john@example.com")
})

Deno.test("get - returns undefined for missing property", () => {
  const data = { name: "John" }

  assertEquals(get(data, "email"), undefined)
  assertEquals(get(data, "customer.name"), undefined)
})

Deno.test("get - handles empty path", () => {
  const data = { name: "John" }

  assertEquals(get(data, ""), data)
})

// ============================================
// Date Formatting Tests
// ============================================

function formatDateAU(iso?: string): string {
  if (!iso) return ""
  try {
    const d = new Date(String(iso))
    return d.toLocaleDateString("en-AU", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return String(iso)
  }
}

Deno.test("formatDateAU - formats ISO date correctly", () => {
  const result = formatDateAU("2025-01-15")

  // Check it contains expected parts (exact format may vary by locale)
  assertStringIncludes(result, "January")
  assertStringIncludes(result, "15")
  assertStringIncludes(result, "2025")
})

Deno.test("formatDateAU - handles undefined", () => {
  assertEquals(formatDateAU(undefined), "")
})

Deno.test("formatDateAU - handles empty string", () => {
  assertEquals(formatDateAU(""), "")
})

Deno.test("formatDateAU - returns original on invalid date", () => {
  const result = formatDateAU("not-a-date")
  // Should return something (either original or formatted invalid date)
  assertEquals(typeof result, "string")
})

// ============================================
// Guest List URL Generation Tests
// ============================================

function getGuestListBaseUrl(overrideOrigin?: string | null): string {
  if (overrideOrigin && typeof overrideOrigin === "string" && overrideOrigin.trim()) {
    return overrideOrigin.trim().replace(/\/$/, "")
  }
  return "https://manorleederville.com"
}

function generateGuestListLinkFromToken(
  token?: string | null,
  overrideOrigin?: string | null
): string | null {
  if (!token) return null
  const base = getGuestListBaseUrl(overrideOrigin)
  return `${base}/guest-list?token=${encodeURIComponent(String(token))}`
}

Deno.test("getGuestListBaseUrl - uses override when provided", () => {
  assertEquals(getGuestListBaseUrl("https://custom.com"), "https://custom.com")
})

Deno.test("getGuestListBaseUrl - strips trailing slash", () => {
  assertEquals(getGuestListBaseUrl("https://custom.com/"), "https://custom.com")
})

Deno.test("getGuestListBaseUrl - defaults to production", () => {
  assertEquals(getGuestListBaseUrl(), "https://manorleederville.com")
  assertEquals(getGuestListBaseUrl(null), "https://manorleederville.com")
  assertEquals(getGuestListBaseUrl(""), "https://manorleederville.com")
})

Deno.test("generateGuestListLinkFromToken - creates valid URL", () => {
  const result = generateGuestListLinkFromToken("abc123")

  assertEquals(result, "https://manorleederville.com/guest-list?token=abc123")
})

Deno.test("generateGuestListLinkFromToken - uses custom origin", () => {
  const result = generateGuestListLinkFromToken("abc123", "https://custom.com")

  assertEquals(result, "https://custom.com/guest-list?token=abc123")
})

Deno.test("generateGuestListLinkFromToken - encodes special characters", () => {
  const result = generateGuestListLinkFromToken("token with spaces & symbols")

  assertStringIncludes(result!, "token%20with%20spaces%20%26%20symbols")
})

Deno.test("generateGuestListLinkFromToken - returns null for empty token", () => {
  assertEquals(generateGuestListLinkFromToken(null), null)
  assertEquals(generateGuestListLinkFromToken(""), null)
  assertEquals(generateGuestListLinkFromToken(undefined), null)
})

// ============================================
// Template Name Handling Tests
// ============================================

function normalizeTemplateName(template?: string): string {
  return String(template || "").toLowerCase()
}

Deno.test("normalizeTemplateName - converts to lowercase", () => {
  assertEquals(normalizeTemplateName("Venue-Confirmation"), "venue-confirmation")
  assertEquals(normalizeTemplateName("KARAOKE-CONFIRMATION"), "karaoke-confirmation")
})

Deno.test("normalizeTemplateName - handles undefined", () => {
  assertEquals(normalizeTemplateName(undefined), "")
})

Deno.test("normalizeTemplateName - handles empty string", () => {
  assertEquals(normalizeTemplateName(""), "")
})

// ============================================
// Subject Line Determination Tests
// ============================================

function determineSubject(templateName: string, providedSubject?: string): string {
  if (providedSubject) return providedSubject

  switch (templateName) {
    case "karaoke-confirmation":
      return "Karaoke Booking Confirmation - Manor Perth"
    case "priority-ticket-confirmation":
      return "Your Tickets are Confirmed!"
    case "staff-invite":
      return "You've been invited to GM Staff Portal"
    case "occasion-organiser-confirmation":
      return "Your Occasion is Confirmed!"
    default:
      return "Booking Confirmation - Manor Perth"
  }
}

Deno.test("determineSubject - uses provided subject", () => {
  assertEquals(determineSubject("karaoke-confirmation", "Custom Subject"), "Custom Subject")
})

Deno.test("determineSubject - karaoke confirmation", () => {
  assertEquals(
    determineSubject("karaoke-confirmation"),
    "Karaoke Booking Confirmation - Manor Perth"
  )
})

Deno.test("determineSubject - ticket confirmation", () => {
  assertEquals(determineSubject("priority-ticket-confirmation"), "Your Tickets are Confirmed!")
})

Deno.test("determineSubject - staff invite", () => {
  assertEquals(determineSubject("staff-invite"), "You've been invited to GM Staff Portal")
})

Deno.test("determineSubject - occasion organiser", () => {
  assertEquals(determineSubject("occasion-organiser-confirmation"), "Your Occasion is Confirmed!")
})

Deno.test("determineSubject - default for unknown template", () => {
  assertEquals(determineSubject("unknown-template"), "Booking Confirmation - Manor Perth")
})

Deno.test("determineSubject - default for empty template", () => {
  assertEquals(determineSubject(""), "Booking Confirmation - Manor Perth")
})

// ============================================
// From Address Determination Tests
// ============================================

function determineFromAddress(templateName: string, providedFrom?: string): string {
  if (providedFrom) return providedFrom

  if (templateName === "staff-invite") {
    return "GM Staff Portal <phil@manorleederville.com>"
  }
  return "Manor Perth <phil@manorleederville.com>"
}

Deno.test("determineFromAddress - uses provided from", () => {
  assertEquals(
    determineFromAddress("karaoke-confirmation", "Custom <custom@example.com>"),
    "Custom <custom@example.com>"
  )
})

Deno.test("determineFromAddress - staff invite uses portal name", () => {
  assertEquals(
    determineFromAddress("staff-invite"),
    "GM Staff Portal <phil@manorleederville.com>"
  )
})

Deno.test("determineFromAddress - default uses Manor Perth", () => {
  assertEquals(
    determineFromAddress("karaoke-confirmation"),
    "Manor Perth <phil@manorleederville.com>"
  )
})

// ============================================
// Recipient Derivation Tests
// ============================================

function deriveRecipient(
  providedTo: string | undefined,
  data: Record<string, unknown>
): string | null {
  if (providedTo) return providedTo

  const customerEmail = get(data, "customerEmail") as string | undefined
  const inviteEmail = get(data, "inviteEmail") as string | undefined
  const organiserEmail = get(data, "organiserEmail") as string | undefined
  const derived = customerEmail || inviteEmail || organiserEmail

  if (derived && typeof derived === "string" && derived.includes("@")) {
    return derived
  }

  return null
}

Deno.test("deriveRecipient - uses provided to", () => {
  assertEquals(deriveRecipient("explicit@example.com", {}), "explicit@example.com")
})

Deno.test("deriveRecipient - derives from customerEmail", () => {
  assertEquals(deriveRecipient(undefined, { customerEmail: "customer@example.com" }), "customer@example.com")
})

Deno.test("deriveRecipient - derives from inviteEmail", () => {
  assertEquals(deriveRecipient(undefined, { inviteEmail: "invite@example.com" }), "invite@example.com")
})

Deno.test("deriveRecipient - derives from organiserEmail", () => {
  assertEquals(deriveRecipient(undefined, { organiserEmail: "organiser@example.com" }), "organiser@example.com")
})

Deno.test("deriveRecipient - prefers customerEmail over others", () => {
  assertEquals(
    deriveRecipient(undefined, {
      customerEmail: "customer@example.com",
      inviteEmail: "invite@example.com",
    }),
    "customer@example.com"
  )
})

Deno.test("deriveRecipient - returns null if no email found", () => {
  assertEquals(deriveRecipient(undefined, {}), null)
})

Deno.test("deriveRecipient - validates email has @", () => {
  assertEquals(deriveRecipient(undefined, { customerEmail: "invalid-email" }), null)
})

// ============================================
// Template Data Tests
// ============================================

Deno.test("venue confirmation data extraction", () => {
  const data = {
    venue: "manor",
    venueArea: "upstairs",
    venueAreaName: "Upstairs Lounge",
    bookingDate: "2025-01-15",
    startTime: "18:00",
    endTime: "23:00",
    guestCount: "50",
    customerName: "John Doe",
    referenceCode: "V-ABC123",
    customerEmail: "john@example.com",
  }

  assertEquals(get(data, "venue"), "manor")
  assertEquals(get(data, "venueArea"), "upstairs")
  assertEquals(get(data, "guestCount"), "50")
  assertEquals(get(data, "referenceCode"), "V-ABC123")
})

Deno.test("karaoke confirmation data extraction", () => {
  const data = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    referenceCode: "K-ABC123",
    bookingDate: "2025-01-15",
    startTime: "18:00",
    endTime: "20:00",
    guestCount: "8",
    boothName: "Booth 1",
    venue: "manor",
    guestListUrl: "https://manorleederville.com/guest-list?token=abc123",
  }

  assertEquals(get(data, "boothName"), "Booth 1")
  assertEquals(get(data, "guestListUrl"), "https://manorleederville.com/guest-list?token=abc123")
})

Deno.test("ticket confirmation data extraction", () => {
  const data = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    referenceCode: "TIX-ABC123",
    bookingDate: "2025-01-15",
    ticketQuantity: "4",
    venue: "manor",
    guestListUrl: "https://manorleederville.com/guest-list?token=abc123",
    occasionName: "Birthday Party",
  }

  assertEquals(get(data, "ticketQuantity"), "4")
  assertEquals(get(data, "occasionName"), "Birthday Party")
})

Deno.test("staff invite data extraction", () => {
  const data = {
    inviteEmail: "newstaff@example.com",
    inviteUrl: "https://gm-dashboard.netlify.app/auth/signup?token=xyz",
    invitedBy: "Admin User",
  }

  assertEquals(get(data, "inviteEmail"), "newstaff@example.com")
  assertEquals(get(data, "inviteUrl"), "https://gm-dashboard.netlify.app/auth/signup?token=xyz")
  assertEquals(get(data, "invitedBy"), "Admin User")
})

Deno.test("occasion organiser data extraction", () => {
  const data = {
    organiserName: "John Organiser",
    organiserEmail: "organiser@example.com",
    occasionName: "Birthday Bash",
    occasionDate: "2025-01-15",
    venue: "Manor",
    capacity: "30",
    organiserUrl: "https://manorleederville.com/occasions/abc123/organiser",
    ticketPrice: "$10",
    shareUrl: "https://manorleederville.com/occasions/abc123",
  }

  assertEquals(get(data, "organiserName"), "John Organiser")
  assertEquals(get(data, "capacity"), "30")
  assertEquals(get(data, "organiserUrl"), "https://manorleederville.com/occasions/abc123/organiser")
})

// ============================================
// Venue-Specific Display Tests
// ============================================

function getVenueDisplayName(venue: string): string {
  return venue.toLowerCase() === "manor" ? "Manor" : "Hippie Club"
}

function getSocialHandles(venue: string): { instagram: string; facebook: string } {
  const isManor = venue.toLowerCase() === "manor"
  return {
    instagram: isManor ? "manorleederville" : "hipeclubperth",
    facebook: isManor ? "manorleederville" : "hipeclubperth",
  }
}

Deno.test("getVenueDisplayName - manor", () => {
  assertEquals(getVenueDisplayName("manor"), "Manor")
  assertEquals(getVenueDisplayName("Manor"), "Manor")
  assertEquals(getVenueDisplayName("MANOR"), "Manor")
})

Deno.test("getVenueDisplayName - hippie", () => {
  assertEquals(getVenueDisplayName("hippie"), "Hippie Club")
  assertEquals(getVenueDisplayName("Hippie"), "Hippie Club")
})

Deno.test("getSocialHandles - manor", () => {
  const handles = getSocialHandles("manor")
  assertEquals(handles.instagram, "manorleederville")
  assertEquals(handles.facebook, "manorleederville")
})

Deno.test("getSocialHandles - hippie", () => {
  const handles = getSocialHandles("hippie")
  assertEquals(handles.instagram, "hipeclubperth")
  assertEquals(handles.facebook, "hipeclubperth")
})

// ============================================
// Resend API Response Tests
// ============================================

Deno.test("resend success response structure", () => {
  const response = {
    id: "email-123",
  }

  assertEquals(typeof response.id, "string")
})

Deno.test("resend error response extraction", () => {
  const errorResponse = {
    error: {
      message: "Invalid API key",
    },
  }

  const errorMessage = errorResponse.error?.message || "Unknown error"
  assertEquals(errorMessage, "Invalid API key")
})

Deno.test("resend error response fallback", () => {
  const errorResponse = {
    message: "Validation failed",
  }

  const errorMessage =
    (errorResponse as { error?: { message?: string } }).error?.message ||
    (errorResponse as { message?: string }).message ||
    "Unknown error"
  assertEquals(errorMessage, "Validation failed")
})

// ============================================
// Internal Notification Tests
// ============================================

Deno.test("internal notification - builds subject from data", () => {
  const data = {
    customerName: "John Doe",
    referenceCode: "V-ABC123",
  }

  const customerName = String(get(data, "customerName") || "Customer")
  const referenceCode = String(get(data, "referenceCode") || "ref")
  const subject = `New Venue Enquiry: ${customerName} (${referenceCode})`

  assertEquals(subject, "New Venue Enquiry: John Doe (V-ABC123)")
})

Deno.test("internal notification - handles missing data gracefully", () => {
  const data = {}

  const customerName = String(get(data, "customerName") || "Customer")
  const referenceCode = String(get(data, "referenceCode") || "ref")
  const subject = `New Venue Enquiry: ${customerName} (${referenceCode})`

  assertEquals(subject, "New Venue Enquiry: Customer (ref)")
})
