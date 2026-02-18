// Quick utility to list Square catalog items and their variation IDs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: any

serve(async (req: Request) => {
  const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')

  if (!SQUARE_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'No access token' }), { status: 500 })
  }

  const res = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM', {
    headers: {
      'Square-Version': '2023-10-18',
      'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
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

  return new Response(JSON.stringify({ items }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  })
})
