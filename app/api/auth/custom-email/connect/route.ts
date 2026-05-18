import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../../lib/encryption'
import { getAuthContext } from '../../../../../lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ImapFlow } from 'imapflow'
import { parseBody } from '@/lib/utils/typed-json'

interface CustomEmailBody {
  imapHost: string
  imapPort?: string | number
  smtpHost: string
  smtpPort?: string | number
  email: string
  password: string
  store_id?: string
}
// nodemailer ships without bundled types; suppress the implicit-any warning for this import
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const nodemailer = require('nodemailer') as any

// POST /api/auth/custom-email/connect
// Body: { imapHost, imapPort, smtpHost, smtpPort, email, password }
// Tests both IMAP and SMTP connections, then saves encrypted credentials
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, workspaceId } = ctx

  const { imapHost, imapPort, smtpHost, smtpPort, email, password, store_id: storeId } = await parseBody<CustomEmailBody>(request)

  if (!imapHost || !smtpHost || !email || !password) {
    return NextResponse.json({ error: 'imapHost, smtpHost, email and password are required' }, { status: 400 })
  }

  // Test IMAP connection
  const imapClient = new ImapFlow({
    host: imapHost,
    port: parseInt(String(imapPort)) || 993,
    secure: parseInt(String(imapPort)) !== 143,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 10000,
  })

  try {
    await imapClient.connect()
    await imapClient.logout()
  } catch (err: unknown) {
    return NextResponse.json({ error: `IMAP connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 400 })
  }

  // Test SMTP connection
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(String(smtpPort)) || 587,
    secure: parseInt(String(smtpPort)) === 465,
    auth: { user: email, pass: password },
    connectionTimeout: 10000,
  })

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await transporter.verify()
  } catch (err: unknown) {
    return NextResponse.json({ error: `SMTP connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 400 })
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
    provider: 'custom',
    email_address: email,
    display_name: email,
    username: email,
    imap_host: imapHost,
    imap_port: parseInt(String(imapPort)) || 993,
    smtp_host: smtpHost,
    smtp_port: parseInt(String(smtpPort)) || 587,
    encrypted_password: encryptedPassword,
    store_id: storeId || null,
    status: 'active',
    is_default: isDefault,
  }

  const { error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })

  if (emailAccountError) {
    console.error('[custom-email/connect] email_accounts upsert error:', emailAccountError.message)
    return NextResponse.json({ error: emailAccountError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email })
}
