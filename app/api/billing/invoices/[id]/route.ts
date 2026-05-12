import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { getInvoice } from '../../../../../lib/services/billing'

interface RouteParams { params: Promise<{ id: string }> }

// GET /api/billing/invoices/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invoice = await getInvoice(ctx.workspaceId, id)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ invoice })
}
