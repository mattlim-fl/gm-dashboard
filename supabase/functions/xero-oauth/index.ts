/**
 * Xero OAuth Edge Function
 * Handles Xero OAuth flow:
 * 1. GET /start?venue=hippie - Redirects to Xero consent screen
 * 2. GET /callback?code=...&state=... - Exchanges code for tokens and saves
 * 3. POST /disconnect - Clear credentials
 * 4. POST /test - Test connection
 */

// @ts-expect-error - Deno remote import types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import {
  saveCredentials,
  getXeroCredentials,
  updateVerificationStatus,
} from "../_shared/credentials.ts";
import { encryptToken } from "../_shared/crypto.ts";

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

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

// Xero scopes needed for P&L and financial reporting
const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.reports.read",
  "accounting.settings.read",
  "accounting.transactions.read",
  "offline_access",
].join(" ");

function buildAuthUrl(redirectUri: string, state: string, clientId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: XERO_SCOPES,
    state: state,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Token exchange failed: ${errorBody}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function getXeroTenantId(accessToken: string): Promise<string> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to get Xero connections: ${errorBody}`);
  }

  const connections = await res.json();
  if (!connections || connections.length === 0) {
    throw new Error("No Xero organizations found. Please ensure you have access to at least one organization.");
  }

  // Use the first tenant (most common case)
  return connections[0].tenantId;
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
  const XERO_CLIENT_ID = Deno.env.get("XERO_CLIENT_ID");
  const XERO_CLIENT_SECRET = Deno.env.get("XERO_CLIENT_SECRET");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase credentials not configured" }, 500);
  }

  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    return json({ error: "Xero OAuth credentials not configured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Build the redirect URI (callback endpoint)
  const redirectUri = `${SUPABASE_URL}/functions/v1/xero-oauth/callback`;

  try {
    // =====================================================
    // GET /start - Initiate OAuth flow
    // =====================================================
    if (path === "start" && req.method === "GET") {
      const venue = url.searchParams.get("venue");

      if (!venue || !["hippie", "manor", "daisy"].includes(venue)) {
        return json({ error: "Invalid or missing venue parameter" }, 400);
      }

      // Generate state parameter (venue encoded for callback)
      const state = btoa(JSON.stringify({ venue }));

      // Build Xero OAuth URL
      const authUrl = buildAuthUrl(redirectUri, state, XERO_CLIENT_ID);

      console.log(`Redirecting to Xero OAuth for venue ${venue}`);
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
        console.error("Xero OAuth error:", error);
        return redirect(
          `${APP_URL}/settings?tab=api&error=${encodeURIComponent(error)}`
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

      if (!venue || !["hippie", "manor", "daisy"].includes(venue)) {
        return json({ error: "Invalid venue in state" }, 400);
      }

      // Exchange code for tokens
      console.log(`Exchanging Xero OAuth code for tokens for venue ${venue}...`);
      const tokens = await exchangeCodeForTokens(
        code,
        redirectUri,
        XERO_CLIENT_ID,
        XERO_CLIENT_SECRET
      );

      // Get tenant ID (organization ID)
      console.log("Getting Xero tenant ID...");
      const tenantId = await getXeroTenantId(tokens.accessToken);

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

      // Save credentials to database
      const result = await saveCredentials(
        supabase,
        venue,
        "xero",
        {
          client_id: XERO_CLIENT_ID,
          client_secret: XERO_CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          tenant_id: tenantId,
        }
      );

      if (!result.success) {
        console.error("Failed to save Xero tokens:", result.error);
        return redirect(
          `${APP_URL}/settings?tab=api&error=${encodeURIComponent("Failed to save tokens")}`
        );
      }

      // Update with OAuth expiry and verification status
      await updateVerificationStatus(supabase, venue, "xero", "verified");

      console.log(`Successfully connected Xero for venue ${venue}`);

      // Redirect back to settings with success message
      return redirect(
        `${APP_URL}/settings?tab=api&success=xero_connected&venue=${venue}`
      );
    }

    // =====================================================
    // POST /disconnect - Disconnect Xero
    // =====================================================
    if (path === "disconnect" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const venue = body.venue as string;

      if (!venue || !["hippie", "manor", "daisy"].includes(venue)) {
        return json({ error: "Invalid or missing venue" }, 400);
      }

      // Get the organization for this venue
      const { data: venueOrg } = await supabase
        .from("venue_organizations")
        .select("organization_id")
        .eq("venue", venue)
        .single();

      if (!venueOrg) {
        return json({ error: "Venue organization not found" }, 400);
      }

      // Delete the credentials
      const { error: deleteError } = await supabase
        .from("venue_api_credentials")
        .delete()
        .is("venue", null)
        .eq("organization_id", venueOrg.organization_id)
        .eq("integration_type", "xero");

      if (deleteError) {
        return json(
          { error: "Failed to disconnect", details: deleteError.message },
          500
        );
      }

      console.log(`Disconnected Xero for venue ${venue}`);
      return json({ success: true, message: "Xero disconnected" });
    }

    // =====================================================
    // POST /test - Test Xero connection
    // =====================================================
    if (path === "test" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const venue = body.venue as string;

      if (!venue || !["hippie", "manor", "daisy"].includes(venue)) {
        return json({ error: "Invalid or missing venue" }, 400);
      }

      // Get credentials
      const creds = await getXeroCredentials(supabase, venue);
      if (!creds) {
        return json({ error: "Xero not connected" }, 400);
      }

      try {
        // Refresh access token
        const tokenRes = await fetch(XERO_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${creds.client_id}:${creds.client_secret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: creds.refresh_token,
          }),
        });

        if (!tokenRes.ok) {
          const errorBody = await tokenRes.json().catch(() => ({}));
          throw new Error(errorBody?.error_description || "Token refresh failed");
        }

        const tokenData = await tokenRes.json();

        // Test API access
        const orgRes = await fetch("https://api.xero.com/api.xro/2.0/Organisation", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Xero-Tenant-Id": creds.tenant_id,
            Accept: "application/json",
          },
        });

        if (!orgRes.ok) {
          throw new Error(`API error: HTTP ${orgRes.status}`);
        }

        const orgData = await orgRes.json();
        const orgName = orgData?.Organisations?.[0]?.Name || "Unknown";

        // Update new refresh token if provided
        if (tokenData.refresh_token && tokenData.refresh_token !== creds.refresh_token) {
          await saveCredentials(supabase, venue, "xero", {
            ...creds,
            refresh_token: tokenData.refresh_token,
          });
        }

        await updateVerificationStatus(supabase, venue, "xero", "verified");

        return json({
          success: true,
          message: `Connected to ${orgName}`,
        });
      } catch (testError) {
        const errorMessage =
          testError instanceof Error ? testError.message : String(testError);
        console.error("Xero test failed:", errorMessage);

        await updateVerificationStatus(supabase, venue, "xero", "failed", errorMessage);

        return json({
          success: false,
          error: "Xero test failed",
          details: errorMessage,
        });
      }
    }

    // Unknown path
    return json({ error: "Unknown endpoint" }, 404);
  } catch (error) {
    console.error("Xero OAuth error:", error);
    const message = error instanceof Error ? error.message : String(error);

    // For callback errors, redirect to settings with error
    if (path === "callback") {
      return redirect(
        `${APP_URL}/settings?tab=api&error=${encodeURIComponent(message)}`
      );
    }

    return json({ success: false, error: message }, 500);
  }
});
