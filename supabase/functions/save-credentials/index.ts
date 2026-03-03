/**
 * Save Credentials Edge Function
 * Encrypts and saves API credentials to the database
 */

// @ts-expect-error - Deno remote import types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import { saveCredentials, IntegrationType } from "../_shared/credentials.ts";
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

  return { ok: true as const, userId: userData.user.id as string };
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
    const { venue, integrationType, credentials } = body;

    if (!integrationType) {
      return json({ error: "integrationType is required" }, 400);
    }

    if (!credentials || typeof credentials !== "object") {
      return json({ error: "credentials object is required" }, 400);
    }

    // Validate integration type
    const validTypes: IntegrationType[] = ["square", "xero", "gmail", "resend"];
    if (!validTypes.includes(integrationType)) {
      return json({ error: `Invalid integration type: ${integrationType}` }, 400);
    }

    // Validate required fields per integration type
    if (integrationType === "square") {
      if (!credentials.access_token) {
        return json(
          { error: "Square credentials require access_token" },
          400
        );
      }
    } else if (integrationType === "resend") {
      if (!credentials.api_key) {
        return json({ error: "Resend credentials require api_key" }, 400);
      }
    }

    console.log(`Saving credentials for ${integrationType}, venue: ${venue}`);

    const result = await saveCredentials(
      supabase,
      venue || null,
      integrationType as IntegrationType,
      credentials,
      adminCheck.userId
    );

    console.log(`Save result:`, result);

    if (!result.success) {
      console.error(`Save failed: ${result.error}`);
      return json({ success: false, error: result.error }, 400);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error saving credentials:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
