/**
 * Email Agent Scheduler
 * Triggered by pg_cron every 5 minutes to check for venues due for email polling
 * Invokes email-agent-process for each enabled venue
 */

// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import { config } from "../_shared/config.ts";

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

interface EmailAgentConfig {
  id: string;
  venue: string;
  mailbox_email: string;
  enabled: boolean;
  poll_interval_minutes: number;
  last_poll_at: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = config.supabaseUrl;
    const SUPABASE_ANON_KEY = config.supabaseAnonKey || "";

    const supabase = createClient(SUPABASE_URL, config.supabaseServiceKey);

    // Fetch all enabled email agent configs
    const { data: configs, error: configError } = await supabase
      .from("email_agent_config")
      .select("*")
      .eq("enabled", true);

    if (configError) {
      console.error("Error fetching email agent configs:", configError);
      return json(
        { error: "Failed to fetch configs", details: configError.message },
        500
      );
    }

    if (!configs || configs.length === 0) {
      console.log("No enabled email agent configs found");
      return json({
        success: true,
        message: "No enabled email agent configs",
        processed: 0,
      });
    }

    const now = new Date();
    const results: Array<{
      venue: string;
      status: "processed" | "skipped" | "error";
      reason?: string;
    }> = [];

    for (const config of configs as EmailAgentConfig[]) {
      // Check if it's time to poll based on poll_interval_minutes
      if (config.last_poll_at) {
        const lastPoll = new Date(config.last_poll_at);
        const minutesSinceLastPoll =
          (now.getTime() - lastPoll.getTime()) / (1000 * 60);

        if (minutesSinceLastPoll < config.poll_interval_minutes) {
          results.push({
            venue: config.venue,
            status: "skipped",
            reason: `Not due yet (${Math.round(minutesSinceLastPoll)}/${config.poll_interval_minutes} min)`,
          });
          continue;
        }
      }

      // Check if the config has a refresh token configured
      const { data: fullConfig } = await supabase
        .from("email_agent_config")
        .select("gmail_refresh_token_encrypted")
        .eq("id", config.id)
        .single();

      if (!fullConfig?.gmail_refresh_token_encrypted) {
        results.push({
          venue: config.venue,
          status: "skipped",
          reason: "Gmail not connected (no refresh token)",
        });
        continue;
      }

      // Invoke email-agent-process for this venue
      console.log(`Invoking email-agent-process for ${config.venue}...`);

      try {
        const controller = new AbortController();
        // Use 45s timeout to leave buffer before Edge Function's 60s limit
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/email-agent-process`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY}`,
              apikey: SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ venue: config.venue }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `email-agent-process failed for ${config.venue}:`,
            errorText
          );
          results.push({
            venue: config.venue,
            status: "error",
            reason: `Process failed: ${response.status}`,
          });
          continue;
        }

        const result = await response.json();

        // Update last_poll_at regardless of processing result
        await supabase
          .from("email_agent_config")
          .update({ last_poll_at: now.toISOString() })
          .eq("id", config.id);

        results.push({
          venue: config.venue,
          status: "processed",
          reason: `Processed ${result.processed || 0} emails`,
        });
      } catch (fetchError: unknown) {
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(
          `Error invoking email-agent-process for ${config.venue}:`,
          errorMessage
        );

        if (
          fetchError instanceof Error &&
          fetchError.name === "AbortError"
        ) {
          results.push({
            venue: config.venue,
            status: "error",
            reason: "Request timed out",
          });
        } else {
          results.push({
            venue: config.venue,
            status: "error",
            reason: errorMessage,
          });
        }
      }
    }

    const processed = results.filter((r) => r.status === "processed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    console.log(
      `Scheduler complete: ${processed} processed, ${skipped} skipped, ${errors} errors`
    );

    return json({
      success: true,
      message: "Scheduler run complete",
      summary: { processed, skipped, errors },
      results,
    });
  } catch (error) {
    console.error("Scheduler error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
