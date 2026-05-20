import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { BillingServiceError, listInvoices } from '@/lib/services/billing'
import { validateQuery } from '@/lib/validation'
import { invoicesQuery } from '@/lib/schemas/billing'

// GET /api/billing/invoices?page=N&per_page=M
// Paginated invoice list for the current workspace.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, queryErr] = validateQuery(request, invoicesQuery)
  if (queryErr) return queryErr

  const page = query.page ?? 0
  const perPage = query.per_page ?? 25

  try {
    const { invoices, total } = await listInvoices(ctx.workspaceId, page, perPage)
    return NextResponse.json({ invoices, total, page, per_page: perPage })
  } catch (err) {
    if (err instanceof BillingServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to list invoices' }, { status: 500 })
  }
}
