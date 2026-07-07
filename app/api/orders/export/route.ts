import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { exportBody } from '@/lib/schemas/data-export'
import { exportOrdersCSV } from '@/lib/services/data-export'
import { renderOrdersReportPDF } from '@/lib/services/data-export-pdf'
import { getStoreCredentials } from '@/lib/store-credentials'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bodyErr] = await validateBody(request, exportBody)
  if (bodyErr) return bodyErr

  const credentials = await getStoreCredentials(body.storeId, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })

  const params = { workspaceId: ctx.workspaceId, storeId: body.storeId, credentials }
  const today = new Date().toISOString().slice(0, 10)

  try {
    if (body.format === 'csv') {
      const csv = await exportOrdersCSV(params)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="orders-export-${today}.csv"`,
        },
      })
    }

    const pdf = await renderOrdersReportPDF(params)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="orders-report-${today}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    logger.error('[orders/export]', 'export failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
