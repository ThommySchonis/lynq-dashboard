import { escapeHtml } from '@/lib/email'
import { logger } from '@/lib/logger'

const FROM_DEFAULT = 'Lynq & Flow <onboarding@resend.dev>'

/** Validate URL is https and on an allowed domain (or localhost for dev). */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export async function sendTransferInitiatedEmail({
  to,
  workspaceName,
  ownerEmail,
  dashboardUrl,
}: {
  to: string
  workspaceName: string
  ownerEmail: string
  dashboardUrl: string
}) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[email]', 'RESEND_API_KEY not set — skipping send')
    return { status: 'not_configured' as const }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.INVITE_EMAIL_FROM || FROM_DEFAULT
    const safeWs = escapeHtml(workspaceName)
    const safeOwner = escapeHtml(ownerEmail)
    const safeUrl = sanitizeUrl(dashboardUrl)

    if (!safeUrl) {
      logger.warn('[email]', 'Invalid dashboard URL — skipping transfer email')
      return { status: 'failed' as const, error: 'Invalid dashboard URL' }
    }

    await resend.emails.send({
      from,
      to,
      subject: `Ownership transfer request for ${workspaceName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Ownership Transfer Request</h2>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
            <strong style="color:#1C0F36;">${safeOwner}</strong> wants to transfer ownership of
            <strong style="color:#1C0F36;">${safeWs}</strong> to you.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
            This request expires in 7 days. Log in to your dashboard to accept or decline.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${safeUrl}" style="background:#A175FC;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:500;font-size:14px;">
              View transfer request
            </a>
          </p>
          <p style="font-size:12px;color:#9B91A8;margin:0;">
            If you didn't expect this request, you can safely ignore it or decline it.
          </p>
        </div>
      `,
    })
    return { status: 'sent' as const }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Email send failed'
    logger.error('[email]', 'Resend error', { error })
    return { status: 'failed' as const, error }
  }
}

export async function sendTransferAcceptedEmail({
  to,
  workspaceName,
  newOwnerEmail,
  newRoleForOldOwner,
}: {
  to: string
  workspaceName: string
  newOwnerEmail: string
  newRoleForOldOwner: string
}) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[email]', 'RESEND_API_KEY not set — skipping send')
    return { status: 'not_configured' as const }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.INVITE_EMAIL_FROM || FROM_DEFAULT
    const safeWs = escapeHtml(workspaceName)
    const safeNewOwner = escapeHtml(newOwnerEmail)

    await resend.emails.send({
      from,
      to,
      subject: `Ownership of ${workspaceName} has been transferred`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Ownership Transferred</h2>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
            <strong style="color:#1C0F36;">${safeNewOwner}</strong> has accepted ownership of
            <strong style="color:#1C0F36;">${safeWs}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
            Your role has been changed to <strong style="color:#1C0F36;">${escapeHtml(newRoleForOldOwner)}</strong>.
          </p>
          <p style="font-size:12px;color:#9B91A8;margin:0;">
            If you did not initiate this transfer, please contact your workspace administrator.
          </p>
        </div>
      `,
    })
    return { status: 'sent' as const }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Email send failed'
    logger.error('[email]', 'Resend error', { error })
    return { status: 'failed' as const, error }
  }
}
