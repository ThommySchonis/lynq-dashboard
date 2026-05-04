import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain, email, apiKey } = await request.json()
  if (!domain || !email || !apiKey) {
    return NextResponse.json({ error: 'Domain, email and API key are required' }, { status: 400 })
  }

  const cleanDomain = domain.replace('.gorgias.com', '').trim().toLowerCase()

  // Verify credentials work
  const auth = 'Basic ' + Buffer.from(`${email}:${apiKey}`).toString('base64')
  const testRes = await fetch(`https://${cleanDomain}.gorgias.com/api/account`, {
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
  })

  if (!testRes.ok) {
    return NextResponse.json({ error: 'Invalid credentials. Check your domain, email and API key.' }, { status: 400 })
  }

  // Transition: dual-write client_id (legacy) + workspace_id, keep onConflict
  await supabaseAdmin.from('integrations').upsert({
    client_id:            ctx.user.id,
    workspace_id:         ctx.workspaceId,
    gorgias_domain:       cleanDomain,
    gorgias_email:        email,
    gorgias_api_key:      apiKey,
    gorgias_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  return NextResponse.json({ success: true, domain: cleanDomain })
}

export async function DELETE(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('integrations').update({
    gorgias_domain:       null,
    gorgias_email:        null,
    gorgias_api_key:      null,
    gorgias_connected_at: null,
  }).eq('workspace_id', ctx.workspaceId)

  return NextResponse.json({ success: true })
}
