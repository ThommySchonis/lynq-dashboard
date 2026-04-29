import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'mail.lynqagency.com'

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { realEmail, displayName } = await request.json()
  const normalizedEmail = normalizeEmail(realEmail)
  const normalizedName = String(displayName || '').trim().slice(0, 120)
  if (!normalizedEmail) return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 })

  // Check if already connected
  const { data: existing } = await supabaseAdmin
    .from('email_accounts')
    .select('forwarding_address')
    .eq('client_id', user.id)
    .maybeSingle()

  // Reuse existing forwarding address or generate new one
  const slug = existing?.forwarding_address?.split('@')[0] || `client-${user.id.split('-')[0]}`
  const forwardingAddress = `${slug}@${INBOUND_DOMAIN}`

  await supabaseAdmin.from('email_accounts').upsert({
    client_id: user.id,
    real_email: normalizedEmail,
    display_name: normalizedName || normalizedEmail,
    forwarding_address: forwardingAddress,
    connected_at: new Date().toISOString(),
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
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ connected: false })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ connected: false })

  const { data } = await supabaseAdmin
    .from('email_accounts')
    .select('real_email, display_name, forwarding_address, connected_at')
    .eq('client_id', user.id)
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
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('email_accounts').delete().eq('client_id', user.id)
  return NextResponse.json({ success: true })
}
