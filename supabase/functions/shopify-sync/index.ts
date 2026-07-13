import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startCronRun, endCronRun } from '../_shared/cron-logger.ts'
import { refreshExpiringTokens } from '../_shared/shopify-token.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const SHOPIFY_API_VERSION = '2025-04'

// ── GraphQL Admin API: order sync (multi-currency) ───────────────────────────
// Mirrors lib/services/shopify-orders.ts syncOrders: cursor-paginated orders via
// the GraphQL Admin API (REST orders are deprecated), mapping money amounts
// presentment-first (checkout currency) with a shopMoney fallback — the same
// `_set.presentment_money || <bare field>` precedence the REST version used.
const SYNC_ORDERS_PAGE_SIZE = 100

interface GqlMoney {
  amount: string
}
interface GqlMoneyBag {
  shopMoney: GqlMoney
  presentmentMoney?: GqlMoney
}
interface SyncOrderNode {
  id: string
  name: string
  displayFinancialStatus: string | null
  cancelReason: string | null
  sourceName: string | null
  presentmentCurrencyCode: string
  currencyCode: string
  processedAt: string
  createdAt: string
  updatedAt: string
  email: string | null
  customer: { firstName: string | null; lastName: string | null; email: string | null } | null
  subtotalPriceSet: GqlMoneyBag | null
  totalPriceSet: GqlMoneyBag
  totalDiscountsSet: GqlMoneyBag | null
  refunds: Array<{ transactions: { edges: Array<{ node: { amountSet: GqlMoneyBag } }> } }>
}
interface SyncOrdersData {
  orders: {
    edges: Array<{ node: SyncOrderNode }>
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

// No status clause -> all statuses (open/closed/cancelled), reproducing REST `status=any`.
const SYNC_ORDERS_QUERY = `
  query SyncOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT) {
      edges {
        node {
          id
          name
          displayFinancialStatus
          cancelReason
          sourceName
          presentmentCurrencyCode
          currencyCode
          processedAt
          createdAt
          updatedAt
          email
          customer { firstName lastName email }
          subtotalPriceSet { shopMoney { amount } presentmentMoney { amount } }
          totalPriceSet { shopMoney { amount } presentmentMoney { amount } }
          totalDiscountsSet { shopMoney { amount } presentmentMoney { amount } }
          refunds {
            transactions(first: 50) {
              edges { node { amountSet { shopMoney { amount } presentmentMoney { amount } } } }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

// gid://shopify/Order/1234 -> 1234 (REST exposed numeric ids, not global ids).
function legacyIdNum(gid: string): number {
  const tail = gid.split('/').pop() ?? ''
  return Number(tail.split('?')[0])
}

// Presentment (checkout) amount with shop-currency fallback.
function presentmentAmount(bag: GqlMoneyBag | null | undefined): string {
  return bag?.presentmentMoney?.amount || bag?.shopMoney?.amount || '0'
}

Deno.serve(async () => {
  const runId = await startCronRun('shopify-sync', 'edge-function')

  try {
    // Pre-sync: refresh any expiring Shopify tokens (10-min buffer for long syncs)
    const tokensRefreshed = await refreshExpiringTokens(10)
    if (tokensRefreshed > 0) {
      console.log(`[shopify-sync] refreshed ${tokensRefreshed} expiring token(s)`)
    }

    // Fetch all workspaces with active Shopify integrations
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('workspace_id, shopify_domain, shopify_access_token, client_id, store_id, shopify_token_expires_at, workspaces(suspended_at)')
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

      // Skip integrations with expired tokens that failed refresh
      if (int.shopify_token_expires_at && new Date(int.shopify_token_expires_at).getTime() < Date.now()) {
        console.log('[shopify-sync] skipping store', int.store_id, '— token expired, refresh failed')
        continue
      }

      try {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        // Single-quote the timestamp so its colons aren't parsed as field:value
        // separators (Shopify search syntax).
        const query = `processed_at:>='${since}'`
        const gqlUrl = `https://${int.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`

        let orders: SyncOrderNode[] = []
        let after: string | null = null
        let hasNextPage = true

        while (hasNextPage) {
          const res = await fetch(gqlUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': int.shopify_access_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: SYNC_ORDERS_QUERY, variables: { first: SYNC_ORDERS_PAGE_SIZE, after, query } }),
          })
          if (!res.ok) break
          const json: { data?: SyncOrdersData; errors?: Array<{ message: string }> } = await res.json()
          if (json.errors?.length || !json.data) break
          const conn = json.data.orders
          orders = orders.concat(conn.edges.map((e) => e.node))
          hasNextPage = conn.pageInfo.hasNextPage
          after = conn.pageInfo.endCursor
        }

        const rows = orders.map((order) => {
          const subtotal = parseFloat(presentmentAmount(order.subtotalPriceSet))
          const totalPrice = parseFloat(presentmentAmount(order.totalPriceSet))
          const totalDiscounts = parseFloat(presentmentAmount(order.totalDiscountsSet))
          const refundAmount = order.refunds.reduce((sum, r) =>
            sum + r.transactions.edges.reduce((ts, { node: t }) =>
              ts + parseFloat(presentmentAmount(t.amountSet)), 0), 0)

          return {
            id: legacyIdNum(order.id),
            client_id: int.client_id,
            workspace_id: int.workspace_id,
            store_id: int.store_id,
            order_number: order.name,
            financial_status: order.displayFinancialStatus ? order.displayFinancialStatus.toLowerCase() : null,
            cancel_reason: order.cancelReason ? order.cancelReason.toLowerCase() : null,
            subtotal_price: subtotal,
            total_price: totalPrice,
            total_discounts: totalDiscounts,
            refund_amount: refundAmount,
            presentment_currency: order.presentmentCurrencyCode || order.currencyCode || null,
            source_name: order.sourceName || null,
            customer_email: order.customer?.email || order.email || null,
            customer_name: order.customer
              ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim()
              : null,
            processed_at: order.processedAt,
            created_at_shopify: order.createdAt,
            updated_at_shopify: order.updatedAt,
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
