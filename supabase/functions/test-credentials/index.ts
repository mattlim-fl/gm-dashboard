/**
 * Test Credentials Edge Function
 * Tests API credentials by making a simple API call to each service
 */

// @ts-expect-error - Deno remote import types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import {
  getSquareCredentials,
  getResendCredentials,
  getGmailCredentials,
  getXeroCredentials,
  updateVerificationStatus,
  IntegrationType,
} from "../_shared/credentials.ts";
import { config } from "../_shared/config.ts";

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

async function testSquare(accessToken: string, locationId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://connect.squareup.com/v2/locations/${locationId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Square-Version": "2023-10-18",
        },
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMsg = body?.errors?.[0]?.detail || `HTTP ${res.status}`;
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const locationName = data?.location?.name || "Unknown";
    return { success: true, message: `Connected to ${locationName}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testResend(apiKey: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMsg = body?.message || `HTTP ${res.status}`;
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const domainCount = data?.data?.length || 0;
    return { success: true, message: `Connected. ${domainCount} domain(s) configured.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testGmail(refreshToken: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Import gmail functions
    const { refreshAccessToken, listLabels } = await import("../_shared/gmail.ts");

    const { accessToken } = await refreshAccessToken(refreshToken);
    const labels = await listLabels(accessToken);

    return { success: true, message: `Connected. ${labels.length} labels found.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testXero(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  tenantId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // First refresh the access token
    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.json().catch(() => ({}));
      return { success: false, error: body?.error_description || "Token refresh failed" };
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Test API access
    const orgRes = await fetch("https://api.xero.com/api.xro/2.0/Organisation", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-Tenant-Id": tenantId,
        Accept: "application/json",
      },
    });

    if (!orgRes.ok) {
      return { success: false, error: `API error: HTTP ${orgRes.status}` };
    }

    const orgData = await orgRes.json();
    const orgName = orgData?.Organisations?.[0]?.Name || "Unknown";
    return { success: true, message: `Connected to ${orgName}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    const adminCheck = await requireAdmin(req, supabase);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await req.json();
    const { venue, integrationType } = body;

    if (!integrationType) {
      return json({ error: "integrationType is required" }, 400);
    }

    const validTypes: IntegrationType[] = ["square", "xero", "gmail", "resend"];
    if (!validTypes.includes(integrationType)) {
      return json({ error: `Invalid integration type: ${integrationType}` }, 400);
    }

    let result: { success: boolean; message?: string; error?: string };

    if (integrationType === "square") {
      const creds = await getSquareCredentials(supabase, venue);
      if (!creds) {
        return json({ success: false, error: "Square credentials not configured" });
      }
      result = await testSquare(creds.accessToken, creds.locationId);
    } else if (integrationType === "resend") {
      const creds = await getResendCredentials(supabase);
      if (!creds) {
        return json({ success: false, error: "Resend credentials not configured" });
      }
      result = await testResend(creds.apiKey);
    } else if (integrationType === "gmail") {
      const creds = await getGmailCredentials(supabase, venue);
      if (!creds) {
        return json({ success: false, error: "Gmail credentials not configured" });
      }
      result = await testGmail(creds.refresh_token);
    } else if (integrationType === "xero") {
      const creds = await getXeroCredentials(supabase, venue);
      if (!creds) {
        return json({ success: false, error: "Xero credentials not configured" });
      }
      result = await testXero(
        creds.client_id,
        creds.client_secret,
        creds.refresh_token,
        creds.tenant_id
      );
    } else {
      return json({ error: "Unsupported integration type" }, 400);
    }

    // Update verification status
    await updateVerificationStatus(
      supabase,
      venue,
      integrationType as IntegrationType,
      result.success ? "verified" : "failed",
      result.error
    );

    return json(result);
  } catch (error) {
    console.error("Error testing credentials:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
