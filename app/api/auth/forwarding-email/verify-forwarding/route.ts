import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { forwardingEmailVerifyBody } from '@/lib/schemas/forwarding'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bErr] = await validateBody(request, forwardingEmailVerifyBody)
  if (bErr) return bErr

  const { account_id } = body

  const { data: account, error: fetchError } = await supabaseAdmin
    .from('email_accounts')
    .select('id, email_address, provider')
    .eq('id', account_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', 'forwarding')
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Generate verification token with 24h expiry
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('email_accounts')
    .update({
      verification_token: token,
      verification_token_expires_at: expiresAt,
    })
    .eq('id', account_id)

  // Send verification email via Resend
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.FORWARDING_VERIFY_FROM || 'Lynq & Flow <verify@resend.dev>',
      to: account.email_address as string,
      subject: `Verify your email forwarding [lynq-verify:${token}]`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Email Forwarding Verification</h2>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
            This is a test email to verify that forwarding is set up correctly for
            <strong style="color:#1C0F36;">${account.email_address as string}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0;">
            If you see this email in your Lynq inbox, forwarding is working. If not, please check your email forwarding settings.
          </p>
          <p style="font-size:12px;color:#9B91A8;margin:24px 0 0;">
            This verification link expires in 24 hours.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ sent: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
