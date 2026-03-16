import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSquareCredentialsByOrg, getOrganizationForLocation } from "../_shared/credentials.ts";

/**
 * Sync payments and orders directly from Square API, then run transforms.
 *
 * Previously this function delegated to separate edge functions
 * (square-sync-payments, square-sync-orders) which had credential lookup
 * issues. Now it fetches directly using the shared credentials module
 * which correctly resolves per-organization Square tokens.
 */

// deno-lint-ignore no-explicit-any
type Body = Record<string, any>;

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors, status: 204 });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return jsonResponse({ success: false, error: 'Missing Supabase configuration' }, cors);
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    let body: Body = {};
    try {
      if (req.method === 'POST') body = await req.json();
    } catch { /* no body is fine */ }

    const now = new Date();
    const overlap = Number.isFinite(body.overlap_minutes) ? body.overlap_minutes : 5;
    const lookback = Number.isFinite(body.max_lookback_days) ? body.max_lookback_days : 30;
    const endTs = body.end_ts ? new Date(body.end_ts) : now;
    const dryRun = !!body.dry_run;

    // Resolve locations
    let locations: string[] = [];
    if (Array.isArray(body.locations) && body.locations.length > 0) {
      locations = body.locations;
    } else {
      const locRes = await db.from('square_locations').select('square_location_id').eq('is_active', true);
      if (locRes.error) {
        return jsonResponse({ success: false, error: `Failed to load locations: ${locRes.error.message}` }, cors);
      }
      locations = (locRes.data || []).map((r: { square_location_id: string }) => r.square_location_id);
    }

    // Cache org tokens to avoid repeated lookups (same org shares one token)
    const orgTokenCache = new Map<string, string>();

    async function getTokenForLocation(locationId: string): Promise<string | null> {
      const orgId = await getOrganizationForLocation(db, locationId);
      if (!orgId) {
        console.warn(`No organization found for location ${locationId}`);
        return null;
      }
      if (orgTokenCache.has(orgId)) return orgTokenCache.get(orgId)!;

      const creds = await getSquareCredentialsByOrg(db, orgId);
      if (!creds?.accessToken) {
        console.warn(`No Square credentials found for org ${orgId} (location ${locationId})`);
        return null;
      }
      orgTokenCache.set(orgId, creds.accessToken);
      return creds.accessToken;
    }

    // deno-lint-ignore no-explicit-any
    const results: any[] = [];

    for (const location_id of locations) {
      try {
        // Determine start time
        let startTs: Date;
        if (body.since === 'last') {
          const status = await db.from('square_location_sync_status')
            .select('last_payment_created_at_seen, last_order_updated_at_seen')
            .eq('location_id', location_id)
            .maybeSingle();

          const defaultStart = new Date(endTs.getTime() - lookback * 24 * 60 * 60 * 1000);
          const lastPayment = status.data?.last_payment_created_at_seen
            ? new Date(status.data.last_payment_created_at_seen) : defaultStart;
          const lastOrder = status.data?.last_order_updated_at_seen
            ? new Date(status.data.last_order_updated_at_seen) : defaultStart;
          const base = new Date(Math.max(lastPayment.getTime(), lastOrder.getTime()));
          startTs = new Date(base.getTime() - overlap * 60 * 1000);
        } else if (body.start_ts) {
          startTs = new Date(new Date(body.start_ts).getTime() - overlap * 60 * 1000);
        } else {
          startTs = new Date(endTs.getTime() - lookback * 24 * 60 * 60 * 1000);
          startTs = new Date(startTs.getTime() - overlap * 60 * 1000);
        }

        const window = { start: startTs.toISOString(), end: endTs.toISOString() };
        console.log(`Processing location ${location_id} from ${window.start} to ${window.end}`);

        // Mark in-progress
        await db.from('square_location_sync_status').upsert({
          location_id,
          in_progress: true,
          last_heartbeat: new Date().toISOString(),
        }, { onConflict: 'location_id' });

        // Get Square access token
        const accessToken = await getTokenForLocation(location_id);
        if (!accessToken) {
          results.push({
            location_id, window,
            payments: { error: 'No Square credentials found' },
            orders: { error: 'No Square credentials found' },
            transforms: null,
          });
          continue;
        }

        // 1) Sync payments from Square API
        const pStart = Date.now();
        const payments = await fetchSquarePayments(accessToken, startTs, endTs, location_id);
        const pMs = Date.now() - pStart;
        console.log(JSON.stringify({ metric: 'payments_fetched', location_id, count: payments.length, duration_ms: pMs }));

        let paymentsUpserted = 0;
        if (!dryRun && payments.length > 0) {
          const rows = payments.map(p => ({ square_payment_id: p.id, raw_response: p }));
          // Upsert in batches of 500 to avoid payload limits
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const { data, error } = await db
              .from('square_payments_raw')
              .upsert(batch, { onConflict: 'square_payment_id' })
              .select('square_payment_id');
            if (error) {
              console.error(`Payment upsert error (location ${location_id}, batch ${i}):`, error.message);
            } else {
              paymentsUpserted += data?.length || 0;
            }
          }
        }

        // 2) Sync orders from Square API
        const oStart = Date.now();
        const orders = await fetchSquareOrders(accessToken, startTs, endTs, location_id);
        const oMs = Date.now() - oStart;
        console.log(JSON.stringify({ metric: 'orders_fetched', location_id, count: orders.length, duration_ms: oMs }));

        let ordersUpserted = 0;
        if (!dryRun && orders.length > 0) {
          const rows = orders.map(o => ({
            order_id: o.id,
            location_id: o.location_id,
            raw_response: o,
          }));
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const { data, error } = await db
              .from('square_orders_raw')
              .upsert(batch, { onConflict: 'order_id' })
              .select('order_id');
            if (error) {
              console.error(`Order upsert error (location ${location_id}, batch ${i}):`, error.message);
            } else {
              ordersUpserted += data?.length || 0;
            }
          }
        }

        // 3) Run transforms
        let tPayments = null, tOrders = null;
        if (!dryRun) {
          try {
            const t1 = await db.rpc('transform_payments_window', {
              start_ts: window.start,
              end_ts: window.end,
            });
            if (t1.error) throw new Error(`payments transform: ${t1.error.message}`);
            tPayments = t1.data;
          } catch (err) {
            console.error(`Payment transform error (location ${location_id}):`, err);
          }

          try {
            // Broader window for orders to catch late-arriving order data
            const transformStart = new Date(
              new Date(window.start).getTime() - 7 * 24 * 60 * 60 * 1000
            );
            const t2 = await db.rpc('transform_orders_window', {
              p_start_ts: transformStart.toISOString(),
              p_end_ts: window.end,
            });
            if (t2.error) throw new Error(`orders transform: ${t2.error.message}`);
            tOrders = t2.data;
          } catch (err) {
            console.error(`Order transform error (location ${location_id}):`, err);
          }
        }

        // Update watermarks
        if (!dryRun) {
          await db.from('square_location_sync_status').upsert({
            location_id,
            last_payment_created_at_seen: window.end,
            last_order_updated_at_seen: window.end,
            last_successful_sync_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
            in_progress: false,
          }, { onConflict: 'location_id' });
        }

        results.push({
          location_id,
          window,
          payments: { fetched: payments.length, upserted: paymentsUpserted },
          orders: { fetched: orders.length, upserted: ordersUpserted },
          transforms: { payments: tPayments, orders: tOrders },
        });

      } catch (locErr) {
        console.error(`Error processing location ${location_id}:`, locErr);
        // Clear in-progress flag on error
        await db.from('square_location_sync_status').upsert({
          location_id,
          in_progress: false,
          last_heartbeat: new Date().toISOString(),
        }, { onConflict: 'location_id' });

        results.push({
          location_id,
          window: { start: body.start_ts || 'computed', end: endTs.toISOString() },
          payments: { error: (locErr as Error).message },
          orders: { error: (locErr as Error).message },
          transforms: { error: (locErr as Error).message },
        });
      }

      // Delay between locations to avoid rate limits
      await delay(1000);
    }

    return jsonResponse({ success: true, results }, cors);

  } catch (outer) {
    console.error('Outer error:', outer);
    return jsonResponse({
      success: false,
      error: outer instanceof Error ? outer.message : String(outer),
    }, cors);
  }
});

