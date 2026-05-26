import { logger } from '@/lib/logger'

const RESEND_FROM = 'Lynq <noreply@lynqagency.com>'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendDeletionScheduledEmail({
  to,
  scheduledFor,
  dashboardUrl,
}: {
  to: string
  scheduledFor: string
  dashboardUrl: string
}): Promise<{ status: 'sent' | 'failed' | 'not_configured'; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { status: 'not_configured' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const deletionDate = new Date(scheduledFor).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const safeDashboardUrl = escapeHtml(dashboardUrl)

    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: 'Your Lynq account is scheduled for deletion',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <h2 style="margin: 0 0 16px;">Account Deletion Scheduled</h2>
          <p style="color: #555; line-height: 1.6;">
            Your Lynq account and all associated data will be permanently deleted on <strong>${escapeHtml(deletionDate)}</strong>.
          </p>
          <p style="color: #555; line-height: 1.6;">
            If this was a mistake, you can cancel the deletion by logging in to your dashboard within the next 7 days.
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${safeDashboardUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Cancel Deletion</a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">
            If you did not request this deletion, please contact us immediately.
          </p>
        </div>
      `,
    })

    return { status: 'sent' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('[account-deletion-email]', 'scheduled failed', { error: message })
    return { status: 'failed', error: message }
  }
}

export async function sendDeletionCompletedEmail({
  to,
}: {
  to: string
}): Promise<{ status: 'sent' | 'failed' | 'not_configured'; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { status: 'not_configured' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: 'Your Lynq account has been deleted',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <h2 style="margin: 0 0 16px;">Account Deleted</h2>
          <p style="color: #555; line-height: 1.6;">
            Your Lynq account and all associated data have been permanently deleted.
          </p>
          <p style="color: #555; line-height: 1.6;">
            If you believe this was done in error, please contact us at support@lynqagency.com.
          </p>
        </div>
      `,
    })

    return { status: 'sent' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('[account-deletion-email]', 'completed failed', { error: message })
    return { status: 'failed', error: message }
  }
}
