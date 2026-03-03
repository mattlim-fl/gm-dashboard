/**
 * Gmail API client for email agent
 * Handles OAuth token refresh, fetching emails, creating drafts, and applying labels
 */

import { withRetry, RetryOptions } from "./retry.ts";
import { encryptToken, decryptToken } from "./crypto.ts";
import { config, isGmailConfigured } from "./config.ts";

// Gmail API constants
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Scopes needed for email agent
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
];

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    }>;
  };
  internalDate: string;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: Date;
  labelIds: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

export interface ThreadMessage {
  id: string;
  from: string;
  fromName: string;
  body: string;
  receivedAt: Date;
}

/**
 * Get Gmail OAuth credentials from environment
 */
function getCredentials(): GmailCredentials {
  const clientId = config.gmailClientId;
  const clientSecret = config.gmailClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Gmail OAuth credentials not configured");
  }

  return { clientId, clientSecret };
}

/**
 * Get encryption key for token storage
 */
function getEncryptionKey(): string {
  return config.credentialsEncryptionKey;
}

/**
 * Encrypt a refresh token for storage
 */
export async function encryptRefreshToken(token: string): Promise<string> {
  return encryptToken(token, getEncryptionKey());
}

/**
 * Decrypt a stored refresh token
 */
export async function decryptRefreshToken(encrypted: string): Promise<string> {
  return decryptToken(encrypted, getEncryptionKey());
}

/**
 * Error class for Gmail authentication failures
 * Used to distinguish auth errors that require user re-authorization
 */
export class GmailAuthError extends Error {
  constructor(
    message: string,
    public readonly requiresReconnect: boolean = false
  ) {
    super(message);
    this.name = "GmailAuthError";
  }
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  retryOptions?: RetryOptions
): Promise<{ accessToken: string; expiresIn: number }> {
  const credentials = getCredentials();

  const makeRequest = async () => {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    // Check for specific OAuth errors that require re-authorization
    if (data.error) {
      const errorCode = data.error;
      const errorDesc = data.error_description || "";

      // These errors mean the refresh token is no longer valid
      if (
        errorCode === "invalid_grant" ||
        errorCode === "invalid_token" ||
        errorDesc.includes("Token has been expired or revoked") ||
        errorDesc.includes("Token has been revoked")
      ) {
        throw new GmailAuthError(
          `Gmail authorization expired or revoked. User needs to reconnect Gmail. (${errorCode}: ${errorDesc})`,
          true
        );
      }

      throw new Error(`Token refresh failed: ${errorCode} - ${errorDesc}`);
    }

    if (!response.ok) {
      throw new Error(`Token refresh failed (${response.status})`);
    }

    // Verify we actually got an access token
    if (!data.access_token) {
      throw new GmailAuthError(
        "Token refresh returned no access token. User may need to reconnect Gmail.",
        true
      );
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  };

  // Don't retry auth errors - they won't succeed on retry
  return withRetry(makeRequest, {
    maxRetries: 2,
    initialDelayMs: 500,
    isRetryable: (error) => {
      // Don't retry if it's an auth error requiring reconnect
      if (error instanceof GmailAuthError && error.requiresReconnect) {
        return false;
      }
      // For other errors, use default retry logic (check for retryable status codes)
      return true;
    },
    ...retryOptions,
  });
}

/**
 * Build OAuth authorization URL for initial consent
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const credentials = getCredentials();

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const credentials = getCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${error}`);
  }

  const data = await response.json();

  if (!data.refresh_token) {
    throw new Error("No refresh token received. Re-authorize with consent prompt.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Make an authenticated Gmail API request
 */
async function gmailRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {},
  retryOptions?: RetryOptions
): Promise<T> {
  const makeRequest = async () => {
    const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  };

  return withRetry(makeRequest, {
    maxRetries: 2,
    initialDelayMs: 500,
    retryableStatuses: [429, 500, 502, 503],
    ...retryOptions,
  });
}

/**
 * List unread emails from inbox
 */
export async function listUnreadEmails(
  accessToken: string,
  maxResults: number = 10
): Promise<Array<{ id: string; threadId: string }>> {
  const query = encodeURIComponent("is:unread in:inbox");
  const response = await gmailRequest<{
    messages?: Array<{ id: string; threadId: string }>;
  }>(accessToken, `/users/me/messages?q=${query}&maxResults=${maxResults}`);

  return response.messages || [];
}

/**
 * Get full email message by ID
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(
    accessToken,
    `/users/me/messages/${messageId}?format=full`
  );
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(encoded: string): string {
  // Replace URL-safe chars with standard base64 chars
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  // Decode
  const decoded = atob(base64);
  // Handle UTF-8
  try {
    return decodeURIComponent(
      decoded
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return decoded;
  }
}

/**
 * Extract plain text body from email message
 */
