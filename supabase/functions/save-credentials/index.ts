/**
 * Save Credentials Edge Function
 * Encrypts and saves API credentials to the database
 */

// @ts-expect-error - Deno remote import types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1";
import { saveCredentials, IntegrationType } from "../_shared/credentials.ts";

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

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
      if (!credentials.access_token || !credentials.location_id) {
        return json(
          { error: "Square credentials require access_token and location_id" },
          400
        );
      }
    } else if (integrationType === "resend") {
      if (!credentials.api_key) {
        return json({ error: "Resend credentials require api_key" }, 400);
      }
    }

    // Get user ID from auth header if available
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }

    const result = await saveCredentials(
      supabase,
      venue || null,
      integrationType as IntegrationType,
      credentials,
      userId
    );

    if (!result.success) {
      return json({ success: false, error: result.error }, 400);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error saving credentials:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
