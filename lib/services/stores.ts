import { supabaseAdmin } from '../supabaseAdmin'
import type { StorePublic } from '@/types/stores'

interface StoreRow {
  id: string
  name: string
  created_at: string
}

interface IntegrationRow {
  store_id: string
  shopify_domain: string | null
  shopify_connected_at: string | null
  store_currency: string | null
  status: string | null
}

interface IntegrationDetailRow {
  shopify_domain: string | null
  shopify_connected_at: string | null
  store_currency: string | null
  status: string | null
}

export async function listStores(workspaceId: string): Promise<StorePublic[]> {
  const { data: rawData, error } = await supabaseAdmin
    .from('stores')
    .select('id, name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const data = (rawData || []) as unknown as StoreRow[]
  const storeIds = data.map(s => s.id)
  const { data: rawIntegrations } = await supabaseAdmin
    .from('integrations')
    .select('store_id, shopify_domain, shopify_connected_at, store_currency, status')
    .in('store_id', storeIds)

  const integrations = (rawIntegrations || []) as unknown as IntegrationRow[]
  const integrationMap = new Map(
    integrations.map(i => [i.store_id, i])
  )

  return data.map(store => {
    const integration = integrationMap.get(store.id)
    return {
      id: store.id,
      name: store.name,
      shopify_domain: integration?.shopify_domain ?? null,
      shopify_connected_at: integration?.shopify_connected_at ?? null,
      store_currency: integration?.store_currency ?? null,
      status: integration?.status ?? null,
      created_at: store.created_at,
    }
  })
}

export async function getStore(storeId: string, workspaceId: string): Promise<StorePublic | null> {
  const { data: rawData, error } = await supabaseAdmin
    .from('stores')
    .select('id, name, created_at')
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw error
  if (!rawData) return null

  const data = rawData as unknown as StoreRow
  const { data: rawIntegration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_connected_at, store_currency, status')
    .eq('store_id', storeId)
    .maybeSingle()

  const integration = rawIntegration as unknown as IntegrationDetailRow | null
  return {
    id: data.id,
    name: data.name,
    shopify_domain: integration?.shopify_domain ?? null,
    shopify_connected_at: integration?.shopify_connected_at ?? null,
    store_currency: integration?.store_currency ?? null,
    status: integration?.status ?? null,
    created_at: data.created_at,
  }
}

export async function updateStore(
  storeId: string,
  workspaceId: string,
  fields: { name: string }
): Promise<StorePublic> {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .update({ name: fields.name })
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)
    .select('id, name, created_at')
    .single()

  if (error) throw new Error(`Failed to update store: ${error.message}`)

  const store = data as unknown as StoreRow
  const { data: rawIntegration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_connected_at, store_currency, status')
    .eq('store_id', storeId)
    .maybeSingle()

  const integration = rawIntegration as unknown as IntegrationDetailRow | null
  return {
    id: store.id,
    name: store.name,
    shopify_domain: integration?.shopify_domain ?? null,
    shopify_connected_at: integration?.shopify_connected_at ?? null,
    store_currency: integration?.store_currency ?? null,
    status: integration?.status ?? null,
    created_at: store.created_at,
  }
}

export async function disconnectStore(storeId: string, workspaceId: string) {
  const { data: rawIntegration, error } = await supabaseAdmin
    .from('integrations')
    .select('id')
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !rawIntegration) throw new Error('Integration not found')

  // No explicit token-revocation call here (was `DELETE /admin/api/2024-01/api_tokens/current.json`,
  // a legacy REST endpoint). Investigated during the GraphQL migration (2026-07):
  // it no longer appears in Shopify's REST Admin API docs (404 on both `latest` and the
  // pinned `2024-01`), has been removed from Shopify's own official client libraries, and
  // has no GraphQL Admin API equivalent (self-revocation of an app's current token is not
  // a supported API operation — Shopify invalidates tokens automatically on client-secret
  // rotation or app uninstall). The call was already best-effort with all errors swallowed,
  // so removing it changes no observed behavior; we still null out the stored credentials below.

  const { error: updateError } = await supabaseAdmin
    .from('integrations')
    .update({
      shopify_access_token: null,
      shopify_client_secret: null,
      shopify_scope: null,
      shopify_connected_at: null,
    })
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)

  if (updateError) throw updateError
}

export async function deleteStore(storeId: string, workspaceId: string) {
  // Best-effort token revocation before deleting
  try {
    await disconnectStore(storeId, workspaceId)
  } catch {
    // Continue with deletion even if revocation fails
  }

  // Orphan shopify_orders (set store_id to null)
  await supabaseAdmin
    .from('shopify_orders')
    .update({ store_id: null })
    .eq('store_id', storeId)

  // Orphan shopify_customers (set store_id to null)
  await supabaseAdmin
    .from('shopify_customers')
    .update({ store_id: null })
    .eq('store_id', storeId)

  // Orphan email_conversations (set store_id to null)
  await supabaseAdmin
    .from('email_conversations')
    .update({ store_id: null })
    .eq('store_id', storeId)

  // Delete the store — cascades to integrations and email_accounts
  const { error } = await supabaseAdmin
    .from('stores')
    .delete()
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)

  if (error) throw error
}

export async function listStoreEmailAccounts(storeId: string, workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .select('id, provider, email_address, status, connected_at, watch_expiry')
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
    .order('connected_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function deleteStoreEmailAccount(
  accountId: string,
  storeId: string,
  workspaceId: string
) {
  const { error } = await supabaseAdmin
    .from('email_accounts')
    .delete()
    .eq('id', accountId)
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)

  if (error) throw error
}
