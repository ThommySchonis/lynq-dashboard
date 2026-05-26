import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext } from '@/lib/auth'
import { getInvoice } from '@/lib/services/billing'
import { renderInvoicePDF } from '@/lib/billing/invoice-pdf'
import { validateParams } from '@/lib/validation'
import { billingIdParams } from '@/lib/schemas/billing'
import { logger } from '@/lib/logger'

// GET /api/billing/invoices/[id]/pdf
// Returns the PDF as application/pdf with the invoice number as filename.
export async function GET(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [params, paramErr] = validateParams(await routeParams, billingIdParams)
  if (paramErr) return paramErr

  const invoice = await getInvoice(ctx.workspaceId, params.id)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const pdf = await renderInvoicePDF(invoice)
    // NextResponse expects BodyInit (Web stream), not a Node Buffer.
    // Wrapping in Uint8Array gives both: same underlying bytes,
    // compatible with the Web Response contract.
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control':       'private, max-age=60',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed'
    logger.error('[billing/pdf]', 'PDF generation failed', { invoiceNumber: invoice.invoice_number, error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
