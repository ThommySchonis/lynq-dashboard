import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { registerClient } from '@/lib/services/oauth-clients'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface RegisterBody {
  client_name?: string
  redirect_uris?: string[]
}

export async function POST(request: NextRequest) {
  let body: RegisterBody
  try {
    body = (await request.json()) as RegisterBody
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, { status: 400 })
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  if (redirectUris.length === 0) {
    return NextResponse.json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, { status: 400 })
  }

  try {
    const client = await registerClient(supabaseAdmin as never, {
      clientName: body.client_name ?? 'MCP Client',
      redirectUris,
    })
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(new Date(client.createdAt).getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: e instanceof Error ? e.message : 'registration failed' },
      { status: 400 },
    )
  }
}
