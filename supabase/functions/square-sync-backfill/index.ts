import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSquareCredentialsByOrg, getOrganizationForLocation } from "../_shared/credentials.ts";

interface BackfillRequest {
  start_date?: string; // ISO date string (e.g., "2024-01-01")
  end_date?: string;   // ISO date string (e.g., "2024-12-31")
  dry_run?: boolean;   // If true, don't actually insert data
  location_id?: string; // Optional Square location ID override
  start_time?: string;  // ISO datetime (e.g., "2025-08-01T00:00:00Z")
  end_time?: string;    // ISO datetime (e.g., "2025-08-31T23:59:59Z")
  locations?: string[]; // Optional list of location IDs to process
  overlap_minutes?: number; // Optional overlap to subtract from start (default 5)
}

interface BackfillProgress {
  current_date: string;
  total_requests: number;
  completed_requests: number;
  total_payments_fetched: number;
  total_payments_synced: number;
  errors: string[];
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== STARTING SQUARE BACKFILL ===');
    
    // Parse request parameters
    let backfillParams: BackfillRequest = {};
    if (req.method === 'POST') {
      try {
        backfillParams = await req.json();
      } catch (e) {
        console.log('No valid JSON body, using defaults');
      }
    }

    // Resolve time window (support datetimes + overlap). Fallback to date-only if provided.
    const overlapMinutes = typeof backfillParams.overlap_minutes === 'number' && backfillParams.overlap_minutes >= 0
      ? backfillParams.overlap_minutes
      : 5;

    const fallbackStart = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago
    const fallbackEnd = new Date();

    const startTime = backfillParams.start_time
      ? new Date(backfillParams.start_time)
      : (backfillParams.start_date ? new Date(`${backfillParams.start_date}T00:00:00Z`) : fallbackStart);

    const endTime = backfillParams.end_time
      ? new Date(backfillParams.end_time)
      : (backfillParams.end_date ? new Date(`${backfillParams.end_date}T23:59:59.999Z`) : fallbackEnd);

    const effectiveStart = new Date(startTime.getTime() - overlapMinutes * 60 * 1000);
    const effectiveEnd = endTime;

    const dryRun = backfillParams.dry_run || false;

    console.log(`Backfill Parameters:`);
    console.log(`- Start Time: ${startTime.toISOString()}`);
    console.log(`- End Time: ${endTime.toISOString()}`);
    console.log(`- Effective Start (overlap ${overlapMinutes}m): ${effectiveStart.toISOString()}`);
    console.log(`- Dry Run: ${dryRun}`);

    const environment = 'production';

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Cache for organization tokens to avoid repeated DB lookups
    const orgTokenCache = new Map<string, string>();

    /**
     * Get Square access token for a location
     * Uses per-organization credentials with env var fallback
     */
    async function getTokenForLocation(locationId: string): Promise<string> {
      // Get the organization for this location
      const orgId = await getOrganizationForLocation(supabase, locationId);

      if (orgId && orgTokenCache.has(orgId)) {
        return orgTokenCache.get(orgId)!;
      }

      if (orgId) {
        const creds = await getSquareCredentialsByOrg(supabase, orgId);
        if (creds?.accessToken) {
          orgTokenCache.set(orgId, creds.accessToken);
          return creds.accessToken;
        }
      }

      // Fall back to env var if no DB credentials found
      const envToken = Deno.env.get("SQUARE_PRODUCTION_ACCESS_TOKEN") || Deno.env.get("SQUARE_ACCESS_TOKEN");
      if (!envToken) {
        throw new Error(`No Square credentials found for location ${locationId}`);
      }
      return envToken;
    }

    // Update backfill status
    await supabase
      .from('square_sync_status')
      .upsert({
        environment,
        sync_status: 'backfill_running',
        last_sync_attempt: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        error_message: null
      }, {
        onConflict: 'environment'
      });

    const progress: BackfillProgress = {
      current_date: effectiveStart.toISOString(),
      total_requests: 0,
      completed_requests: 0,
      total_payments_fetched: 0,
      total_payments_synced: 0,
      errors: []
    };

