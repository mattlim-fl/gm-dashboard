/**
 * Check Credentials Status Edge Function
 * Returns credential availability and source (database vs env fallback) for all integrations
 */

// @ts-expect-error - Deno remote import types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import { config, isXeroConfigured, isGmailConfigured } from "../_shared/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-api-key, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type CredentialSource = 'database' | 'env' | 'none';

interface IntegrationStatus {
  source: CredentialSource;
  hasEnvFallback: boolean;
}

interface CredentialRow {
  id: string;
  venue: string | null;
  organization_id: string | null;
  integration_type: string;
  is_active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false as const, response: json({ success: false, error: "Unauthorized" }, 401) };
  }

  const token = authHeader.slice(7).trim();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const email = userData?.user?.email;
  if (userErr || !email) {
    return { ok: false as const, response: json({ success: false, error: "Unauthorized" }, 401) };
  }

  const { data: allowed, error: allowedErr } = await supabase
    .from("allowed_emails")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (allowedErr || allowed?.role !== "admin") {
    return { ok: false as const, response: json({ success: false, error: "Forbidden" }, 403) };
  }

  return { ok: true as const };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    const adminCheck = await requireAdmin(req, supabase);
    if (!adminCheck.ok) return adminCheck.response;

    // Check OAuth configuration (no env fallbacks for Square/Resend anymore)
    const envVars = {
      square: false, // No env fallback - credentials in database
      resend: false, // No env fallback - credentials in database
      xero: isXeroConfigured(),
      gmail: isGmailConfigured(),
    };

    // Fetch all credentials from database
    const { data: credentials, error: credError } = await supabase
      .from("venue_api_credentials")
      .select("id, venue, organization_id, integration_type, is_active");

    if (credError) {
      console.error("Error fetching credentials:", credError);
      return json({ error: "Failed to fetch credentials" }, 500);
    }

    const dbCredentials = (credentials || []) as CredentialRow[];

    // Fetch venue-organization mappings
    const { data: venueOrgs, error: voError } = await supabase
      .from("venue_organizations")
      .select("venue, organization_id");

    if (voError) {
      console.error("Error fetching venue organizations:", voError);
    }

    const venueOrgMap = new Map<string, string>();
    for (const vo of (venueOrgs || []) as { venue: string; organization_id: string }[]) {
      venueOrgMap.set(vo.venue, vo.organization_id);
    }

    // Fetch organizations
    const { data: orgs } = await supabase.from("organizations").select("id, name");
    const organizations = (orgs || []) as { id: string; name: string }[];

    // Build status for each integration type and scope
    const result: {
      global: Record<string, IntegrationStatus>;
      organizations: Record<string, Record<string, IntegrationStatus>>;
      venues: Record<string, Record<string, IntegrationStatus>>;
      envVars: typeof envVars;
    } = {
      global: {},
      organizations: {},
      venues: {},
      envVars,
    };

    // Global integrations (Resend)
    const resendCred = dbCredentials.find(
      (c) => c.integration_type === "resend" && c.venue === null && c.organization_id === null && c.is_active
    );
    result.global.resend = {
      source: resendCred ? 'database' : (envVars.resend ? 'env' : 'none'),
      hasEnvFallback: envVars.resend,
    };

    // Per-organization integrations (Square, Xero)
    for (const org of organizations) {
      result.organizations[org.id] = {};

      const squareCred = dbCredentials.find(
        (c) => c.integration_type === "square" && c.organization_id === org.id && c.venue === null && c.is_active
      );
      result.organizations[org.id].square = {
        source: squareCred ? 'database' : (envVars.square ? 'env' : 'none'),
        hasEnvFallback: envVars.square,
      };

      const xeroCred = dbCredentials.find(
        (c) => c.integration_type === "xero" && c.organization_id === org.id && c.venue === null && c.is_active
      );
      result.organizations[org.id].xero = {
        source: xeroCred ? 'database' : (envVars.xero ? 'env' : 'none'),
        hasEnvFallback: envVars.xero,
      };
    }

    // Per-venue integrations (Gmail)
    const venues = ['manor', 'hippie', 'daisy'];
    for (const venue of venues) {
      result.venues[venue] = {};

      const gmailCred = dbCredentials.find(
        (c) => c.integration_type === "gmail" && c.venue === venue && c.is_active
      );
      result.venues[venue].gmail = {
        source: gmailCred ? 'database' : 'none',
        hasEnvFallback: false,
      };
    }

    return json({ success: true, status: result });
  } catch (error) {
    console.error("Error checking credentials status:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
