import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface EmailDisplaySettingsRow {
  id: string
  display_name: string | null
  closing_text: string | null
  signature_html: string | null
  logo_url: string | null
  logo_width: number
  logo_link_url: string | null
  is_active: boolean
}

export async function resolveDisplaySettings(
  workspaceId: string,
  storeId: string | null,
  emailAccountId: string
): Promise<EmailDisplaySettingsRow | null> {
  if (!storeId) return null

  const accountResult = await supabaseAdmin
    .from('email_display_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .eq('email_account_id', emailAccountId)
    .maybeSingle()

  if (accountResult.data) return accountResult.data as EmailDisplaySettingsRow

  const storeResult = await supabaseAdmin
    .from('email_display_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .is('email_account_id', null)
    .maybeSingle()

  return (storeResult.data as EmailDisplaySettingsRow) ?? null
}

export function buildSignatureHtml(settings: EmailDisplaySettingsRow): string {
  const parts: string[] = []

  if (settings.closing_text) {
    parts.push(`<p style="margin:0 0 12px 0;">${escapeHtml(settings.closing_text)}</p>`)
  }

  parts.push('<hr style="border:none;border-top:1px solid #e5e5e5;margin:12px 0;" />')

  if (settings.logo_url) {
    const width = settings.logo_width || 150
    const imgTag = `<img src="${escapeHtml(settings.logo_url)}" width="${width}" alt="Logo" style="display:block;max-width:100%;height:auto;" />`
    if (settings.logo_link_url) {
      parts.push(`<a href="${escapeHtml(settings.logo_link_url)}" target="_blank" rel="noopener">${imgTag}</a>`)
    } else {
      parts.push(imgTag)
    }
  }

  if (settings.signature_html) {
    parts.push(`<div style="margin-top:8px;">${settings.signature_html}</div>`)
  }

  return `<div class="email-signature" style="margin-top:16px;">${parts.join('')}</div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
