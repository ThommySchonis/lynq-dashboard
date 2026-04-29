import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import dns from 'dns/promises'
import net from 'net'

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const parts = address.split('.').map(Number)
    return parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase()
    return normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
  }
  return false
}

function normalizeHost(host) {
  const value = String(host || '').trim().toLowerCase()
  if (!/^[a-z0-9.-]+$/.test(value) || value.length > 253) return ''
  return value
}

function normalizePort(port) {
  const value = parseInt(port, 10)
  return Number.isInteger(value) && value >= 1 && value <= 65535 ? value : null
}

async function assertPublicHost(host) {
  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await dns.lookup(host, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(result => isPrivateAddress(result.address))) {
    throw new Error('Host is not allowed')
  }
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password, imap_host, imap_port, smtp_host, smtp_port } = await request.json()

  if (!email || !password || !imap_host || !imap_port || !smtp_host || !smtp_port) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const imapHost = normalizeHost(imap_host)
  const smtpHost = normalizeHost(smtp_host)
  const imapPort = normalizePort(imap_port)
  const smtpPort = normalizePort(smtp_port)
  if (!imapHost || !smtpHost || !imapPort || !smtpPort) {
    return NextResponse.json({ error: 'Invalid mail server settings' }, { status: 400 })
  }

  try {
    await Promise.all([assertPublicHost(imapHost), assertPublicHost(smtpHost)])
  } catch {
    return NextResponse.json({ error: 'Mail server host is not allowed' }, { status: 400 })
  }

  // Test IMAP connection before saving
  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapPort !== 143,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 10000,
  })

  try {
    await client.connect()
    await client.logout()
  } catch (err) {
    return NextResponse.json({ error: `Cannot connect: ${err.message}` }, { status: 400 })
  }

  const encrypted_password = encrypt(password)

  await supabaseAdmin.from('custom_email_tokens').upsert({
    user_id: user.id,
    email,
    encrypted_password,
    imap_host: imapHost,
    imap_port: imapPort,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true, email })
}

export async function DELETE(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('custom_email_tokens').delete().eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
