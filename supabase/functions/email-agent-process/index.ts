/**
 * Email Agent Process
 * Main orchestrator for email processing:
 * 1. Fetch unread emails from Gmail
 * 2. Classify with Claude Haiku
 * 3. Load relevant knowledge files
 * 4. Generate draft with Claude Sonnet
 * 5. Create Gmail draft and apply labels
 * 6. Log everything to email_agent_logs
 */

// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import {
  refreshAccessToken,
  decryptRefreshToken,
  listUnreadEmails,
  getMessage,
  parseMessage,
  getThread,
  createDraft,
  deleteDraft,
  ensureLabel,
  modifyLabels,
  markAsRead,
  type ParsedEmail,
  type ThreadMessage,
} from "../_shared/gmail.ts";
import { classifyEmail, generateDraft } from "../_shared/claude.ts";

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-api-key, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface EmailCategory {
  category_key: string;
  display_name: string;
  gmail_label_name: string;
  auto_draft: boolean;
}

interface KnowledgeFile {
  title: string;
  content: string;
  category_key: string | null;
  is_global: boolean;
}

interface ProcessResult {
  emailId: string;
  threadId: string;
  status: "drafted" | "skipped" | "error";
  category?: string;
  draftId?: string;
  error?: string;
}

/**
 * Build knowledge context for a category
 * Includes global files (tone guide, FAQs, venue info) plus category-specific files
 */
function buildKnowledgeContext(
  files: KnowledgeFile[],
  category: string
): string {
  const relevantFiles = files.filter(
    (f) => f.is_global || f.category_key === category
  );

  if (relevantFiles.length === 0) {
    return "No specific knowledge available for this category.";
  }

  return relevantFiles
    .map((f) => `## ${f.title}\n\n${f.content}`)
    .join("\n\n---\n\n");
}

/**
 * Format thread history for context
 */
function formatThreadHistory(messages: ThreadMessage[]): string {
  if (messages.length <= 1) {
    return "";
  }

  // Exclude the latest message (which we're replying to)
  const previousMessages = messages.slice(0, -1);

  return previousMessages
    .map(
      (m) =>
        `From: ${m.fromName} <${m.from}>
Date: ${m.receivedAt.toISOString()}

${m.body}`
    )
    .join("\n\n---\n\n");
}

/**
 * Process a single email
 */
