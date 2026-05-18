import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { createOAuthState } from '../../../../lib/oauthState'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const authHeader = request.headers.get('authorization')

  // Support both Authorization header and ?t= query param (for direct browser redirects)
  let userToken: string | null = null
  if (authHeader) {
    userToken = authHeader.replace('Bearer ', '')
  } else {
    userToken = searchParams.get('t')
  }

  if (!userToken) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?provider=gmail&status=error`)
  }

  const user = await getUserFromToken(userToken)
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?provider=gmail&status=error`)
  }

  // Look up the user's workspace so we can embed workspaceId in the state
  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const workspaceId = membership?.workspace_id ?? null

  const storeId = searchParams.get('store_id')

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`

  const scope = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', createOAuthState({ userId: user.id, workspaceId, provider: 'gmail', storeId: storeId || undefined }))

  return NextResponse.redirect(url.toString())
}
