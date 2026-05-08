import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../../lib/encryption'
import { getAuthContext } from '../../../../../lib/auth'
import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

// POST /api/auth/custom-email/connect
// Body: { imapHost, imapPort, smtpHost, smtpPort, email, password }
// Tests both IMAP and SMTP connections, then saves encrypted credentials
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, workspaceId } = ctx

  const { imapHost, imapPort, smtpHost, smtpPort, email, password } = await request.json()

  if (!imapHost || !smtpHost || !email || !password) {
    return NextResponse.json({ error: 'imapHost, smtpHost, email and password are required' }, { status: 400 })
  }

  // Test IMAP connection
  const imapClient = new ImapFlow({
    host: imapHost,
    port: parseInt(imapPort) || 993,
    secure: parseInt(imapPort) !== 143,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 10000,
  })

  try {
    await imapClient.connect()
    await imapClient.logout()
  } catch (err) {
    return NextResponse.json({ error: `IMAP connection failed: ${err.message}` }, { status: 400 })
  }

  // Test SMTP connection
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort) || 587,
    secure: parseInt(smtpPort) === 465,
    auth: { user: email, pass: password },
    connectionTimeout: 10000,
  })

  try {
    await transporter.verify()
  } catch (err) {
    return NextResponse.json({ error: `SMTP connection failed: ${err.message}` }, { status: 400 })
  }

  // Encrypt credentials
  const encryptedPassword = encrypt(password)

  // Check if this is the first email account for the workspace (to set is_default)
  const { count } = await supabaseAdmin
    .from('email_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  const isDefault = count === 0

  // NEW: write to unified email_accounts table
  const emailAccountRecord = {
    client_id: user.id,
    workspace_id: workspaceId,
    user_id: user.id,
    provider: 'custom',
    email_address: email,
    display_name: email,
    username: email,
    imap_host: imapHost,
    imap_port: parseInt(imapPort) || 993,
    smtp_host: smtpHost,
    smtp_port: parseInt(smtpPort) || 587,
    encrypted_password: encryptedPassword,
    status: 'active',
    is_default: isDefault,
  }

  const { error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })

  if (emailAccountError) {
    console.error('[custom-email/connect] email_accounts upsert error:', emailAccountError.message)
  }

  // LEGACY dual-write: keep writing to custom_email_tokens for backwards compatibility
  const { error: legacyError } = await supabaseAdmin.from('custom_email_tokens').upsert({
    user_id: user.id,
    email,
    imap_host: imapHost,
    imap_port: parseInt(imapPort) || 993,
    smtp_host: smtpHost,
    smtp_port: parseInt(smtpPort) || 587,
    encrypted_password: encryptedPassword,
  }, { onConflict: 'user_id' })

  if (legacyError) {
    console.error('[custom-email/connect] custom_email_tokens legacy upsert error:', legacyError.message)
  }

  if (emailAccountError && legacyError) {
    return NextResponse.json({ error: emailAccountError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email })
}
