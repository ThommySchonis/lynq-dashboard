import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BillingServiceError, listInvoices } from '@/lib/services/billing'
import { validateQuery } from '@/lib/validation'
import { invoicesQuery } from '@/lib/schemas/billing'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

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
    if (err instanceof BillingServiceError && err.statusCode < 500) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode })
    }

    const { data: cached } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1)

    if (cached) {
      return serviceCatchHandler(err, 'whop', {
        fallbackData: { invoices: cached, total: cached.length, page, per_page: perPage },
        fallbackMessage: 'Showing cached invoices — billing service is temporarily unavailable',
      })
    }
    return serviceCatchHandler(err, 'whop')
  }
}
