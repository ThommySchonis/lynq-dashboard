import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '../../../../../../lib/auth'
import { getInvoice } from '../../../../../../lib/services/billing'
import { renderInvoicePDF } from '../../../../../../lib/billing/invoice-pdf'

interface RouteParams { params: Promise<{ id: string }> }

// GET /api/billing/invoices/[id]/pdf
// Returns the PDF as application/pdf with the invoice number as filename.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invoice = await getInvoice(ctx.workspaceId, id)
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
    console.error('[billing.pdf]', invoice.invoice_number, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
