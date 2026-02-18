/**
 * Email Agent OAuth
 * Handles Gmail OAuth flow:
 * 1. GET /start?venue=hippie - Redirects to Google consent screen
 * 2. GET /callback?code=...&state=... - Exchanges code for tokens and saves
 */

// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  encryptRefreshToken,
} from "../_shared/gmail.ts";

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

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase credentials not configured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Build the redirect URI (callback endpoint)
  const redirectUri = `${SUPABASE_URL}/functions/v1/email-agent-oauth/callback`;

  try {
    // =====================================================
    // GET /start - Initiate OAuth flow
    // =====================================================
    if (path === "start" && req.method === "GET") {
      const venue = url.searchParams.get("venue");

      if (!venue || !["hippie", "manor"].includes(venue)) {
        return json({ error: "Invalid or missing venue parameter" }, 400);
      }

      // Check if venue config exists
      const { data: config, error: configError } = await supabase
        .from("email_agent_config")
        .select("id")
        .eq("venue", venue)
        .single();

      if (configError || !config) {
        // Create config if it doesn't exist
        const { error: insertError } = await supabase
          .from("email_agent_config")
          .insert({
            venue,
            mailbox_email: `info@${venue === "hippie" ? "hippieclub" : "manorleederville"}.com`,
            enabled: false,
            poll_interval_minutes: 5,
          });

        if (insertError && insertError.code !== "23505") {
          // 23505 = unique violation (already exists)
          return json(
            { error: "Failed to create venue config", details: insertError },
            500
          );
        }
      }

      // Generate state parameter (venue encoded for callback)
      const state = btoa(JSON.stringify({ venue }));

      // Build Google OAuth URL
      const authUrl = buildAuthUrl(redirectUri, state);

      console.log(`Redirecting to Google OAuth for venue ${venue}`);
      return redirect(authUrl);
    }

    // =====================================================
    // GET /callback - Handle OAuth callback
    // =====================================================
    if (path === "callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      // Handle OAuth errors
      if (error) {
        console.error("OAuth error:", error);
        return redirect(
          `${APP_URL}/settings?tab=email-agent&error=${encodeURIComponent(error)}`
        );
      }

      if (!code || !state) {
        return json({ error: "Missing code or state parameter" }, 400);
      }

      // Decode state to get venue
      let venue: string;
      try {
        const stateData = JSON.parse(atob(state));
        venue = stateData.venue;
      } catch {
        return json({ error: "Invalid state parameter" }, 400);
      }

      if (!venue || !["hippie", "manor"].includes(venue)) {
        return json({ error: "Invalid venue in state" }, 400);
      }

      // Exchange code for tokens
      console.log(`Exchanging OAuth code for tokens for venue ${venue}...`);
      const tokens = await exchangeCodeForTokens(code, redirectUri);

      // Encrypt refresh token
      const encryptedRefreshToken = await encryptRefreshToken(
        tokens.refreshToken
      );

      // Update venue config with encrypted refresh token
      const { error: updateError } = await supabase
        .from("email_agent_config")
        .update({
          gmail_refresh_token_encrypted: encryptedRefreshToken,
          updated_at: new Date().toISOString(),
        })
        .eq("venue", venue);

      if (updateError) {
        console.error("Failed to save tokens:", updateError);
        return redirect(
          `${APP_URL}/settings?tab=email-agent&error=${encodeURIComponent("Failed to save tokens")}`
        );
      }

      console.log(`Successfully connected Gmail for venue ${venue}`);

      // Redirect back to settings with success message
      return redirect(
        `${APP_URL}/settings?tab=email-agent&success=gmail_connected&venue=${venue}`
      );
    }

    // =====================================================
    // POST /disconnect - Disconnect Gmail
    // =====================================================
    if (path === "disconnect" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const venue = body.venue as string;

      if (!venue || !["hippie", "manor"].includes(venue)) {
        return json({ error: "Invalid or missing venue" }, 400);
      }

      // Clear the refresh token
      const { error: updateError } = await supabase
        .from("email_agent_config")
        .update({
          gmail_refresh_token_encrypted: null,
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("venue", venue);

      if (updateError) {
        return json(
          { error: "Failed to disconnect", details: updateError.message },
          500
        );
      }

      console.log(`Disconnected Gmail for venue ${venue}`);
      return json({ success: true, message: "Gmail disconnected" });
    }

    // =====================================================
    // POST /test - Test Gmail connection
    // =====================================================
    if (path === "test" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const venue = body.venue as string;

      if (!venue || !["hippie", "manor"].includes(venue)) {
        return json({ error: "Invalid or missing venue" }, 400);
      }

      // Fetch venue config
      const { data: config, error: configError } = await supabase
        .from("email_agent_config")
        .select("gmail_refresh_token_encrypted, mailbox_email")
        .eq("venue", venue)
        .single();

      if (configError || !config) {
        return json({ error: "Venue not configured" }, 400);
      }

      if (!config.gmail_refresh_token_encrypted) {
        return json({ error: "Gmail not connected" }, 400);
      }

      try {
        // Import gmail functions
        const { refreshAccessToken, decryptRefreshToken, listLabels } =
          await import("../_shared/gmail.ts");

        // Decrypt and refresh token
        const refreshToken = await decryptRefreshToken(
          config.gmail_refresh_token_encrypted
        );
        const { accessToken } = await refreshAccessToken(refreshToken);

        // Test API access by listing labels
        const labels = await listLabels(accessToken);

        return json({
          success: true,
          message: "Gmail connection successful",
          mailbox: config.mailbox_email,
          labelCount: labels.length,
        });
      } catch (testError) {
        const errorMessage =
          testError instanceof Error ? testError.message : String(testError);
        console.error("Gmail test failed:", errorMessage);
        return json({
          success: false,
          error: "Gmail test failed",
          details: errorMessage,
        });
      }
    }

    // Unknown path
    return json({ error: "Unknown endpoint" }, 404);
  } catch (error) {
    console.error("OAuth error:", error);
    const message = error instanceof Error ? error.message : String(error);

    // For callback errors, redirect to settings with error
    if (path === "callback") {
      return redirect(
        `${APP_URL}/settings?tab=email-agent&error=${encodeURIComponent(message)}`
      );
    }

    return json({ success: false, error: message }, 500);
  }
});
