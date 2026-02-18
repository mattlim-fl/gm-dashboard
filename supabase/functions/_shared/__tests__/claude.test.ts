/**
 * Unit tests for Claude API client
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/claude.test.ts
 *
 * Note: These are unit tests that mock external API calls.
 * Integration tests with real API calls should be run separately.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  stub,
  restore,
  type Stub,
} from "https://deno.land/std@0.168.0/testing/mock.ts";

// ============================================
// Model Constants Tests
// ============================================

Deno.test("CLAUDE_MODELS - has expected model identifiers", async () => {
  const { CLAUDE_MODELS } = await import("../claude.ts");

  assertExists(CLAUDE_MODELS.CLASSIFICATION);
  assertExists(CLAUDE_MODELS.DRAFTING);

  // Classification should be Haiku (fast/cheap)
  assertEquals(
    CLAUDE_MODELS.CLASSIFICATION.includes("haiku"),
    true,
    "Classification model should be Haiku variant"
  );

  // Drafting should be Sonnet (quality)
  assertEquals(
    CLAUDE_MODELS.DRAFTING.includes("sonnet"),
    true,
    "Drafting model should be Sonnet variant"
  );
});

// ============================================
// isConfigured Tests
// ============================================

Deno.test("isConfigured - returns false when API key not set", async () => {
  // Temporarily clear the env var
  const originalKey = Deno.env.get("ANTHROPIC_API_KEY");
  Deno.env.delete("ANTHROPIC_API_KEY");

  // Re-import to get fresh module state
  // Note: In Deno, modules are cached, so we need to use dynamic import with cache busting
  // For this test, we'll just test the exported function directly
  const { isConfigured } = await import("../claude.ts");

  const result = isConfigured();
  assertEquals(result, false);

  // Restore
  if (originalKey) {
    Deno.env.set("ANTHROPIC_API_KEY", originalKey);
  }
});

Deno.test("isConfigured - returns true when API key is set", async () => {
  // Set a test API key
  const originalKey = Deno.env.get("ANTHROPIC_API_KEY");
  Deno.env.set("ANTHROPIC_API_KEY", "test-api-key-12345");

  const { isConfigured } = await import("../claude.ts");

  const result = isConfigured();
  assertEquals(result, true);

  // Restore
  if (originalKey) {
    Deno.env.set("ANTHROPIC_API_KEY", originalKey);
  } else {
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

// ============================================
// Classification Response Parsing Tests
// ============================================

Deno.test("classifyEmail - parses valid JSON response", async () => {
  // Set API key for test
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  // Mock fetch to return a successful classification
  const mockResponse = {
    id: "msg_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: '{"category": "booking", "confidence": 0.95, "reasoning": "Customer is asking about table reservations"}',
      },
    ],
    model: "claude-3-5-haiku-latest",
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50 },
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )
  );

  try {
    const { classifyEmail } = await import("../claude.ts");

    const result = await classifyEmail({
      from: "customer@example.com",
      subject: "Table Booking Request",
      body: "Hi, I'd like to book a table for 6 people this Saturday.",
    });

    assertEquals(result.category, "booking");
    assertEquals(result.confidence, 0.95);
    assertEquals(result.reasoning, "Customer is asking about table reservations");
    assertEquals(result.tokensUsed, 150);
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

Deno.test("classifyEmail - handles malformed JSON gracefully", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  // Mock a response with invalid JSON but containing category
  const mockResponse = {
    id: "msg_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: 'Here is my analysis: {"category": "complaint"... (truncated)',
      },
    ],
    model: "claude-3-5-haiku-latest",
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 30 },
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )
  );

  try {
    const { classifyEmail } = await import("../claude.ts");

    const result = await classifyEmail({
      from: "angry@example.com",
      subject: "Terrible experience",
      body: "I had a terrible time at your venue.",
    });

    // Should extract category from malformed response
    assertEquals(result.category, "complaint");
    assertEquals(result.confidence, 0.5); // Default confidence for malformed
    assertEquals(result.tokensUsed, 130);
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

Deno.test("classifyEmail - defaults to 'other' on parse failure", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  // Mock a response with completely unparseable content
  const mockResponse = {
    id: "msg_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: "I cannot determine the category of this email.",
      },
    ],
    model: "claude-3-5-haiku-latest",
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 20 },
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )
  );

  try {
    const { classifyEmail } = await import("../claude.ts");

    const result = await classifyEmail({
      from: "unknown@example.com",
      subject: "...",
      body: "...",
    });

    assertEquals(result.category, "other");
    assertEquals(result.confidence, 0.5);
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

// ============================================
// Draft Generation Tests
// ============================================

Deno.test("generateDraft - generates draft with knowledge context", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  const mockResponse = {
    id: "msg_456",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: `Hi John,

Thanks for reaching out about booking a table! We'd love to have you join us.

For a group of 6, we recommend our VIP booth area. Tables can be booked for any Saturday night.

Let me know what date works for you and I'll get that sorted.

Cheers,
The Hippie Club Team`,
      },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    usage: { input_tokens: 500, output_tokens: 150 },
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )
  );

  try {
    const { generateDraft } = await import("../claude.ts");

    const result = await generateDraft(
      {
        from: "john@example.com",
        fromName: "John Smith",
        subject: "Table Booking",
        body: "Hi, I'd like to book a table for 6 people.",
      },
      "booking",
      "## Booking Policy\n\nMinimum spend applies for booth bookings."
    );

    assertEquals(result.draft.includes("Hi John"), true);
    assertEquals(result.draft.includes("table"), true);
    assertEquals(result.tokensUsed, 650);
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

Deno.test("generateDraft - includes thread history when provided", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  let capturedBody: string = "";

  const mockResponse = {
    id: "msg_789",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: "Hi Sarah, Following up on your previous message...",
      },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    usage: { input_tokens: 600, output_tokens: 100 },
  };

  const fetchStub = stub(globalThis, "fetch", (url, init) => {
    if (init?.body) {
      capturedBody = init.body as string;
    }
    return Promise.resolve(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );
  });

  try {
    const { generateDraft } = await import("../claude.ts");

    await generateDraft(
      {
        from: "sarah@example.com",
        fromName: "Sarah Jones",
        subject: "Re: Lost Phone",
        body: "Did you find my phone?",
        threadHistory: "From: sarah@example.com\nI lost my phone at your venue last night.",
      },
      "lost_and_found",
      "## Lost & Found\n\nItems are held for 30 days."
    );

    // Verify thread history was included in the request
    assertEquals(capturedBody.includes("PREVIOUS MESSAGES IN THREAD"), true);
    assertEquals(capturedBody.includes("I lost my phone"), true);
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

// ============================================
// API Error Handling Tests
// ============================================

Deno.test("classifyEmail - throws on API key not configured", async () => {
  Deno.env.delete("ANTHROPIC_API_KEY");

  const { classifyEmail } = await import("../claude.ts");

  await assertRejects(
    async () =>
      await classifyEmail({
        from: "test@example.com",
        subject: "Test",
        body: "Test body",
      }),
    Error,
    "ANTHROPIC_API_KEY"
  );
});

Deno.test("classifyEmail - handles API error response", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 })
      )
  );

  try {
    const { classifyEmail } = await import("../claude.ts");

    // Should throw after retries
    await assertRejects(
      async () =>
        await classifyEmail({
          from: "test@example.com",
          subject: "Test",
          body: "Test",
        }),
      Error
    );
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

// ============================================
// Category Validation Tests
// ============================================

Deno.test("classifyEmail - clamps confidence to valid range", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "test-key");

  // Test with confidence > 1
  const mockResponse1 = {
    id: "msg_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: '{"category": "booking", "confidence": 1.5, "reasoning": "test"}',
      },
    ],
    model: "claude-3-5-haiku-latest",
    stop_reason: "end_turn",
    usage: { input_tokens: 50, output_tokens: 20 },
  };

  let callCount = 0;
  const fetchStub = stub(globalThis, "fetch", () => {
    callCount++;
    return Promise.resolve(
      new Response(JSON.stringify(mockResponse1), { status: 200 })
    );
  });

  try {
    const { classifyEmail } = await import("../claude.ts");

    const result = await classifyEmail({
      from: "test@example.com",
      subject: "Test",
      body: "Test",
    });

    // Confidence should be clamped to 1.0
    assertEquals(result.confidence <= 1, true);
    assertEquals(result.confidence >= 0, true);
  } finally {
    fetchStub.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});