    // Resolve locations to process
    let locations: string[] = [];
    if (Array.isArray(backfillParams.locations) && backfillParams.locations.length > 0) {
      locations = backfillParams.locations;
    } else if (backfillParams.location_id) {
      locations = [backfillParams.location_id];
    } else {
      const { data: locs, error: locErr } = await supabase
        .from('square_locations')
        .select('square_location_id')
        .eq('is_active', true);
      if (locErr) {
        console.log('Failed to load locations from DB, falling back to default:', locErr.message);
        locations = ['LGRBM02D8PCNM'];
      } else {
        locations = (locs || []).map((r: any) => r.square_location_id);
        if (locations.length === 0) locations = ['LGRBM02D8PCNM'];
      }
    }

    console.log(`Processing ${locations.length} location(s): ${locations.join(', ')}`);

    const locationSummaries: Array<{ location_id: string; payments_fetched: number; payments_synced: number; }> = [];

    // Process each location within the single time window
    for (const locationId of locations) {
      console.log(`\n--- Processing window ${effectiveStart.toISOString()} to ${effectiveEnd.toISOString()} for location ${locationId} ---`);
      progress.current_date = `${effectiveStart.toISOString()} @ ${locationId}`;

      try {
        // Get the access token for this location's organization
        const accessToken = await getTokenForLocation(locationId);

        // Fetch payments for this location & window
        const windowPayments = await fetchPaymentsForDateRange(
          accessToken,
          effectiveStart,
          effectiveEnd,
          locationId
        );

        progress.total_payments_fetched += windowPayments.length;
        progress.total_requests++;

        if (windowPayments.length > 0) {
          console.log(`Found ${windowPayments.length} payments for location ${locationId} in window`);

          if (!dryRun) {
            // Insert payments into database
            const paymentsToInsert = windowPayments.map(payment => ({
              square_payment_id: payment.id,
              raw_response: payment
            }));

            const { data: insertedData, error } = await supabase
              .from("square_payments_raw")
              .upsert(paymentsToInsert, { onConflict: "square_payment_id" })
              .select();

            if (error) {
              console.error(`Database error for location ${locationId}:`, error);
              progress.errors.push(`Database error for ${locationId}: ${error.message}`);
            } else {
              const syncedCount = insertedData?.length || 0;
              progress.total_payments_synced += syncedCount;
              console.log(`✅ Synced ${syncedCount} payments for ${locationId} in window`);
            }
          } else {
            console.log(`[DRY RUN] Would sync ${windowPayments.length} payments for ${locationId} in window`);
            progress.total_payments_synced += windowPayments.length;
          }
        } else {
          console.log(`No payments found for ${locationId} in window`);
        }

        progress.completed_requests++;

        // Update progress heartbeat
        await supabase
          .from('square_sync_status')
          .upsert({
            environment,
            sync_status: 'backfill_running',
            last_heartbeat: new Date().toISOString(),
            error_message: progress.errors.length > 0 ? progress.errors.join('; ') : null
          }, {
            onConflict: 'environment'
          });

        // Polite 500ms delay between locations
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error processing window for ${locationId}:`, error);
        progress.errors.push(`Error processing ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        progress.completed_requests++;
      }

      locationSummaries.push({
        location_id: locationId,
        payments_fetched: progress.total_payments_fetched,
        payments_synced: progress.total_payments_synced
      });
    }

    // Note: Transformation is handled separately via UI/automation
    console.log('\n=== BACKFILL COMPLETED - TRANSFORM SEPARATELY ===');

    // Update final status
    const finalStatus = progress.errors.length > 0 ? 'backfill_completed_with_errors' : 'backfill_completed';
    await supabase
      .from('square_sync_status')
      .upsert({
        environment,
        sync_status: finalStatus,
        payments_fetched: progress.total_payments_fetched,
        payments_synced: progress.total_payments_synced,
        last_successful_sync: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        error_message: progress.errors.length > 0 ? progress.errors.join('; ') : null
      }, {
        onConflict: 'environment'
      });

