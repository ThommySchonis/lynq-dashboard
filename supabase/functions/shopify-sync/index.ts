import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startCronRun, endCronRun } from '../_shared/cron-logger.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const SHOPIFY_API_VERSION = '2025-04'

Deno.serve(async () => {
  const runId = await startCronRun('shopify-sync', 'edge-function')

  try {
    // Fetch all workspaces with active Shopify integrations
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('workspace_id, shopify_domain, shopify_access_token, client_id, store_id, workspaces(suspended_at)')
      .not('shopify_access_token', 'is', null)

    if (intError || !integrations) {
      console.error('[shopify-sync] Failed to fetch integrations:', intError?.message)
      await endCronRun(runId, { status: 'failure', errorMessage: intError?.message ?? 'Failed to fetch integrations' })
      return new Response('Failed', { status: 500 })
    }

    let totalSynced = 0
    let workspacesProcessed = 0
    let workspacesFailed = 0

    for (const int of integrations) {
      // Skip workspaces suspended for more than 7 days (grace period)
      const ws = int.workspaces as { suspended_at: string | null } | null
      if (ws?.suspended_at) {
        const suspendedMs = Date.now() - new Date(ws.suspended_at).getTime()
        const gracePeriodMs = 7 * 24 * 60 * 60 * 1000
        if (suspendedMs > gracePeriodMs) {
          console.log('[shopify-sync] skipping workspace', int.workspace_id, '— suspended beyond grace period')
          continue
        }
      }

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
            store_id: int.store_id,
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
        workspacesProcessed++
        console.log(`[shopify-sync] Synced ${rows.length} orders for workspace ${int.workspace_id}`)
      } catch (err) {
        console.error(`[shopify-sync] Error syncing workspace ${int.workspace_id}:`, err)
        workspacesFailed++
      }
    }

    await endCronRun(runId, {
      status: workspacesFailed > 0 ? 'warning' : 'success',
      summary: { workspaces_processed: workspacesProcessed, workspaces_failed: workspacesFailed, total_synced: totalSynced },
    })

    return new Response(JSON.stringify({ success: true, totalSynced }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[shopify-sync] Fatal error:', errorMessage)
    await endCronRun(runId, { status: 'failure', errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 })
  }
})
