import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { consumeAuthCode } from '@/lib/services/oauth-codes'
import { verifyPkceS256 } from '@/lib/oauth/pkce'
import { createTokenPair, rotateRefreshToken, type IssuedTokenPair } from '@/lib/services/oauth-tokens'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function tokenResponse(pair: IssuedTokenPair, scope: string | null) {
  const expiresIn = Math.max(0, Math.floor((new Date(pair.accessExpiresAt).getTime() - Date.now()) / 1000))
  return NextResponse.json({
    access_token: pair.accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: pair.refreshToken,
    scope: scope ?? 'mcp',
  })
}

function oauthError(error: string, description?: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status })
}

async function readParams(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v)]))
  }
  const form = await request.formData()
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) out[k] = String(v)
  return out
}

export async function POST(request: NextRequest) {
  const params = await readParams(request)
  const grantType = params.grant_type

  if (grantType === 'authorization_code') {
    const { code, code_verifier } = params
    if (!code || !code_verifier) return oauthError('invalid_request', 'code and code_verifier required')

    const record = await consumeAuthCode(supabaseAdmin as never, code)
    if (!record) return oauthError('invalid_grant', 'Authorization code invalid or expired')
    if (!params.client_id || params.client_id !== record.clientId) return oauthError('invalid_grant', 'client mismatch')
    if (!params.redirect_uri || params.redirect_uri !== record.redirectUri) return oauthError('invalid_grant', 'redirect_uri mismatch')
    if (!verifyPkceS256(code_verifier, record.codeChallenge)) return oauthError('invalid_grant', 'PKCE verification failed')

    const pair = await createTokenPair(supabaseAdmin as never, {
      clientId: record.clientId,
      userId: record.userId,
      workspaceId: record.workspaceId,
      scope: record.scope,
    })
    return tokenResponse(pair, record.scope)
  }

  if (grantType === 'refresh_token') {
    const { refresh_token } = params
    if (!refresh_token) return oauthError('invalid_request', 'refresh_token required')
    const pair = await rotateRefreshToken(supabaseAdmin as never, refresh_token)
    if (!pair) return oauthError('invalid_grant', 'Refresh token invalid or expired')
    return tokenResponse(pair, 'mcp')
  }

  return oauthError('unsupported_grant_type', `grant_type '${grantType}' not supported`)
}