function extractBody(message: GmailMessage): string {
  const payload = message.payload;

  // Check for direct body data
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Check parts for text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Check nested parts (multipart/alternative)
      if (part.parts) {
        for (const nestedPart of part.parts) {
          if (nestedPart.mimeType === "text/plain" && nestedPart.body?.data) {
            return decodeBase64Url(nestedPart.body.data);
          }
        }
      }
    }

    // Fallback to text/html if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        // Basic HTML stripping
        return html
          .replace(/<style[^>]*>.*?<\/style>/gis, "")
          .replace(/<script[^>]*>.*?<\/script>/gis, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    }
  }

  return "";
}

/**
 * Parse a Gmail message into a structured format
 */
export function parseMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers;
  const getHeader = (name: string): string =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
    "";

  const fromRaw = getHeader("From");
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+)>$/);
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromRaw;
  const fromEmail = fromMatch ? fromMatch[2] : fromRaw;

  return {
    id: message.id,
    threadId: message.threadId,
    from: fromEmail,
    fromName: fromName,
    to: getHeader("To"),
    subject: getHeader("Subject"),
    body: extractBody(message),
    receivedAt: new Date(parseInt(message.internalDate)),
    labelIds: message.labelIds || [],
  };
}

/**
 * Get all messages in a thread
 */
export async function getThread(
  accessToken: string,
  threadId: string
): Promise<ThreadMessage[]> {
  const response = await gmailRequest<{
    messages: GmailMessage[];
  }>(accessToken, `/users/me/threads/${threadId}?format=full`);

  return response.messages.map((msg) => {
    const parsed = parseMessage(msg);
    return {
      id: parsed.id,
      from: parsed.from,
      fromName: parsed.fromName,
      body: parsed.body,
      receivedAt: parsed.receivedAt,
    };
  });
}

/**
 * Create a draft reply to an email
 */
export async function createDraft(
  accessToken: string,
  options: {
    threadId: string;
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string; // Message-ID header of the email being replied to
    references?: string; // References header for threading
  }
): Promise<{ id: string; message: { id: string; threadId: string } }> {
  // Build RFC 2822 formatted email
  const headers = [
    `To: ${options.to}`,
    `Subject: ${options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`}`,
    "Content-Type: text/plain; charset=utf-8",
  ];

  if (options.inReplyTo) {
    headers.push(`In-Reply-To: ${options.inReplyTo}`);
  }
  if (options.references) {
    headers.push(`References: ${options.references}`);
  }

  const rawEmail = [...headers, "", options.body].join("\r\n");

  // Base64url encode
  const encoded = btoa(rawEmail)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gmailRequest(accessToken, "/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw: encoded,
        threadId: options.threadId,
      },
    }),
  });
}

/**
 * Delete a draft
 */
export async function deleteDraft(
  accessToken: string,
  draftId: string
): Promise<void> {
  await gmailRequest(accessToken, `/users/me/drafts/${draftId}`, {
    method: "DELETE",
  });
}

/**
 * List all labels
 */
export async function listLabels(
  accessToken: string
): Promise<GmailLabel[]> {
  const response = await gmailRequest<{ labels: GmailLabel[] }>(
    accessToken,
    "/users/me/labels"
  );
  return response.labels || [];
}

/**
 * Create a label if it doesn't exist
 */
export async function ensureLabel(
  accessToken: string,
  labelName: string
): Promise<string> {
  // List existing labels
  const labels = await listLabels(accessToken);
  const existing = labels.find((l) => l.name === labelName);

  if (existing) {
    return existing.id;
  }

  // Create new label
  // For nested labels like "Noxfolk/Booking", Gmail handles this automatically
  const response = await gmailRequest<GmailLabel>(
    accessToken,
    "/users/me/labels",
    {
      method: "POST",
      body: JSON.stringify({
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      }),
    }
  );

  return response.id;
}

/**
 * Apply labels to a message and optionally remove others
 */
export async function modifyLabels(
  accessToken: string,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[] = []
): Promise<void> {
  await gmailRequest(accessToken, `/users/me/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds,
      removeLabelIds,
    }),
  });
}

/**
 * Mark a message as read
 */
export async function markAsRead(
  accessToken: string,
  messageId: string
): Promise<void> {
  await modifyLabels(accessToken, messageId, [], ["UNREAD"]);
}

/**
 * Check if Gmail OAuth is configured
 */
export function isConfigured(): boolean {
  return isGmailConfigured();
}
