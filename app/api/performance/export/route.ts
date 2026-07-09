import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { supportExportBody } from '@/lib/schemas/data-export'
import { exportSupportAnalyticsCSV } from '@/lib/services/support-analytics-export'
import { renderSupportAnalyticsReportPDF } from '@/lib/services/support-analytics-export-pdf'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bodyErr] = await validateBody(request, supportExportBody)
  if (bodyErr) return bodyErr

  const params = {
    workspaceId: ctx.workspaceId,
    from: body.from,
    to: body.to,
    agentId: body.agentId ?? null,
  }
  const today = new Date().toISOString().slice(0, 10)

  try {
    if (body.format === 'csv') {
      const csv = await exportSupportAnalyticsCSV(params)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="performance-export-${today}.csv"`,
        },
      })
    }

    const pdf = await renderSupportAnalyticsReportPDF(params)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="performance-report-${today}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    logger.error('[performance/export]', 'export failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
