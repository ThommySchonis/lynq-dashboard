import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/supabaseAdmin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createOAuthState } from '@/lib/oauthState'
import { getRequestOrigin } from '@/lib/utils/request'

interface WorkspaceMemberRow {
  workspace_id?: string
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const url = new URL(request.url)
  const userToken = url.searchParams.get('t')
  const storeId = url.searchParams.get('store_id')

  if (!userToken) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error`)
  }

  const user = await getUserFromToken(userToken)
  if (!user) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error`)
  }

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const workspaceId = (membership as WorkspaceMemberRow | null)?.workspace_id ?? ''

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = `${appUrl}/api/auth/outlook/callback`
  const tenantId = 'common'

  const scope = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ].join(' ')

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  authUrl.searchParams.set('client_id', clientId!)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('response_mode', 'query')
  authUrl.searchParams.set(
    'state',
    createOAuthState({
      userId: user.id,
      workspaceId,
      provider: 'outlook',
      storeId: storeId || undefined,
      returnOrigin: getRequestOrigin(request) || undefined,
    }),
  )

  return NextResponse.redirect(authUrl.toString())
}
