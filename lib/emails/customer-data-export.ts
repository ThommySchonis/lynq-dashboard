import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { escapeHtml } from '@/lib/email'

const FROM_DEFAULT = 'Lynq & Flow <onboarding@resend.dev>'

interface CustomerDataExportInput {
  to: string
  customerEmail: string
  shopDomain: string
  jsonAttachment: object
}

/**
 * Sends the workspace owner the customer's data as a JSON attachment, in
 * response to a Shopify customers/data_request webhook.
 *
 * Returns { status: 'sent' | 'not_configured' | 'failed' } so the caller can
 * log + surface state without try/catch noise.
 */
export async function sendCustomerDataExportEmail(
  input: CustomerDataExportInput
): Promise<{ status: 'sent' | 'not_configured' | 'failed'; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[email/customer-data-export]', 'RESEND_API_KEY not set — skipping send')
    return { status: 'not_configured' }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.INVITE_EMAIL_FROM || FROM_DEFAULT
    const filename = `customer-data-${hashShort(input.customerEmail)}.json`
    const jsonString = JSON.stringify(input.jsonAttachment, null, 2)

    await resend.emails.send({
      from,
      to: input.to,
      subject: `GDPR data request — ${input.customerEmail}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">GDPR data access request</h2>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 12px;">
            Shopify forwarded a customer data request from <strong>${escapeHtml(input.shopDomain)}</strong>
            on behalf of <strong>${escapeHtml(input.customerEmail)}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 12px;">
            The attached JSON file (<code>${filename}</code>) contains the conversations, messages,
            notes, and tasks Lynq holds that reference this customer. Forward this file to the
            customer to fulfill the request.
          </p>
          <p style="font-size:12px;line-height:1.6;color:#9088A0;margin:0;">
            You have 30 days from the date of this email to respond to the customer under GDPR.
          </p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: Buffer.from(jsonString, 'utf8').toString('base64'),
        },
      ],
    })

    return { status: 'sent' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[email/customer-data-export]', 'send failed', { error: message })
    return { status: 'failed', error: message }
  }
}

function hashShort(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim(), 'utf8')
    .digest('hex')
    .slice(0, 8)
}

