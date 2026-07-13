import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/

export function normalizeShopDomain(shop: string): string {
  const s = shop.toLowerCase().trim()
  return s.endsWith('.myshopify.com') ? s : `${s}.myshopify.com`
}

export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_RE.test(shop.toLowerCase().trim())
}

/**
 * Verifies Shopify's HMAC over the query params (all params except `hmac`,
 * sorted, joined `k=v&...`, HMAC-SHA256 hex). Mirrors the existing callback.
 */
export function verifyShopifyHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get('hmac')
  if (!hmac) return false
  const entries: Record<string, string> = {}
  for (const [k, v] of params.entries()) {
    if (k === 'hmac' || k === 'signature') continue
    entries[k] = v
  }
  const message = Object.keys(entries).sort().map((k) => `${k}=${entries[k]}`).join('&')
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex')
  const a = Buffer.from(digest)
  const b = Buffer.from(hmac)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function buildInstallAuthUrl(args: {
  shop: string
  appUrl: string
  clientId: string
  scopes: string
  state: string
}): string {
  const { shop, appUrl, clientId, scopes, state } = args
  const qs = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: `${appUrl}/api/auth/shopify/callback`,
    state,
  })
  return `https://${shop}/admin/oauth/authorize?${qs.toString()}`
}

/**
 * Looks up an existing Supabase auth user by email, paginating through
 * `listUsers()` rather than relying on its default first-page-only (~50
 * users) result. Used by the install callback to decide whether to reuse an
 * existing account instead of calling `createUser` on an email that's
 * already registered (which throws).
 */
export async function findUserIdByEmail(email: string): Promise<string | undefined> {
  const target = email.toLowerCase()
  const perPage = 200
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit.id
    if (data.users.length < perPage) return undefined // last page reached
  }
}

interface ProvisionResult {
  workspace_id?: string
  member_id?: string
}

interface ProvisionRpcResponse {
  data: ProvisionResult | null
  error: { message: string } | null
}

/**
 * Creates (or reuses) a Supabase user for the shop owner and provisions their
 * workspace. Idempotent by way of the `provision_workspace` RPC (migration
 * 20260707121521): that function guards on an existing `workspace_members` row
 * and returns the user's existing workspace instead of inserting a duplicate,
 * so passing an `existingUserId` who already owns a workspace reuses it rather
 * than minting a second one. A workspace can hold multiple stores.
 */
export async function provisionInstallIdentity(args: {
  email: string
  shopName: string
  existingUserId?: string
}): Promise<{ userId: string; workspaceId: string; memberId: string }> {
  const { email, shopName } = args
  let userId = args.existingUserId

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { company_name: shopName },
    })
    if (error || !data?.user?.id) {
      throw new Error(`createUser failed: ${error?.message ?? 'no user returned'}`)
    }
    userId = data.user.id
  }

  const rpcResponse = (await supabaseAdmin.rpc('provision_workspace', {
    p_user_id: userId,
    p_workspace_name: shopName,
  })) as ProvisionRpcResponse
  const { data: result, error: rpcError } = rpcResponse
  if (rpcError || !result?.workspace_id || !result?.member_id) {
    throw new Error(`provision_workspace failed: ${rpcError?.message ?? 'no workspace returned'}`)
  }

  return { userId, workspaceId: result.workspace_id, memberId: result.member_id }
}

/**
 * Mints a passwordless magic-link the browser follows to establish a session.
 * The action_link ends at `redirectTo`, where the client supabase-js
 * (detectSessionInUrl) persists the session — mirroring app/auth/confirm.
 */
export async function createInstallSessionLink(args: {
  email: string
  redirectTo: string
}): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: args.email,
    options: { redirectTo: args.redirectTo },
  })
  const link = data?.properties?.action_link
  if (error || !link) {
    throw new Error(`generateLink failed: ${error?.message ?? 'no action_link'}`)
  }
  return link
}
