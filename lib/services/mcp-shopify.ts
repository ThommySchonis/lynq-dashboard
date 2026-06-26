import { getStoreCredentials } from '@/lib/store-credentials'
import { listStores } from '@/lib/services/stores'
import { getOrders, getOrderDetail, getCustomer } from '@/lib/services/shopify-orders'
import { createRefund, cancelOrder, fulfillOrder, updateOrderNote, updateOrderAddress } from '@/lib/services/shopify-order-actions'

async function resolveCredentials(workspaceId: string, storeId?: string): Promise<{ domain: string; accessToken: string }> {
  let resolvedStoreId = storeId
  if (!resolvedStoreId) {
    const stores = await listStores(workspaceId)
    if (!stores.length) throw new Error('This workspace has no connected Shopify store.')
    // Prefer the first store with a valid connection (shopify_connected_at non-null)
    const connectedStore = stores.find(s => s.shopify_connected_at !== null)
    resolvedStoreId = (connectedStore ?? stores[0]).id
  }
  const creds = await getStoreCredentials(resolvedStoreId, workspaceId)
  if (!creds) throw new Error(`No valid Shopify credentials for store ${resolvedStoreId} — the store may need to reconnect.`)
  return creds
}

export async function listOrdersForWorkspace(workspaceId: string, opts: { storeId?: string; limit?: number }): Promise<unknown> {
  const creds = await resolveCredentials(workspaceId, opts.storeId)
  return getOrders(creds, { limit: opts.limit })
}

export async function getOrderForWorkspace(workspaceId: string, orderId: string, opts: { storeId?: string }): Promise<unknown> {
  const creds = await resolveCredentials(workspaceId, opts.storeId)
  return getOrderDetail(creds, orderId)
}

export async function lookupCustomerForWorkspace(workspaceId: string, query: { email?: string; order?: string }, opts: { storeId?: string }): Promise<unknown> {
  const creds = await resolveCredentials(workspaceId, opts.storeId)
  return getCustomer(creds, query)
}

export async function refundOrderForWorkspace(workspaceId: string, orderId: string, params: { storeId?: string; customAmount?: string | number; reason?: string; restock?: boolean; shipping?: boolean; notify?: boolean }): Promise<unknown> {
  const { storeId, ...rest } = params
  const creds = await resolveCredentials(workspaceId, storeId)
  return createRefund(creds, orderId, rest)
}

export async function cancelOrderForWorkspace(workspaceId: string, orderId: string, params: { storeId?: string; reason?: string; restock?: boolean; refund?: boolean; notify?: boolean }): Promise<unknown> {
  const { storeId, ...rest } = params
  const creds = await resolveCredentials(workspaceId, storeId)
  return cancelOrder(creds, orderId, rest)
}

export async function fulfillOrderForWorkspace(workspaceId: string, orderId: string, params: { storeId?: string; trackingNumber?: string; trackingCompany?: string; trackingUrl?: string; notify?: boolean }): Promise<unknown> {
  const { storeId, ...rest } = params
  const creds = await resolveCredentials(workspaceId, storeId)
  return fulfillOrder(creds, orderId, rest)
}

export async function updateOrderNoteForWorkspace(workspaceId: string, orderId: string, params: { storeId?: string; note?: string; tags?: string }): Promise<unknown> {
  const { storeId, ...rest } = params
  const creds = await resolveCredentials(workspaceId, storeId)
  return updateOrderNote(creds, orderId, rest)
}

export async function updateOrderAddressForWorkspace(workspaceId: string, orderId: string, params: { storeId?: string; firstName?: string; lastName?: string; address1?: string; address2?: string; city?: string; zip?: string; country?: string; countryCode?: string; phone?: string }): Promise<unknown> {
  const { storeId, ...rest } = params
  const creds = await resolveCredentials(workspaceId, storeId)
  return updateOrderAddress(creds, orderId, rest)
}
