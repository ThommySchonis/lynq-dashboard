import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'mail.lynqagency.com'

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { realEmail, displayName } = await request.json()
  const normalizedEmail = normalizeEmail(realEmail)
  const normalizedName = String(displayName || '').trim().slice(0, 120)
  if (!normalizedEmail) return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 })

  // Check if already connected (workspace-level email connection)
  const { data: existing } = await supabaseAdmin
    .from('email_accounts')
    .select('forwarding_address')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  // Reuse existing forwarding address or generate a new one (workspace-prefixed)
  const slug = existing?.forwarding_address?.split('@')[0] || `ws-${ctx.workspaceId.split('-')[0]}`
  const forwardingAddress = `${slug}@${INBOUND_DOMAIN}`

  // Transition: dual-write client_id (legacy) + workspace_id, keep onConflict
  await supabaseAdmin.from('email_accounts').upsert({
    client_id:          ctx.user.id,
    workspace_id:       ctx.workspaceId,
    real_email:         normalizedEmail,
    display_name:       normalizedName || normalizedEmail,
    forwarding_address: forwardingAddress,
    connected_at:       new Date().toISOString(),
  }, { onConflict: 'client_id' })

  return NextResponse.json({
    success: true,
    forwardingAddress,
    instructions: {
      step1: `In privateemail.com: set up forwarding from ${normalizedEmail} to ${forwardingAddress}`,
      step2: `Add this SPF record to your DNS: include:resend.com`,
      step3: `Resend will provide DKIM records — add them to your DNS for ${normalizedEmail.split('@')[1]}`,
    },
  })
}

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ connected: false })

  const { data } = await supabaseAdmin
    .from('email_accounts')
    .select('real_email, display_name, forwarding_address, connected_at')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!data) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    realEmail: data.real_email,
    displayName: data.display_name,
    forwardingAddress: data.forwarding_address,
  })
}

export async function DELETE(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('email_accounts').delete().eq('workspace_id', ctx.workspaceId)
  return NextResponse.json({ success: true })
}
