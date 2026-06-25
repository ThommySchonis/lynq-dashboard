import { logger } from './logger.ts'

const RESEND_API = 'https://api.resend.com/emails'

const ROLE_LABELS: Record<string, string> = {
  admin: 'an Admin',
  agent: 'an Agent',
  observer: 'an Observer',
}

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type SendResult =
  | { status: 'not_configured' }
  | { status: 'sent'; id: string | null }
  | { status: 'failed'; error: string }

async function resendSend(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('INVITE_EMAIL_FROM') || null
  if (!apiKey || !from) {
    logger.warn(
      '[email]',
      !apiKey
        ? 'RESEND_API_KEY not set — skipping send'
        : 'INVITE_EMAIL_FROM not set — skipping send',
    )
    return { status: 'not_configured' }
  }
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    const text = await res.text()
    if (!res.ok) {
      logger.error('[email]', 'Resend error', { status: res.status, body: text.slice(0, 200) })
      return { status: 'failed', error: `Resend ${res.status}: ${text.slice(0, 200)}` }
    }
    let id: string | null = null
    try {
      id = (JSON.parse(text) as { id?: string }).id ?? null
    } catch {
      id = null
    }
    return { status: 'sent', id }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Email send failed'
    logger.error('[email]', 'Resend error', { error })
    return { status: 'failed', error }
  }
}

export async function sendInviteEmail({ to, workspaceName, inviterEmail, role, link }: { to: string; workspaceName: string; inviterEmail: string; role: string; link: string | null }) {
  if (!link) return { status: 'no_link' as const }
  const roleLabel = ROLE_LABELS[role] || 'a member'
  const safeWs = escapeHtml(workspaceName)
  const safeFrom = escapeHtml(inviterEmail || '')
  return resendSend(to, `You've been invited to ${workspaceName}`, `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">You're invited to ${safeWs}</h2>
      <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
        <strong style="color:#1C0F36;">${safeFrom}</strong> has invited you to join
        <strong style="color:#1C0F36;">${safeWs}</strong> on Lynq &amp; Flow as ${roleLabel}.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${link}" style="background:#A175FC;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:500;font-size:14px;">
          Accept invitation
        </a>
      </p>
      <p style="font-size:12px;color:#9B91A8;margin:0;">
        This link expires in 7 days. If you didn't expect this invite, you can safely ignore this email.
      </p>
    </div>
  `)
}

export async function sendSuspensionEmail({ to, workspaceName, reason }: { to: string; workspaceName: string; reason: string | null }) {
  const safeWs = escapeHtml(workspaceName)
  const reasonLine = reason
    ? `<p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 16px;"><strong style="color:#1C0F36;">Reason:</strong> ${escapeHtml(reason)}</p>`
    : ''
  return resendSend(to, 'Your Lynq workspace has been suspended', `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Workspace Suspended</h2>
      <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 16px;">
        Your workspace <strong style="color:#1C0F36;">${safeWs}</strong> has been suspended.
        You can still view your data, but write operations are temporarily disabled.
      </p>
      ${reasonLine}
      <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
        To restore full access, please resolve any outstanding billing issues or contact support.
      </p>
      <p style="margin:0 0 24px;">
        <a href="https://lynq-dashboard.vercel.app" style="background:#A175FC;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:500;font-size:14px;">
          Go to Dashboard
        </a>
      </p>
      <p style="font-size:12px;color:#9B91A8;margin:0;">
        If you believe this was a mistake, please contact us at info@lynqagency.com.
      </p>
    </div>
  `)
}

export async function sendDeletionScheduledEmail({ to, scheduledFor, dashboardUrl }: { to: string; scheduledFor: string; dashboardUrl: string }) {
  const date = new Date(scheduledFor).toLocaleDateString('en-US', { dateStyle: 'long' })
  return resendSend(to, 'Your Lynq account is scheduled for deletion', `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Account Deletion Scheduled</h2>
      <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
        Your account and all associated data will be permanently deleted on <strong>${date}</strong>.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${dashboardUrl}" style="background:#A175FC;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:500;font-size:14px;">Cancel deletion</a>
      </p>
      <p style="font-size:12px;color:#9B91A8;margin:0;">This action can be undone by logging in before the deletion date.</p>
    </div>
  `)
}

export async function sendDeletionCompletedEmail({ to }: { to: string }) {
  return resendSend(to, 'Your Lynq account has been deleted', `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Account Deleted</h2>
      <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
        Your Lynq account and all associated data have been permanently deleted.
      </p>
      <p style="font-size:12px;color:#9B91A8;margin:0;">If you didn't request this, contact us at info@lynqagency.com.</p>
    </div>
  `)
}

export { escapeHtml }
