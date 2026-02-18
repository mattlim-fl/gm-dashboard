/**
 * Unit tests for Gmail API client
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/gmail.test.ts
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
} from "https://deno.land/std@0.168.0/testing/mock.ts";

// ============================================
// GMAIL_SCOPES Tests
// ============================================

Deno.test("GMAIL_SCOPES - has required OAuth scopes", async () => {
  const { GMAIL_SCOPES } = await import("../gmail.ts");

  // Should have at least read and modify scopes
  assertEquals(Array.isArray(GMAIL_SCOPES), true);
  assertEquals(GMAIL_SCOPES.length >= 3, true);

  // Check for essential scopes
  const hasReadonly = GMAIL_SCOPES.some((s) =>
    s.includes("gmail.readonly")
  );
  const hasModify = GMAIL_SCOPES.some((s) => s.includes("gmail.modify"));
  const hasCompose = GMAIL_SCOPES.some((s) => s.includes("gmail.compose"));

  assertEquals(hasReadonly, true, "Should have gmail.readonly scope");
  assertEquals(hasModify, true, "Should have gmail.modify scope");
  assertEquals(hasCompose, true, "Should have gmail.compose scope");
});

// ============================================
// isConfigured Tests
// ============================================

Deno.test("isConfigured - returns false when credentials not set", async () => {
  const originalClientId = Deno.env.get("GMAIL_CLIENT_ID");
  const originalClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

  Deno.env.delete("GMAIL_CLIENT_ID");
  Deno.env.delete("GMAIL_CLIENT_SECRET");

  const { isConfigured } = await import("../gmail.ts");

  const result = isConfigured();
  assertEquals(result, false);

  // Restore
  if (originalClientId) Deno.env.set("GMAIL_CLIENT_ID", originalClientId);
  if (originalClientSecret) Deno.env.set("GMAIL_CLIENT_SECRET", originalClientSecret);
});

Deno.test("isConfigured - returns true when credentials set", async () => {
  const originalClientId = Deno.env.get("GMAIL_CLIENT_ID");
  const originalClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

  Deno.env.set("GMAIL_CLIENT_ID", "test-client-id");
  Deno.env.set("GMAIL_CLIENT_SECRET", "test-client-secret");

  const { isConfigured } = await import("../gmail.ts");

  const result = isConfigured();
  assertEquals(result, true);

  // Restore
  if (originalClientId) {
    Deno.env.set("GMAIL_CLIENT_ID", originalClientId);
  } else {
    Deno.env.delete("GMAIL_CLIENT_ID");
  }
  if (originalClientSecret) {
    Deno.env.set("GMAIL_CLIENT_SECRET", originalClientSecret);
  } else {
    Deno.env.delete("GMAIL_CLIENT_SECRET");
  }
});

// ============================================
// buildAuthUrl Tests
// ============================================

Deno.test("buildAuthUrl - generates valid OAuth URL", async () => {
  Deno.env.set("GMAIL_CLIENT_ID", "test-client-id-123");
  Deno.env.set("GMAIL_CLIENT_SECRET", "test-secret");

  const { buildAuthUrl } = await import("../gmail.ts");

  const redirectUri = "https://example.com/callback";
  const state = "test-state-abc";

  const url = buildAuthUrl(redirectUri, state);

  // Parse the URL
  const parsed = new URL(url);

  assertEquals(parsed.hostname, "accounts.google.com");
  assertEquals(parsed.pathname, "/o/oauth2/v2/auth");
  assertEquals(parsed.searchParams.get("client_id"), "test-client-id-123");
  assertEquals(parsed.searchParams.get("redirect_uri"), redirectUri);
  assertEquals(parsed.searchParams.get("state"), state);
  assertEquals(parsed.searchParams.get("response_type"), "code");
  assertEquals(parsed.searchParams.get("access_type"), "offline");
  assertEquals(parsed.searchParams.get("prompt"), "consent");

  // Should include scopes
  const scope = parsed.searchParams.get("scope");
  assertExists(scope);
  assertEquals(scope!.includes("gmail"), true);

  // Cleanup
  Deno.env.delete("GMAIL_CLIENT_ID");
  Deno.env.delete("GMAIL_CLIENT_SECRET");
});

// ============================================
// parseMessage Tests
// ============================================

Deno.test("parseMessage - extracts email headers correctly", async () => {
  const { parseMessage } = await import("../gmail.ts");

  const mockMessage = {
    id: "msg123",
    threadId: "thread456",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Test snippet",
    payload: {
      headers: [
        { name: "From", value: "John Doe <john@example.com>" },
        { name: "To", value: "support@venue.com" },
        { name: "Subject", value: "Test Subject" },
      ],
      body: { data: "SGVsbG8gV29ybGQ=" }, // "Hello World" in base64url
    },
    internalDate: "1700000000000",
  };

  const parsed = parseMessage(mockMessage);

  assertEquals(parsed.id, "msg123");
  assertEquals(parsed.threadId, "thread456");
  assertEquals(parsed.from, "john@example.com");
  assertEquals(parsed.fromName, "John Doe");
  assertEquals(parsed.to, "support@venue.com");
  assertEquals(parsed.subject, "Test Subject");
  assertEquals(parsed.labelIds, ["INBOX", "UNREAD"]);
});

Deno.test("parseMessage - handles From header without angle brackets", async () => {
  const { parseMessage } = await import("../gmail.ts");

  const mockMessage = {
    id: "msg123",
    threadId: "thread456",
    labelIds: [],
    snippet: "",
    payload: {
      headers: [
        { name: "From", value: "simple@example.com" },
        { name: "Subject", value: "Test" },
      ],
      body: {},
    },
    internalDate: "1700000000000",
  };

  const parsed = parseMessage(mockMessage);

  assertEquals(parsed.from, "simple@example.com");
  assertEquals(parsed.fromName, "simple@example.com");
});

Deno.test("parseMessage - extracts plain text from multipart message", async () => {
  const { parseMessage } = await import("../gmail.ts");

  // Base64url encode "This is the plain text body"
  const plainTextBase64 = btoa("This is the plain text body")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const mockMessage = {
    id: "msg123",
    threadId: "thread456",
    labelIds: [],
    snippet: "",
    payload: {
      headers: [
        { name: "From", value: "test@example.com" },
        { name: "Subject", value: "Test" },
      ],
      parts: [
        {
          mimeType: "text/plain",
          body: { data: plainTextBase64 },
        },
        {
          mimeType: "text/html",
          body: { data: btoa("<html><body>HTML version</body></html>") },
        },
      ],
    },
    internalDate: "1700000000000",
  };

  const parsed = parseMessage(mockMessage);

  assertEquals(parsed.body, "This is the plain text body");
});

Deno.test("parseMessage - falls back to HTML when no plain text", async () => {
  const { parseMessage } = await import("../gmail.ts");

  // Base64url encode HTML
  const htmlBase64 = btoa("<html><body>HTML content here</body></html>")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const mockMessage = {
    id: "msg123",
    threadId: "thread456",
    labelIds: [],
    snippet: "",
    payload: {
      headers: [
        { name: "From", value: "test@example.com" },
        { name: "Subject", value: "Test" },
      ],
      parts: [
        {
          mimeType: "text/html",
          body: { data: htmlBase64 },
        },
      ],
    },
    internalDate: "1700000000000",
  };

  const parsed = parseMessage(mockMessage);

  // HTML should be stripped
  assertEquals(parsed.body.includes("HTML content here"), true);
  assertEquals(parsed.body.includes("<html>"), false);
});

// ============================================
// Token Encryption Tests
// ============================================

Deno.test("encryptRefreshToken/decryptRefreshToken - round trip", async () => {
  Deno.env.set("TOKEN_ENCRYPTION_KEY", "test-encryption-key-12345678901234");

  const { encryptRefreshToken, decryptRefreshToken } = await import("../gmail.ts");

  const originalToken = "1//0abc123def456_refresh_token_here";

  const encrypted = await encryptRefreshToken(originalToken);
  const decrypted = await decryptRefreshToken(encrypted);

  assertEquals(decrypted, originalToken);

  Deno.env.delete("TOKEN_ENCRYPTION_KEY");
});

// ============================================
// API Request Tests
// ============================================

Deno.test("listUnreadEmails - calls Gmail API correctly", async () => {
  let capturedUrl = "";

  const mockResponse = {
    messages: [
      { id: "msg1", threadId: "thread1" },
      { id: "msg2", threadId: "thread2" },
    ],
  };

  const fetchStub = stub(globalThis, "fetch", (url) => {
    capturedUrl = url.toString();
    return Promise.resolve(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );
  });

  try {
    const { listUnreadEmails } = await import("../gmail.ts");

    const result = await listUnreadEmails("test-access-token", 5);

    assertEquals(result.length, 2);
    assertEquals(result[0].id, "msg1");
    assertEquals(capturedUrl.includes("is%3Aunread"), true);
    assertEquals(capturedUrl.includes("maxResults=5"), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("listUnreadEmails - returns empty array when no messages", async () => {
  const mockResponse = {};

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )
  );

  try {
    const { listUnreadEmails } = await import("../gmail.ts");

    const result = await listUnreadEmails("test-access-token");

    assertEquals(result, []);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("getMessage - fetches full message format", async () => {
  let capturedUrl = "";

  const mockMessage = {
    id: "msg123",
    threadId: "thread456",
    labelIds: ["INBOX"],
    snippet: "Test",
    payload: {
      headers: [{ name: "Subject", value: "Test" }],
    },
    internalDate: "1700000000000",
  };

  const fetchStub = stub(globalThis, "fetch", (url) => {
    capturedUrl = url.toString();
    return Promise.resolve(
      new Response(JSON.stringify(mockMessage), { status: 200 })
    );
  });

  try {
    const { getMessage } = await import("../gmail.ts");

    const result = await getMessage("test-access-token", "msg123");

    assertEquals(result.id, "msg123");
    assertEquals(capturedUrl.includes("format=full"), true);
  } finally {
    fetchStub.restore();
  }
});

// ============================================
// Draft Creation Tests
// ============================================

Deno.test("createDraft - sends correctly formatted request", async () => {
  let capturedBody = "";

  const mockResponse = {
    id: "draft123",
    message: { id: "msg789", threadId: "thread456" },
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
    const { createDraft } = await import("../gmail.ts");

    const result = await createDraft("test-access-token", {
      threadId: "thread456",
      to: "customer@example.com",
      subject: "Test Subject",
      body: "Hello, this is the reply body.",
    });

    assertEquals(result.id, "draft123");

    // Parse the captured body
    const parsed = JSON.parse(capturedBody);
    assertEquals(parsed.message.threadId, "thread456");
    assertExists(parsed.message.raw);

    // Decode the raw message
    const rawDecoded = atob(
      parsed.message.raw.replace(/-/g, "+").replace(/_/g, "/")
    );
    assertEquals(rawDecoded.includes("To: customer@example.com"), true);
    assertEquals(rawDecoded.includes("Re: Test Subject"), true);
    assertEquals(rawDecoded.includes("Hello, this is the reply body"), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("createDraft - includes In-Reply-To header when provided", async () => {
  let capturedBody = "";

  const mockResponse = {
    id: "draft123",
    message: { id: "msg789", threadId: "thread456" },
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
    const { createDraft } = await import("../gmail.ts");

    await createDraft("test-access-token", {
      threadId: "thread456",
      to: "customer@example.com",
      subject: "Test Subject",
      body: "Reply body",
      inReplyTo: "<original-message-id@example.com>",
      references: "<original-message-id@example.com>",
    });

    const parsed = JSON.parse(capturedBody);
    const rawDecoded = atob(
      parsed.message.raw.replace(/-/g, "+").replace(/_/g, "/")
    );

    assertEquals(
      rawDecoded.includes("In-Reply-To: <original-message-id@example.com>"),
      true
    );
    assertEquals(
      rawDecoded.includes("References: <original-message-id@example.com>"),
      true
    );
  } finally {
    fetchStub.restore();
  }
});

// ============================================
// Label Management Tests
// ============================================

Deno.test("ensureLabel - returns existing label ID", async () => {
  const mockLabels = {
    labels: [
      { id: "Label_1", name: "Noxfolk/Booking", type: "user" },
      { id: "Label_2", name: "Noxfolk/General", type: "user" },
    ],
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify(mockLabels), { status: 200 })
      )
  );

  try {
    const { ensureLabel } = await import("../gmail.ts");

    const result = await ensureLabel("test-access-token", "Noxfolk/Booking");

    assertEquals(result, "Label_1");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("ensureLabel - creates label if not exists", async () => {
  let requestCount = 0;

  const fetchStub = stub(globalThis, "fetch", (url, init) => {
    requestCount++;

    if (requestCount === 1) {
      // First call: list labels (empty)
      return Promise.resolve(
        new Response(JSON.stringify({ labels: [] }), { status: 200 })
      );
    } else {
      // Second call: create label
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "Label_New",
            name: "Noxfolk/NewLabel",
            type: "user",
          }),
          { status: 200 }
        )
      );
    }
  });

  try {
    const { ensureLabel } = await import("../gmail.ts");

    const result = await ensureLabel("test-access-token", "Noxfolk/NewLabel");

    assertEquals(result, "Label_New");
    assertEquals(requestCount, 2); // List + Create
  } finally {
    fetchStub.restore();
  }
});

// ============================================
// Error Handling Tests
// ============================================

Deno.test("refreshAccessToken - throws on API error", async () => {
  Deno.env.set("GMAIL_CLIENT_ID", "test-client-id");
  Deno.env.set("GMAIL_CLIENT_SECRET", "test-client-secret");

  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: "invalid_grant" }),
          { status: 400 }
        )
      )
  );

  try {
    const { refreshAccessToken } = await import("../gmail.ts");

    await assertRejects(
      async () => await refreshAccessToken("invalid-refresh-token"),
      Error
    );
  } finally {
    fetchStub.restore();
    Deno.env.delete("GMAIL_CLIENT_ID");
    Deno.env.delete("GMAIL_CLIENT_SECRET");
  }
});

Deno.test("exchangeCodeForTokens - throws when no refresh token", async () => {
  Deno.env.set("GMAIL_CLIENT_ID", "test-client-id");
  Deno.env.set("GMAIL_CLIENT_SECRET", "test-client-secret");

  // Response without refresh_token
  const mockResponse = {
    access_token: "test-access-token",
    expires_in: 3600,
    // No refresh_token!
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
    const { exchangeCodeForTokens } = await import("../gmail.ts");

    await assertRejects(
      async () =>
        await exchangeCodeForTokens("auth-code", "https://example.com/callback"),
      Error,
      "refresh token"
    );
  } finally {
    fetchStub.restore();
    Deno.env.delete("GMAIL_CLIENT_ID");
    Deno.env.delete("GMAIL_CLIENT_SECRET");
  }
});
