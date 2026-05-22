import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { exportBody } from '@/lib/schemas/data-export'
import { exportOrdersCSV } from '@/lib/services/data-export'
import { renderOrdersReportPDF } from '@/lib/services/data-export-pdf'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bodyErr] = await validateBody(request, exportBody)
  if (bodyErr) return bodyErr

  const today = new Date().toISOString().slice(0, 10)

  try {
    if (body.format === 'csv') {
      const csv = await exportOrdersCSV(ctx.workspaceId, body.storeId)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="orders-export-${today}.csv"`,
        },
      })
    }

    const pdf = await renderOrdersReportPDF(ctx.workspaceId, body.storeId)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="orders-report-${today}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    console.error('[orders.export]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
