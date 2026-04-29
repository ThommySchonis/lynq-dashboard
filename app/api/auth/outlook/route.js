import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { createOAuthState } from '../../../../lib/oauthState'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userToken = searchParams.get('t')

  if (!userToken) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?outlook=error`)
  }

  const user = await getUserFromToken(userToken)
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?outlook=error`)
  }

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
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('state', createOAuthState({ userId: user.id, provider: 'outlook' }))

  return NextResponse.redirect(url.toString())
}
