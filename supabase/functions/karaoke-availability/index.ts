import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { config } from "../_shared/config.ts"

type AvailabilityRequest = {
  // Mode 1: per-booth
  boothId?: string;
  // Mode 2: per-venue aggregate
  venue?: 'manor' | 'hippie';
  minCapacity?: number;

  bookingDate: string; // ISO date YYYY-MM-DD
  granularityMinutes?: number; // default 60
  action?: 'boothsForSlot';
  startTime?: string; // For boothsForSlot
  endTime?: string;   // For boothsForSlot
};

type AvailabilitySlot = {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  available: boolean;
  blockedBy?: 'booking' | 'hold';
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

// Low-effort perf: tiny in-memory cache with short TTL to smooth repeated requests
type CacheEntry = { expiresAt: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10_000; // 10s

function makeKey(parts: (string | number | undefined)[]) {
  return parts.join('|');
}

function getCached(key: string) {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) return entry.payload;
  cache.delete(key);
  return null;
}

function setCached(key: string, payload: unknown) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

function addMinutes(timeHHMM: string, minutesToAdd: number): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  const total = h * 60 + m + minutesToAdd;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => Number(v) || 0);
  return h * 60 + m;
}

function dateToDayNumber(dateStr: string): number {
  // Use UTC midnight to avoid local timezone shifts; booking_date strings are already "local" business dates.
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function dayNumberToDate(day: number): string {
  const ms = day * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(dateStr: string, deltaDays: number): string {
  const d = dateToDayNumber(dateStr);
  return dayNumberToDate(d + deltaDays);
}

function intervalToAbsMinutes(bookingDate: string, startHHMM: string, endHHMM: string): { start: number; end: number } {
  const day = dateToDayNumber(bookingDate);
  const s = day * 1440 + timeToMinutes(startHHMM);
  let e = day * 1440 + timeToMinutes(endHHMM);
  if (timeToMinutes(endHHMM) <= timeToMinutes(startHHMM)) e += 1440; // overnight
  return { start: s, end: e };
}

function overlapsAbs(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeIntervalMinutes(startHHMM: string, endHHMM: string): { start: number; end: number } {
  const s = timeToMinutes(startHHMM);
  let e = timeToMinutes(endHHMM);
  if (e <= s) e += 1440;
  return { start: s, end: e };
}

function isSlotWithinBoothHours(slotStart: string, slotEnd: string, boothStart: string, boothEnd: string): boolean {
  const booth = normalizeIntervalMinutes(boothStart, boothEnd);
  const slot = normalizeIntervalMinutes(slotStart, slotEnd);

  // try as-is
  if (slot.start >= booth.start && slot.end <= booth.end) return true;
  // try shifting slot into "next day" representation
  const shifted = { start: slot.start + 1440, end: slot.end + 1440 };
  if (shifted.start >= booth.start && shifted.end <= booth.end) return true;
  return false;
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

  try {
    const supabaseUrl = config.supabaseUrl;
    const supabaseServiceKey = config.supabaseServiceKey;
    // Use service role so availability checks can read config tables under RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
    });

    const body = (await req.json()) as AvailabilityRequest;
    const granularity = Math.max(15, body.granularityMinutes ?? 60);
    const prevDate = addDays(body.bookingDate, -1);
    const nextDate = addDays(body.bookingDate, 1);
    const dateWindow = [prevDate, body.bookingDate, nextDate];

    if (!body.bookingDate) {
      return new Response(JSON.stringify({ error: 'bookingDate is required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
    // Action: list available booths for a specific slot (post-slot selection)
    if (body.action === 'boothsForSlot') {
      const cacheKey = makeKey(['boothsForSlot', body.venue, body.bookingDate, body.startTime, body.endTime, body.minCapacity]);
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }
      if (!body.venue || !body.startTime || !body.endTime) {
        return new Response(JSON.stringify({ error: 'venue, startTime, and endTime are required for boothsForSlot' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      const minCap = body.minCapacity ?? 1;
      const { data: booths, error: boothListErr } = await supabase
        .from('karaoke_booths')
        .select('id,name,capacity,hourly_rate,operating_hours_start,operating_hours_end')
        .eq('venue', body.venue)
        .eq('is_available', true)
        .gte('capacity', minCap);
      if (boothListErr) {
        return new Response(JSON.stringify({ error: 'Failed to fetch booths' }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const boothIds = (booths || []).map((b) => b.id);
      const nowIso = new Date().toISOString();
      const [bookingsAllRes, holdsAllRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('karaoke_booth_id,booking_date,start_time,end_time,status')
          .in('karaoke_booth_id', boothIds.length ? boothIds : ['00000000-0000-0000-0000-000000000000'])
          .in('booking_date', dateWindow)
          .neq('status', 'cancelled'),
        supabase
          .from('karaoke_booth_holds')
          .select('booth_id,booking_date,start_time,end_time,expires_at,status')
          .in('booth_id', boothIds.length ? boothIds : ['00000000-0000-0000-0000-000000000000'])
          .in('booking_date', dateWindow)
          .eq('status', 'active')
          .gt('expires_at', nowIso),
      ]);
      const bookingsAll = bookingsAllRes.data;
      const holdsAll = holdsAllRes.data;

      const availableBooths: any[] = [];
      const requested = intervalToAbsMinutes(body.bookingDate, body.startTime!, body.endTime!);
      for (const booth of (booths || [])) {
        const boothStart = (booth.operating_hours_start as string).slice(0, 5);
        const boothEnd = (booth.operating_hours_end as string).slice(0, 5);

        if (!isSlotWithinBoothHours(body.startTime!, body.endTime!, boothStart, boothEnd)) {
          continue;
        }

        const bookingsForBooth = (bookingsAll || []).filter(b => b.karaoke_booth_id === booth.id);
        const holdsForBooth = (holdsAll || []).filter(h => h.booth_id === booth.id);
        const hasBooking = bookingsForBooth.some((b) => {
          const interval = intervalToAbsMinutes(String((b as any).booking_date), (b.start_time as string).slice(0, 5), (b.end_time as string).slice(0, 5));
          return overlapsAbs(requested.start, requested.end, interval.start, interval.end);
        });
        if (hasBooking) continue;
        const hasHold = holdsForBooth.some((h) => {
          const interval = intervalToAbsMinutes(String((h as any).booking_date), (h.start_time as string).slice(0, 5), (h.end_time as string).slice(0, 5));
          return overlapsAbs(requested.start, requested.end, interval.start, interval.end);
        });
        if (hasHold) continue;
        availableBooths.push(booth);
      }

      const payload = { venue: body.venue, bookingDate: body.bookingDate, startTime: body.startTime, endTime: body.endTime, availableBooths };
      setCached(cacheKey, payload);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Mode 1: single booth availability
    if (body.boothId) {
      const { data: booth, error: boothErr } = await supabase
        .from('karaoke_booths')
        .select('*')
        .eq('id', body.boothId)
        .single();
      if (boothErr || !booth) {
        return new Response(JSON.stringify({ error: 'Booth not found' }), {
          status: 404,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      const startHH = (booth.operating_hours_start as string)?.slice(0, 5) || '10:00';
      const endHH = (booth.operating_hours_end as string)?.slice(0, 5) || '23:00';
      const { data: bookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('booking_date,start_time,end_time,status')
        .eq('karaoke_booth_id', body.boothId)
        .in('booking_date', dateWindow)
        .neq('status', 'cancelled');
      if (bookingsErr) {
        return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      const nowIso = new Date().toISOString();
      const { data: holds, error: holdsErr } = await supabase
        .from('karaoke_booth_holds')
        .select('booking_date,start_time,end_time,status,expires_at')
        .eq('booth_id', body.boothId)
        .in('booking_date', dateWindow)
        .eq('status', 'active')
        .gt('expires_at', nowIso);
      if (holdsErr) {
        return new Response(JSON.stringify({ error: 'Failed to fetch holds' }), {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      const slots: AvailabilitySlot[] = [];
      let cursor = startHH;
      while (cursor < endHH) {
        const next = addMinutes(cursor, granularity);
        if (next > endHH) break;
        const slotInterval = intervalToAbsMinutes(body.bookingDate, cursor, next);
        const hasBooking = (bookings || []).some((b) => {
          const interval = intervalToAbsMinutes(String((b as any).booking_date), (b.start_time as string).slice(0, 5), (b.end_time as string).slice(0, 5));
          return overlapsAbs(slotInterval.start, slotInterval.end, interval.start, interval.end);
        });
        const hasHold = !hasBooking && (holds || []).some((h) => {
          const interval = intervalToAbsMinutes(String((h as any).booking_date), (h.start_time as string).slice(0, 5), (h.end_time as string).slice(0, 5));
          return overlapsAbs(slotInterval.start, slotInterval.end, interval.start, interval.end);
        });
        slots.push({ startTime: cursor, endTime: next, available: !(hasBooking || hasHold), blockedBy: hasBooking ? 'booking' : hasHold ? 'hold' : undefined });
        cursor = next;
      }
      return new Response(JSON.stringify({ boothId: body.boothId, bookingDate: body.bookingDate, granularityMinutes: granularity, slots }), { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // Mode 2: aggregate by venue/capacity
    if (!body.venue) {
      return new Response(JSON.stringify({ error: 'Either boothId or venue is required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const minCap = body.minCapacity ?? 1;
    const cacheKey = makeKey(['venueSlots', body.venue, body.bookingDate, minCap, granularity]);
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    const { data: booths, error: boothErr2 } = await supabase
      .from('karaoke_booths')
      .select('id,capacity,operating_hours_start,operating_hours_end')
      .eq('venue', body.venue)
      .eq('is_available', true)
      .gte('capacity', minCap);
    if (boothErr2) {
      return new Response(JSON.stringify({ error: 'Failed to fetch booths' }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }
    if (!booths || booths.length === 0) {
      const emptyPayload = { venue: body.venue, bookingDate: body.bookingDate, granularityMinutes: granularity, minCapacity: minCap, slots: [] as AvailabilitySlot[] };
      setCached(cacheKey, emptyPayload);
      return new Response(JSON.stringify(emptyPayload), { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    const boothIds = booths.map((b) => b.id);
    const nowIso = new Date().toISOString();
    const [bookingsAllRes, holdsAllRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('karaoke_booth_id,booking_date,start_time,end_time,status')
        .in('karaoke_booth_id', boothIds.length ? boothIds : ['00000000-0000-0000-0000-000000000000'])
        .in('booking_date', dateWindow)
        .neq('status', 'cancelled'),
      supabase
        .from('karaoke_booth_holds')
        .select('booth_id,booking_date,start_time,end_time,expires_at,status')
        .in('booth_id', boothIds.length ? boothIds : ['00000000-0000-0000-0000-000000000000'])
        .in('booking_date', dateWindow)
        .eq('status', 'active')
        .gt('expires_at', nowIso),
    ]);
    const bookingsAll = bookingsAllRes.data;
    const holdsAll = holdsAllRes.data;
    const slots: AvailabilitySlot[] = [] as any;

    const dayStartMinutes = 0;
    const dayEndMinutes = 24 * 60;

    for (let startMin = dayStartMinutes; startMin < dayEndMinutes; startMin += granularity) {
      const endMin = startMin + granularity;
      if (endMin > dayEndMinutes) break;

      const cursor = minutesToTime(startMin);
      const next = minutesToTime(endMin);

      let available = false;
      const capacities: number[] = [];
      let anyBoothInHours = false;

      // Check if any booth is free for this slot using pre-fetched rows
      for (const booth of booths) {
        const boothStart = (booth.operating_hours_start as string).slice(0, 5);
        const boothEnd = (booth.operating_hours_end as string).slice(0, 5);

        if (!isSlotWithinBoothHours(cursor, next, boothStart, boothEnd)) {
          continue;
        }

        anyBoothInHours = true;

        const bookingsForBooth = (bookingsAll || []).filter(b => b.karaoke_booth_id === booth.id);
        const holdsForBooth = (holdsAll || []).filter(h => h.booth_id === booth.id);
        const slotInterval = intervalToAbsMinutes(body.bookingDate, cursor, next);
        const hasBooking = bookingsForBooth.some((b) => {
          const interval = intervalToAbsMinutes(String((b as any).booking_date), (b.start_time as string).slice(0, 5), (b.end_time as string).slice(0, 5));
          return overlapsAbs(slotInterval.start, slotInterval.end, interval.start, interval.end);
        });
        if (hasBooking) continue;
        const hasHold = holdsForBooth.some((h) => {
          const interval = intervalToAbsMinutes(String((h as any).booking_date), (h.start_time as string).slice(0, 5), (h.end_time as string).slice(0, 5));
          return overlapsAbs(slotInterval.start, slotInterval.end, interval.start, interval.end);
        });
        if (!hasHold) {
          available = true;
          capacities.push(booth.capacity as number);
        }
      }

      // Skip slots that are completely outside all booth operating hours
      if (!anyBoothInHours) continue;

      // Return sorted unique capacities for transparency on what booth sizes are free
      const uniqueCaps = Array.from(new Set(capacities)).sort((a, b) => a - b);
      // @ts-ignore adding capacities field
      slots.push({ startTime: cursor, endTime: next, available, capacities: uniqueCaps });
    }

    const payload = { venue: body.venue, bookingDate: body.bookingDate, granularityMinutes: granularity, minCapacity: minCap, slots };
    setCached(cacheKey, payload);
    return new Response(JSON.stringify(payload), { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('karaoke-availability error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});


