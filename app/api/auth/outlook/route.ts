import { getUserFromToken, supabaseAdmin } from '@/lib/supabaseAdmin'
import { createOAuthState } from '@/lib/oauthState'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { oauthStartQuery } from '@/lib/schemas/auth'

interface WorkspaceMemberRow {
  workspace_id?: string
}

export async function GET(request: NextRequest) {
  const [query, queryErr] = validateQuery(request, oauthStartQuery)
  if (queryErr) return queryErr

  const userToken = query.t ?? null

  if (!userToken) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?provider=outlook&status=error`)
  }

  const user = await getUserFromToken(userToken)
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?provider=outlook&status=error`)
  }

  // Look up the user's workspace so we can embed workspaceId in the state
  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const workspaceId = (membership as WorkspaceMemberRow | null)?.workspace_id ?? ''

  const storeId = query.store_id ?? null

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/outlook/callback`
  const tenantId = 'common' // supports both personal and business accounts

  const scope = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ].join(' ')

  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('state', createOAuthState({ userId: user.id, workspaceId, provider: 'outlook', storeId: storeId || undefined }))

  return NextResponse.redirect(url.toString())
}
