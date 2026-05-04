/**
 * Shared email helpers — currently only invite emails.
 *
 * Returns { status, error? } instead of throwing so callers can
 * surface deliverability state to the UI without try/catch noise.
 *
 * status: 'sent' | 'not_configured' | 'no_link' | 'failed'
 */

const FROM_DEFAULT = 'Lynq & Flow <onboarding@resend.dev>'

const ROLE_LABELS = {
  admin:    'an Admin',
  agent:    'an Agent',
  observer: 'an Observer',
}

export async function sendInviteEmail({ to, workspaceName, inviterEmail, role, link }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping send')
    return { status: 'not_configured' }
  }
  if (!link) return { status: 'no_link' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const from      = process.env.INVITE_EMAIL_FROM || FROM_DEFAULT
    const roleLabel = ROLE_LABELS[role] || 'a member'
    const safeWs    = escapeHtml(workspaceName)
    const safeFrom  = escapeHtml(inviterEmail || '')

    await resend.emails.send({
      from,
      to,
      subject: `You've been invited to ${workspaceName}`,
      html: `
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
      `,
    })
    return { status: 'sent' }
  } catch (err) {
    const error = err?.message ?? 'Email send failed'
    console.error('[email] Resend error:', error)
    return { status: 'failed', error }
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