// --- Square API helpers ---

/**
 * Fetch payments from Square API with pagination and retry
 */
// deno-lint-ignore no-explicit-any
async function fetchSquarePayments(token: string, start: Date, end: Date, locationId: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const all: any[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL('https://connect.squareup.com/v2/payments');
    url.searchParams.append('begin_time', start.toISOString());
    url.searchParams.append('end_time', end.toISOString());
    url.searchParams.append('location_id', locationId);
    if (cursor) url.searchParams.append('cursor', cursor);

    const resp = await fetchWithRetry(url.toString(), token);
    const data = await resp.json();
    all.push(...(data.payments || []));
    cursor = data.cursor || null;

    if (cursor) await delay(300);
  } while (cursor);

  return all;
}

/**
 * Fetch orders from Square API with pagination and retry
 * Uses SearchOrders endpoint which requires POST
 */
// deno-lint-ignore no-explicit-any
async function fetchSquareOrders(token: string, start: Date, end: Date, locationId: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const all: any[] = [];
  let cursor: string | null = null;

  do {
    // deno-lint-ignore no-explicit-any
    const body: any = {
      location_ids: [locationId],
      query: {
        filter: {
          date_time_filter: {
            updated_at: {
              start_at: start.toISOString(),
              end_at: end.toISOString(),
            },
          },
        },
        sort: {
          sort_field: 'UPDATED_AT',
          sort_order: 'ASC',
        },
      },
      limit: 500,
    };
    if (cursor) body.cursor = cursor;

    const resp = await fetch('https://connect.squareup.com/v2/orders/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2025-07-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Square Orders API error: ${resp.status} ${errText}`);
      break; // Don't fail the whole sync if orders fail
    }

    const data = await resp.json();
    all.push(...(data.orders || []));
    cursor = data.cursor || null;

    if (cursor) await delay(300);
  } while (cursor);

  return all;
}

/**
 * Fetch with exponential backoff retry for rate limits and server errors
 */
async function fetchWithRetry(url: string, token: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2025-07-16',
        'Content-Type': 'application/json',
      },
    });

    if (resp.ok) return resp;

    if ((resp.status === 429 || resp.status >= 500) && attempt < maxRetries) {
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(`Square API ${resp.status}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await delay(waitMs);
      continue;
    }

    throw new Error(`Square API error: ${resp.status} ${resp.statusText}`);
  }

  throw new Error('fetchWithRetry: exhausted retries');
}

// --- Utilities ---

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

function jsonResponse(data: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...cors, 'Content-Type': 'application/json' },
    status,
  });
}
