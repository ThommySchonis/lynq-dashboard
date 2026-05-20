import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { getAuthContext } from '@/lib/auth'
import { getInvoice } from '@/lib/services/billing'
import { validateParams } from '@/lib/validation'
import { billingIdParams } from '@/lib/schemas/billing'

// GET /api/billing/invoices/[id]
export async function GET(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [params, paramErr] = validateParams(await routeParams, billingIdParams)
  if (paramErr) return paramErr

  const invoice = await getInvoice(ctx.workspaceId, params.id)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ invoice })
}
