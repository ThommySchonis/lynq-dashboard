import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userToken = searchParams.get('t')

  if (!userToken) {
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error')
  }

  // Verify the Supabase user from the token
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(userToken)
  if (error || !user) {
    console.error('[Gmail auth] Invalid token:', error?.message)
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const redirectUri = 'https://lynq-dashboard.vercel.app/api/auth/gmail/callback'

  const scope = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', user.id) // Pass user ID through OAuth flow

  return NextResponse.redirect(url.toString())
}
