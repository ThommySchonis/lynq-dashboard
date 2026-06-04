import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/supabaseAdmin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createOAuthState } from '@/lib/oauthState'

interface WorkspaceMemberRow {
  workspace_id?: string
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const url = new URL(request.url)
  const tokenParam = url.searchParams.get('t')
  const authHeader = request.headers.get('Authorization')
  const storeId = url.searchParams.get('store_id')

  let userToken: string | null = null
  if (authHeader) {
    userToken = authHeader.replace('Bearer ', '')
  } else {
    userToken = tokenParam
  }

  if (!userToken) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)
  }

  const user = await getUserFromToken(userToken)
  if (!user) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)
  }

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const workspaceId = (membership as WorkspaceMemberRow | null)?.workspace_id ?? ''

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const redirectUri = `${appUrl}/api/auth/gmail/callback`

  const scope = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId!)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set(
    'state',
    createOAuthState({
      userId: user.id,
      workspaceId,
      provider: 'gmail',
      storeId: storeId || undefined,
    }),
  )

  return NextResponse.redirect(authUrl.toString())
}
