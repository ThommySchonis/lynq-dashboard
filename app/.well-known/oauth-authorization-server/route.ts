import { NextResponse } from 'next/server'

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Advertises the endpoints MCP clients use to register, get consent, and
 * exchange tokens. PKCE S256 is required; clients are public (no secret).
 */
export function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lynq.app'
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  })
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
