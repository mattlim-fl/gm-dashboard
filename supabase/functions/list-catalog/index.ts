// Quick utility to list Square catalog items and their variation IDs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getSquareCredentials } from "../_shared/credentials.ts"

declare const Deno: any

serve(async (req: Request) => {
  // Parse venue from query string or body
  const url = new URL(req.url)
  let venue = url.searchParams.get('venue') || 'manor'

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (body.venue) venue = body.venue
    } catch {}
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get Square credentials for the venue's organization
  const creds = await getSquareCredentials(supabase, venue)

  if (!creds?.accessToken) {
    return new Response(JSON.stringify({ error: 'No Square access token found' }), { status: 500 })
  }

  const res = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM', {
    headers: {
      'Square-Version': '2023-10-18',
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  // Extract just the item names and variation IDs
  const items = (data.objects || []).map((item: any) => ({
    itemId: item.id,
    name: item.item_data?.name,
    variations: (item.item_data?.variations || []).map((v: any) => ({
      variationId: v.id,
      name: v.item_variation_data?.name,
      priceMoney: v.item_variation_data?.price_money
    }))
  }))

  return new Response(JSON.stringify({ items, venue }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  })
})