    console.log('=== BACKFILL COMPLETED ===');
    console.log(`Total payments fetched: ${progress.total_payments_fetched}`);
    console.log(`Total payments synced: ${progress.total_payments_synced}`);
    console.log(`Errors: ${progress.errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      environment,
      message: "Backfill completed",
      dry_run: dryRun,
      progress,
      summary: {
        total_payments_fetched: progress.total_payments_fetched,
        total_payments_synced: progress.total_payments_synced,
        errors_count: progress.errors.length,
        locations: locationSummaries,
        time_window: { start_time: startTime.toISOString(), end_time: endTime.toISOString(), overlap_minutes: overlapMinutes }
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in square-sync-backfill function:', error);
    
    // Update sync status with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('square_sync_status')
          .upsert({
            environment: 'production',
            sync_status: 'backfill_error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            last_heartbeat: new Date().toISOString()
          }, {
            onConflict: 'environment'
          });
      }
    } catch (statusError) {
      console.error('Failed to update sync status:', statusError);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});

/**
 * Fetch payments from Square API with automatic retry and exponential backoff
 */
async function fetchPaymentsForDateRange(
  token: string,
  startDate: Date,
  endDate: Date,
  locationId: string,
  maxRetries: number = 3
): Promise<any[]> {
  let cursor: string | null = null;
  let allPayments: any[] = [];
  let requestCount = 0;

  do {
    requestCount++;
    console.log(`Making request ${requestCount} for date range ${startDate.toISOString()} to ${endDate.toISOString()} at location ${locationId}`);

    let retries = 0;
    let response: Response;

    // Retry loop with exponential backoff
    while (retries <= maxRetries) {
      try {
        const url = buildPaymentsUrl(startDate, endDate, cursor, locationId);
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Square-Version': '2025-07-16',
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          break; // Success, exit retry loop
        }

        // Handle rate limiting and server errors
        if (response.status === 429 || response.status >= 500) {
          const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.error(JSON.stringify({
            metric: 'square_backoff', location_id: locationId, status: response.status,
            cursor: !!cursor, retry: retries, wait_ms: waitTime
          }));
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }

        // For other errors, throw immediately
        throw new Error(`Square API error: ${response.status} ${response.statusText}`);

      } catch (error) {
        if (retries === maxRetries) {
          throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
        }
        const waitTime = Math.pow(2, retries) * 1000;
        console.error(JSON.stringify({
          metric: 'square_request_error', location_id: locationId,
          retry: retries, wait_ms: waitTime, error: error instanceof Error ? error.message : String(error)
        }));
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
      }
    }

    const data = await response!.json();
    const payments = data.payments || [];

    if (cursor) {
      console.log(`→ Cursor request returned ${payments.length} payments, next cursor: ${data.cursor ? 'present' : 'null'}`);
    } else {
      console.log(`→ Initial request returned ${payments.length} payments`);
    }

    allPayments.push(...payments);
    cursor = data.cursor || null;

    // Polite pause between requests
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } while (cursor);

  console.log(`Total payments fetched: ${allPayments.length}`);
  return allPayments;
}

/**
 * Build the Square API URL for fetching payments
 */
function buildPaymentsUrl(startDate: Date, endDate: Date, cursor: string | null, locationId: string): string {
  const url = new URL('https://connect.squareup.com/v2/payments');

  // Add required parameters
  url.searchParams.append('begin_time', startDate.toISOString());
  url.searchParams.append('end_time', endDate.toISOString());
  url.searchParams.append('location_id', locationId);

  // Add optional parameters
  if (cursor) {
    url.searchParams.append('cursor', cursor);
  }

  return url.toString();
}

async function listLocations(accessToken: string): Promise<string[]> {
  const allLocations: string[] = [];
  let cursor: string | null = null;
  let requestCount = 0;

  do {
    requestCount++;
    console.log(`Making request ${requestCount} to list Square locations`);

    const url = new URL('https://connect.squareup.com/v2/locations');
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Square-Version": "2024-01-17",
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Square API Error Response: ${errorText}`);
      throw new Error(`Square API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const locations = data.locations || [];

    if (cursor) {
      console.log(`→ Cursor request returned ${locations.length} locations, next cursor: ${data.cursor ? 'present' : 'null'}`);
    } else {
      console.log(`→ Initial request returned ${locations.length} locations`);
    }
    console.log(`Received ${locations.length} locations in this request`);
    allLocations.push(...locations.map(loc => loc.id));

    cursor = data.cursor || null;
    await new Promise(resolve => setTimeout(resolve, 500));

  } while (cursor);

  console.log(`Total locations fetched: ${allLocations.length}`);
  return allLocations;
} 