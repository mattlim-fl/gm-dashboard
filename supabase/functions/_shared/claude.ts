/**
 * Claude API client for email classification and draft generation
 * Uses Haiku for classification (fast, cheap) and Sonnet for drafting (quality)
 */

import { withRetry, RetryOptions } from "./retry.ts";
import { config, isAnthropicConfigured } from "./config.ts";

// Model constants
export const CLAUDE_MODELS = {
  CLASSIFICATION: "claude-3-5-haiku-latest", // Fast, cheap for categorization
  DRAFTING: "claude-sonnet-4-20250514", // Quality for customer-facing replies
} as const;

// API configuration
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{
    type: "text";
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeError {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
  tokensUsed: number;
}

export interface DraftResult {
  draft: string;
  tokensUsed: number;
}

/**
 * Get the Anthropic API key from environment
 */
function getApiKey(): string {
  const apiKey = config.anthropicApiKey;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Make a request to the Claude API with retry logic
 */
async function callClaude(
  model: string,
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 1024,
  retryOptions?: RetryOptions
): Promise<ClaudeResponse> {
  const apiKey = getApiKey();

  const makeRequest = async (): Promise<ClaudeResponse> => {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Claude API error (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    if (data.type === "error") {
      const claudeError = data as ClaudeError;
      throw new Error(
        `Claude API error: ${claudeError.error.type} - ${claudeError.error.message}`
      );
    }

    return data as ClaudeResponse;
  };

  return withRetry(makeRequest, {
    maxRetries: 3,
    initialDelayMs: 1000,
    retryableStatuses: [429, 500, 502, 503, 504],
    ...retryOptions,
  });
}

/**
 * Extract text content from Claude response
 */
function extractText(response: ClaudeResponse): string {
  const textContent = response.content.find((c) => c.type === "text");
  return textContent?.text || "";
}

/**
 * Classification categories with descriptions for the prompt
 */
const CATEGORY_DESCRIPTIONS = `
- general_enquiry: Opening hours, location questions, general venue information
- booking: Table bookings, VIP area requests, group reservations, event bookings
- lost_and_found: Reports of lost items, inquiries about found items
- complaint: Negative experiences, complaints about service/staff/venue, refund requests
- ban_appeal: Requests to lift or review venue bans
- supplier: Communications from vendors, suppliers, sales pitches from businesses
- event_enquiry: DJ submissions, promoter pitches, event partnership requests
- spam: Marketing emails, newsletters, obvious spam, irrelevant automated messages
- other: Emails that don't clearly fit any other category
`;

/**
 * Classify an email into a category using Claude Haiku
 */
export async function classifyEmail(
  emailContent: {
    from: string;
    subject: string;
    body: string;
  },
  retryOptions?: RetryOptions
): Promise<ClassificationResult> {
  const systemPrompt = `You are an email classifier for Hippie Club, a nightclub in Perth, Australia.

Your task is to classify incoming emails into exactly one category.

Categories:
${CATEGORY_DESCRIPTIONS}

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{"category": "category_key", "confidence": 0.95, "reasoning": "Brief explanation"}

- confidence should be between 0.5 and 1.0
- reasoning should be 1-2 sentences max
- If unsure, default to "other" with lower confidence`;

  const userMessage = `Classify this email:

FROM: ${emailContent.from}
SUBJECT: ${emailContent.subject}

BODY:
${emailContent.body}`;

  const response = await callClaude(
    CLAUDE_MODELS.CLASSIFICATION,
    systemPrompt,
    [{ role: "user", content: userMessage }],
    256,
    retryOptions
  );

  const text = extractText(response);

  try {
    // Try to extract JSON from response (may have markdown code blocks)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    // Parse the JSON response
    const result = JSON.parse(jsonText);

    // Validate category is one of the expected values
    const validCategories = [
      "general_enquiry", "booking", "lost_and_found", "complaint",
      "ban_appeal", "supplier", "event_enquiry", "spam", "other"
    ];
    const category = validCategories.includes(result.category) ? result.category : "other";

    return {
      category,
      confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
      reasoning: result.reasoning || "",
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  } catch (parseError) {
    // Log the full response for debugging (truncate if very long)
    const truncatedText = text.length > 500 ? text.substring(0, 500) + "..." : text;
    console.error("Failed to parse classification response:", {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      response: truncatedText,
    });

    // Try to extract category from text as fallback
    const categoryMatch = text.match(/"category":\s*"([^"]+)"/);
    const extractedCategory = categoryMatch?.[1];

    // If we couldn't extract anything useful, throw to trigger retry
    if (!extractedCategory) {
      throw new Error(`Classification response was not valid JSON: ${truncatedText}`);
    }

    return {
      category: extractedCategory,
      confidence: 0.5,
      reasoning: "Parsed from malformed response",
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }
}

/**
 * Generate a draft reply using Claude Sonnet
 */
export async function generateDraft(
  email: {
    from: string;
    fromName: string;
    subject: string;
    body: string;
    threadHistory?: string; // Previous emails in the thread
  },
  category: string,
  knowledgeContext: string,
  retryOptions?: RetryOptions
): Promise<DraftResult> {
  const systemPrompt = `You are a helpful email assistant for Hippie Club, a nightclub in Perth, Australia.

Your task is to draft a reply to the customer's email. The draft will be reviewed by staff before sending.

Guidelines:
- Be friendly, professional, and helpful
- Address the customer by their first name if available
- Keep responses concise but complete
- Do not make promises about refunds or special treatment without explicitly noting these need manager approval
- Sign off warmly but professionally

Category of this email: ${category}

Knowledge base for this type of inquiry:
${knowledgeContext}

Generate ONLY the email body text. Do not include subject line, email headers, or explanations.
Start directly with the greeting (e.g., "Hi [Name]," or "Hello,").`;

  let userMessage = `Draft a reply to this email:

FROM: ${email.fromName} <${email.from}>
SUBJECT: ${email.subject}

`;

  if (email.threadHistory) {
    userMessage += `PREVIOUS MESSAGES IN THREAD:
${email.threadHistory}

LATEST MESSAGE TO REPLY TO:
`;
  }

  userMessage += email.body;

  const response = await callClaude(
    CLAUDE_MODELS.DRAFTING,
    systemPrompt,
    [{ role: "user", content: userMessage }],
    1024,
    retryOptions
  );

  return {
    draft: extractText(response).trim(),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

/**
 * Check if the API key is configured
 */
export function isConfigured(): boolean {
  return isAnthropicConfigured();
}
