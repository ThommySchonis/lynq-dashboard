import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getClient } from '@/lib/services/oauth-clients'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const clientId = request.nextUrl.searchParams.get('client_id') ?? ''
  const client = clientId ? await getClient(supabaseAdmin as never, clientId) : null

  return NextResponse.json({
    client_name: client?.clientName ?? null,
    workspace_name: ctx.workspace.name,
    role: ctx.role,
  })
}
