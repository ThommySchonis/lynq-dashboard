import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const SHOPIFY_API_VERSION = '2025-04'

Deno.serve(async () => {
  // Fetch all workspaces with active Shopify integrations
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('workspace_id, shopify_domain, shopify_access_token, client_id')
    .not('shopify_access_token', 'is', null)

  if (intError || !integrations) {
    console.error('[shopify-sync] Failed to fetch integrations:', intError?.message)
    return new Response('Failed', { status: 500 })
  }

  let totalSynced = 0

  for (const int of integrations) {
    try {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      let orders: any[] = []
      let url: string | null =
        `https://${int.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250&processed_at_min=${since}`

      while (url) {
        const res = await fetch(url, {
          headers: { 'X-Shopify-Access-Token': int.shopify_access_token },
        })
        if (!res.ok) break
        const data = await res.json()
        orders = orders.concat(data.orders || [])
        const link = res.headers.get('link')
        const next = link?.match(/<([^>]+)>;\s*rel="next"/)
        url = next ? next[1] : null
      }

      const rows = orders.map((order: any) => {
        const subtotal = parseFloat(
          order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || 0
        )
        const totalPrice = parseFloat(
          order.total_price_set?.presentment_money?.amount || order.total_price || 0
        )
        const totalDiscounts = parseFloat(
          order.total_discounts_set?.presentment_money?.amount || order.total_discounts || 0
        )
        const refundAmount = (order.refunds || []).reduce((sum: number, r: any) =>
          sum + (r.transactions || []).reduce((ts: number, t: any) =>
            ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

        return {
          id: order.id,
          client_id: int.client_id,
          workspace_id: int.workspace_id,
          order_number: order.name,
          financial_status: order.financial_status,
          cancel_reason: order.cancel_reason || null,
          subtotal_price: subtotal,
          total_price: totalPrice,
          total_discounts: totalDiscounts,
          refund_amount: refundAmount,
          presentment_currency: order.presentment_currency || order.currency || null,
          source_name: order.source_name || null,
          customer_email: order.customer?.email || order.email || null,
          customer_name: order.customer
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
            : null,
          processed_at: order.processed_at,
          created_at_shopify: order.created_at,
          updated_at_shopify: order.updated_at,
          synced_at: new Date().toISOString(),
        }
      })

      for (let i = 0; i < rows.length; i += 100) {
        await supabase
          .from('shopify_orders')
          .upsert(rows.slice(i, i + 100), { onConflict: 'workspace_id,id' })
      }

      totalSynced += rows.length
      console.log(`[shopify-sync] Synced ${rows.length} orders for workspace ${int.workspace_id}`)
    } catch (err) {
      console.error(`[shopify-sync] Error syncing workspace ${int.workspace_id}:`, err)
    }
  }

  return new Response(JSON.stringify({ success: true, totalSynced }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
