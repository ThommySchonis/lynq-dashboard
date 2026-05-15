import { supabaseAdmin } from '../supabaseAdmin'
import type { StorePublic, StoreEmailConfig } from '@/types/stores'

const PUBLIC_COLUMNS = 'id, name, shopify_domain, shopify_connected_at, store_currency, created_at'

export async function listStores(workspaceId: string): Promise<StorePublic[]> {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select(PUBLIC_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to list stores: ${error.message}`)
  return (data ?? []) as StorePublic[]
}

export async function getStore(storeId: string, workspaceId: string): Promise<StorePublic | null> {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select(PUBLIC_COLUMNS)
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(`Failed to get store: ${error.message}`)
  return data as StorePublic | null
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
    .select(PUBLIC_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update store: ${error.message}`)
  return data as StorePublic
}

export async function disconnectStore(storeId: string, workspaceId: string): Promise<void> {
  // 1. Read current token + domain for revocation
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('shopify_domain, shopify_access_token')
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  // 2. Revoke the access token at Shopify (best-effort)
  if (store?.shopify_access_token && store?.shopify_domain) {
    try {
      await fetch(
        `https://${store.shopify_domain}/admin/api/2025-04/api_tokens/current.json`,
        {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': store.shopify_access_token },
        }
      )
    } catch {
      // Token revocation is best-effort; continue even if it fails
    }
  }

  // 3. Null the access token in DB — store record is kept
  const { error } = await supabaseAdmin
    .from('stores')
    .update({ shopify_access_token: null, shopify_connected_at: null })
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)

  if (error) throw new Error(`Failed to disconnect store: ${error.message}`)
}

export async function deleteStore(storeId: string, workspaceId: string): Promise<void> {
  // Best-effort token revocation before deleting (once row is gone, token is lost)
  try {
    await disconnectStore(storeId, workspaceId)
  } catch {
    // Continue with deletion even if revocation fails
  }

  // Orphan shopify_orders (set store_id to null, preserve data)
  await supabaseAdmin
    .from('shopify_orders')
    .update({ store_id: null })
    .eq('store_id', storeId)

  // Orphan shopify_customers if table exists (set store_id to null)
  await supabaseAdmin
    .from('shopify_customers')
    .update({ store_id: null })
    .eq('store_id', storeId)
    .then(() => {}, () => {}) // Ignore if table doesn't exist

  // Orphan email_threads if table exists (set store_id to null)
  await supabaseAdmin
    .from('email_threads')
    .update({ store_id: null })
    .eq('store_id', storeId)
    .then(() => {}, () => {}) // Ignore if table doesn't exist

  // Delete email configs (cascade from stores FK handles this, but be explicit)
  await supabaseAdmin
    .from('store_email_configs')
    .delete()
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)

  // Delete the store
  const { error } = await supabaseAdmin
    .from('stores')
    .delete()
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)

  if (error) throw new Error(`Failed to delete store: ${error.message}`)
}

export async function listStoreEmailConfigs(
  storeId: string,
  workspaceId: string
): Promise<StoreEmailConfig[]> {
  const { data, error } = await supabaseAdmin
    .from('store_email_configs')
    .select('id, store_id, workspace_id, provider, email_address, connected_at, watch_expiry')
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
    .order('connected_at', { ascending: true })

  if (error) throw new Error(`Failed to list email configs: ${error.message}`)
  return (data ?? []) as StoreEmailConfig[]
}

export async function deleteStoreEmailConfig(
  configId: string,
  storeId: string,
  workspaceId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('store_email_configs')
    .delete()
    .eq('id', configId)
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)

  if (error) throw new Error(`Failed to delete email config: ${error.message}`)
}
