import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Archiver } from 'archiver'
import { logger } from '@/lib/logger'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require('archiver') as { ZipArchive: new (opts: { zlib: { level: number } }) => Archiver }
import { getAuthContext, requireNotImpersonating } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { can } from '@/lib/permissions'
import { billingExportBody } from '@/lib/schemas/data-export'
import { exportBillingCSV } from '@/lib/services/data-export'
import { listInvoices, getInvoice } from '@/lib/services/billing'
import { renderInvoicePDF } from '@/lib/billing/invoice-pdf'
import type { Role } from '@/types/database'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked

  if (!can.manageWorkspace(ctx.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [body, bodyErr] = await validateBody(request, billingExportBody)
  if (bodyErr) return bodyErr

  const today = new Date().toISOString().slice(0, 10)

  try {
    if (body.format === 'csv') {
      const csv = await exportBillingCSV(ctx.workspaceId)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="billing-export-${today}.csv"`,
        },
      })
    }

    // PDF: bundle all invoice PDFs into a ZIP
    const { invoices } = await listInvoices(ctx.workspaceId, 0, 1000)

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'No invoices to export' }, { status: 404 })
    }

    // Create ZIP in memory
    const archive = new ZipArchive({ zlib: { level: 5 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Set up completion promise BEFORE finalize to avoid race condition
    const archiveComplete = new Promise<void>((resolve, reject) => {
      archive.on('end', resolve)
      archive.on('error', reject)
    })

    // Render each invoice PDF and append to archive
    for (const invoice of invoices) {
      const fullInvoice = await getInvoice(ctx.workspaceId, invoice.id)
      if (!fullInvoice) continue
      const pdfBuffer = await renderInvoicePDF(fullInvoice)
      archive.append(Buffer.from(pdfBuffer), { name: `${fullInvoice.invoice_number}.pdf` })
    }

    await archive.finalize()
    await archiveComplete

    const zipBuffer = Buffer.concat(chunks)

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="billing-invoices-${today}.zip"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    logger.error('[billing/export]', 'export failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
