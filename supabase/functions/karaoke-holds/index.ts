import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { config } from "../_shared/config.ts"

type CreateHoldRequest = {
  boothId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  sessionId: string;   // client/session identifier
  customerEmail?: string;
  venue: 'manor' | 'hippie';
  ttlMinutes?: number; // optional hold duration
};

type ModifyHoldRequest = {
  holdId: string;
  sessionId: string;
  ttlMinutes?: number; // for extend
};

// CORS allowlist via env: ALLOWED_ORIGINS=domain1,domain2
const allowedOrigins = config.allowedOrigins;
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-action',
  } as Record<string, string>;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  // Support action via header, query param, or body.action
  let action = req.headers.get('x-action') || url.searchParams.get('action') || '';

  try {
    const supabaseUrl = config.supabaseUrl;
    const supabaseServiceKey = config.supabaseServiceKey;
    // Use service role so public holds can be created via this function under RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
    });

    if (action === 'create') {
      const body = (await req.json()) as CreateHoldRequest;
      if (!action && (body as any)?.action) action = (body as any).action;
      if (!body.boothId || !body.bookingDate || !body.startTime || !body.endTime || !body.sessionId || !body.venue) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      // Optional TTL
      const ttlMinutes = Math.max(1, Math.min(60, body.ttlMinutes ?? 10));
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      // Insert hold - conflicts will be rejected by trigger
      const { data: hold, error } = await supabase
        .from('karaoke_booth_holds')
        .insert({
          booth_id: body.boothId,
          venue: body.venue,
          booking_date: body.bookingDate,
          start_time: body.startTime,
          end_time: body.endTime,
          session_id: body.sessionId,
          customer_email: body.customerEmail || null,
          status: 'active',
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        const errPayload = {
          error: error.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        };
        return new Response(JSON.stringify(errPayload), {
          status: 409,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, hold }), {
        status: 201,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (action === 'extend') {
      const body = (await req.json()) as ModifyHoldRequest;
      if (!action && (body as any)?.action) action = (body as any).action;
      if (!body.holdId || !body.sessionId) {
        return new Response(JSON.stringify({ error: 'holdId and sessionId are required' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const ttlMinutes = Math.max(1, Math.min(60, body.ttlMinutes ?? 10));
      const newExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      // Only extender is same session and still active
      const { data: updated, error } = await supabase
        .from('karaoke_booth_holds')
        .update({ expires_at: newExpiresAt })
        .eq('id', body.holdId)
        .eq('session_id', body.sessionId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .select()
        .single();

      if (error || !updated) {
        const errPayload = {
          error: error?.message || 'Hold not extendable',
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        };
        return new Response(JSON.stringify(errPayload), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, hold: updated }), {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (action === 'release') {
      const body = (await req.json()) as ModifyHoldRequest;
      if (!action && (body as any)?.action) action = (body as any).action;
      if (!body.holdId || !body.sessionId) {
        return new Response(JSON.stringify({ error: 'holdId and sessionId are required' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const { data: updated, error } = await supabase
        .from('karaoke_booth_holds')
        .update({ status: 'released' })
        .eq('id', body.holdId)
        .eq('session_id', body.sessionId)
        .eq('status', 'active')
        .select()
        .single();

      if (error || !updated) {
        const errPayload = {
          error: error?.message || 'Hold not releasable',
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        };
        return new Response(JSON.stringify(errPayload), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, hold: updated }), {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('karaoke-holds error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});


