import { getAdminClient } from '../supabase.ts'

interface EmailDisplaySettings {
  id: string
  workspace_id: string
  store_id: string | null
  email_account_id: string | null
  display_name: string | null
  closing_text: string | null
  signature_html: string | null
  logo_url: string | null
  logo_width: number
  logo_link_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UpsertParams {
  workspaceId: string
  storeId: string
  emailAccountId?: string | null
  displayName?: string | null
  closingText?: string | null
  signatureHtml?: string | null
  logoUrl?: string | null
  logoWidth?: number
  logoLinkUrl?: string | null
  isActive?: boolean
}

export async function getDisplaySettingsForStore(
  workspaceId: string,
  storeId: string
): Promise<EmailDisplaySettings[]> {
  const sb = getAdminClient()
  const { data, error } = await sb
    .from('email_display_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .order('email_account_id', { ascending: true, nullsFirst: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as EmailDisplaySettings[]
}

export async function upsertDisplaySettings(params: UpsertParams): Promise<EmailDisplaySettings> {
  const sb = getAdminClient()
  const {
    workspaceId, storeId, emailAccountId,
    displayName, closingText, signatureHtml,
    logoUrl, logoWidth, logoLinkUrl, isActive,
  } = params

  let query = sb
    .from('email_display_settings')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)

  if (emailAccountId) {
    query = query.eq('email_account_id', emailAccountId)
  } else {
    query = query.is('email_account_id', null)
  }

  const { data: existing } = await query.maybeSingle()

  const row = {
    workspace_id: workspaceId,
    store_id: storeId,
    email_account_id: emailAccountId ?? null,
    display_name: displayName ?? null,
    closing_text: closingText ?? null,
    signature_html: signatureHtml ?? null,
    logo_url: logoUrl ?? null,
    logo_width: logoWidth ?? 150,
    logo_link_url: logoLinkUrl ?? null,
    is_active: isActive ?? true,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await sb
      .from('email_display_settings')
      .update(row)
      .eq('id', (existing as { id: string }).id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EmailDisplaySettings
  }

  const { data, error } = await sb
    .from('email_display_settings')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as EmailDisplaySettings
}

export async function deleteDisplaySettings(
  workspaceId: string,
  id: string
): Promise<void> {
  const sb = getAdminClient()
  const { error } = await sb
    .from('email_display_settings')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) throw new Error(error.message)
}