async function processEmail(
  supabase: any,
  accessToken: string,
  email: ParsedEmail,
  venue: string,
  categories: EmailCategory[],
  knowledgeFiles: KnowledgeFile[]
): Promise<ProcessResult> {
  const result: ProcessResult = {
    emailId: email.id,
    threadId: email.threadId,
    status: "error",
  };

  try {
    // Check if we've already processed this email
    const { data: existingLog } = await supabase
      .from("email_agent_logs")
      .select("id, status")
      .eq("gmail_message_id", email.id)
      .single();

    if (existingLog) {
      console.log(`Email ${email.id} already processed (${existingLog.status})`);
      result.status = "skipped";
      result.error = "Already processed";
      return result;
    }

    // Create initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from("email_agent_logs")
      .insert({
        venue,
        gmail_message_id: email.id,
        gmail_thread_id: email.threadId,
        from_email: email.from,
        from_name: email.fromName,
        subject: email.subject,
        received_at: email.receivedAt.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create log entry:", logError);
      throw new Error(`Failed to create log entry: ${logError.message}`);
    }

    const logId = logEntry.id;

    // Step 1: Classify the email
    console.log(`Classifying email ${email.id}...`);
    const classification = await classifyEmail({
      from: `${email.fromName} <${email.from}>`,
      subject: email.subject,
      body: email.body,
    });

    result.category = classification.category;

    // Update log with classification
    await supabase
      .from("email_agent_logs")
      .update({
        classified_category: classification.category,
        classification_confidence: classification.confidence,
        classification_reasoning: classification.reasoning,
        classification_tokens_used: classification.tokensUsed,
        status: "classified",
      })
      .eq("id", logId);

    // Find category config
    const categoryConfig = categories.find(
      (c) => c.category_key === classification.category
    );

    // Apply Gmail label
    if (categoryConfig) {
      try {
        const labelId = await ensureLabel(
          accessToken,
          categoryConfig.gmail_label_name
        );
        await modifyLabels(accessToken, email.id, [labelId]);
        console.log(
          `Applied label ${categoryConfig.gmail_label_name} to email ${email.id}`
        );
      } catch (labelError) {
        console.error("Failed to apply label:", labelError);
        // Continue processing - label failure is not critical
      }
    }

    // Check if we should auto-draft
    if (!categoryConfig?.auto_draft) {
      console.log(
        `Skipping draft for ${classification.category} (auto_draft disabled)`
      );

      await supabase
        .from("email_agent_logs")
        .update({
          status: "skipped",
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      // Mark as read since we've processed it
      await markAsRead(accessToken, email.id);

      result.status = "skipped";
      return result;
    }

    // Step 2: Get thread history for context (if this is a reply)
    let threadHistory = "";
    try {
      const threadMessages = await getThread(accessToken, email.threadId);
      if (threadMessages.length > 1) {
        threadHistory = formatThreadHistory(threadMessages);
      }
    } catch (threadError) {
      console.warn("Failed to get thread history:", threadError);
      // Continue without thread history
    }

    // Step 3: Build knowledge context
    const knowledgeContext = buildKnowledgeContext(
      knowledgeFiles,
      classification.category
    );

    // Step 4: Generate draft
    console.log(`Generating draft for email ${email.id}...`);
    const draftResult = await generateDraft(
      {
        from: email.from,
        fromName: email.fromName,
        subject: email.subject,
        body: email.body,
        threadHistory: threadHistory || undefined,
      },
      classification.category,
      knowledgeContext
    );

    // Step 5: Check if there's an existing draft for this thread and delete it
    // (for thread follow-ups, we want to replace the old draft)
    const { data: existingDrafts } = await supabase
      .from("email_agent_logs")
      .select("gmail_draft_id")
      .eq("gmail_thread_id", email.threadId)
      .eq("status", "drafted")
      .not("gmail_draft_id", "is", null);

    if (existingDrafts && existingDrafts.length > 0) {
      for (const existing of existingDrafts) {
        try {
          await deleteDraft(accessToken, existing.gmail_draft_id);
          console.log(`Deleted old draft ${existing.gmail_draft_id}`);
        } catch (deleteError) {
          console.warn(
            `Failed to delete old draft ${existing.gmail_draft_id}:`,
            deleteError
          );
        }
      }
    }

    // Step 6: Create Gmail draft
    console.log(`Creating draft in Gmail for email ${email.id}...`);
    const gmailDraft = await createDraft(accessToken, {
      threadId: email.threadId,
      to: email.from,
      subject: email.subject,
      body: draftResult.draft,
    });

    result.draftId = gmailDraft.id;

    // Step 7: Update log with draft info
    await supabase
      .from("email_agent_logs")
      .update({
        draft_content: draftResult.draft,
        gmail_draft_id: gmailDraft.id,
        draft_tokens_used: draftResult.tokensUsed,
        status: "drafted",
        processed_at: new Date().toISOString(),
      })
      .eq("id", logId);

    // Mark original email as read
    await markAsRead(accessToken, email.id);

    result.status = "drafted";
    console.log(`Successfully drafted reply for email ${email.id}`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing email ${email.id}:`, errorMessage);

    // Update log with error
    await supabase
      .from("email_agent_logs")
      .update({
        status: "error",
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("gmail_message_id", email.id);

    result.status = "error";
    result.error = errorMessage;
    return result;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Supabase credentials not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const venue = body.venue as string;

    if (!venue) {
      return json({ error: "venue is required" }, 400);
    }

    // Fetch venue config
    const { data: config, error: configError } = await supabase
      .from("email_agent_config")
      .select("*")
      .eq("venue", venue)
      .eq("enabled", true)
      .single();

    if (configError || !config) {
      return json(
        { error: "Venue not configured or not enabled", venue },
        400
      );
    }

    if (!config.gmail_refresh_token_encrypted) {
      return json({ error: "Gmail not connected for this venue", venue }, 400);
    }

    // Decrypt refresh token and get access token
    console.log(`Getting access token for ${venue}...`);
    const refreshToken = await decryptRefreshToken(
      config.gmail_refresh_token_encrypted
    );
    const { accessToken } = await refreshAccessToken(refreshToken);

    // Fetch email categories
    const { data: categories, error: catError } = await supabase
      .from("email_categories")
      .select("*");

    if (catError) {
      throw new Error(`Failed to fetch categories: ${catError.message}`);
    }

    // Fetch knowledge files for this venue
    const { data: knowledgeFiles, error: kfError } = await supabase
      .from("knowledge_files")
      .select("title, content, category_key, is_global")
      .eq("venue", venue);

    if (kfError) {
      throw new Error(`Failed to fetch knowledge files: ${kfError.message}`);
    }

    // Fetch unread emails
    console.log(`Fetching unread emails for ${venue}...`);
    const unreadEmails = await listUnreadEmails(accessToken, 10);

    if (unreadEmails.length === 0) {
      console.log(`No unread emails for ${venue}`);
      return json({
        success: true,
        message: "No unread emails",
        venue,
        processed: 0,
      });
    }

    console.log(`Found ${unreadEmails.length} unread emails for ${venue}`);

    // Process each email
    const results: ProcessResult[] = [];

    for (const emailRef of unreadEmails) {
      try {
        // Get full email message
        const message = await getMessage(accessToken, emailRef.id);
        const email = parseMessage(message);

        const result = await processEmail(
          supabase,
          accessToken,
          email,
          venue,
          categories as EmailCategory[],
          knowledgeFiles as KnowledgeFile[]
        );

        results.push(result);
      } catch (emailError) {
        console.error(`Error processing email ${emailRef.id}:`, emailError);
        results.push({
          emailId: emailRef.id,
          threadId: emailRef.threadId,
          status: "error",
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
        });
      }
    }

    const drafted = results.filter((r) => r.status === "drafted").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    console.log(
      `Processing complete for ${venue}: ${drafted} drafted, ${skipped} skipped, ${errors} errors`
    );

    return json({
      success: true,
      venue,
      processed: results.length,
      summary: { drafted, skipped, errors },
      results,
    });
  } catch (error) {
    console.error("Email agent process error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
