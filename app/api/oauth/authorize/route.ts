import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getClient } from '@/lib/services/oauth-clients'
import { createAuthCode } from '@/lib/services/oauth-codes'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface ApproveBody {
  client_id?: string
  redirect_uri?: string
  code_challenge?: string
  code_challenge_method?: string
  state?: string
  scope?: string
}

export async function POST(request: NextRequest) {
  // The consenting user is authenticated by their Supabase session JWT.
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'access_denied', error_description: 'Not authenticated' }, { status: 401 })

  let body: ApproveBody
  try { body = (await request.json()) as ApproveBody } catch {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Body must be JSON' }, { status: 400 })
  }

  const { client_id, redirect_uri, code_challenge, code_challenge_method } = body
  if (!client_id || !redirect_uri || !code_challenge) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'client_id, redirect_uri, code_challenge required' }, { status: 400 })
  }
  if (code_challenge_method && code_challenge_method !== 'S256') {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Only S256 PKCE is supported' }, { status: 400 })
  }

  const client = await getClient(supabaseAdmin as never, client_id)
  if (!client) return NextResponse.json({ error: 'invalid_client' }, { status: 400 })
  if (!client.redirectUris.includes(redirect_uri)) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri not registered for client' }, { status: 400 })
  }

  const code = await createAuthCode(supabaseAdmin as never, {
    clientId: client_id,
    userId: ctx.user.id,
    workspaceId: ctx.workspaceId,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    scope: body.scope ?? 'mcp',
  })

  const url = new URL(redirect_uri)
  url.searchParams.set('code', code)
  if (body.state) url.searchParams.set('state', body.state)
  return NextResponse.json({ redirect: url.toString() })
}
